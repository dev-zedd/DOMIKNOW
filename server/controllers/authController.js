const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
const verificationModel = require('../models/verificationModel');
const auditLogModel = require('../models/auditLogModel');
const generateCode = require('../utils/generateCode');
const { sendVerificationEmail, sendForgotPasswordEmail } = require('../config/mailer');
const responseHelper = require('../utils/responseHelper');

const authController = {
    async register(req, res) {
        try {
            const { full_name, email, password, role, contact_number, address } = req.body;

            // 1. Validate required fields
            if (!full_name || !email || !password || !role) {
                return responseHelper.error(res, 'Full name, email, password, and role are required.');
            }

            // 2. Validate role
            const allowedRoles = ['tenant', 'landlord'];
            if (!allowedRoles.includes(role)) {
                return responseHelper.error(res, 'Invalid role. Public registration is available only for tenants and landlords.');
            }

            // 3. Check duplicate email
            const existingUser = await userModel.findByEmail(email);
            if (existingUser) {
                return responseHelper.error(res, 'Email already exists.');
            }

            // 4. Hash password
            const saltRounds = 12;
            const password_hash = await bcrypt.hash(password, saltRounds);

            // 5. Create user account
            const newUser = await userModel.createUser({
                full_name,
                email,
                password_hash,
                role,
                contact_number,
                address,
                is_verified: false,
                account_status: 'pending'
            });

            // 6. Generate verification code
            const code = generateCode();
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now

            // 7. Save code
            await verificationModel.saveCode(newUser.id, email, code, expiresAt);

            // 8. Send email
            await sendVerificationEmail(email, code);

            // 9. Audit log
            await auditLogModel.log(newUser.id, 'REGISTER', `User registered as ${role}`);

            // 10. Return success
            return responseHelper.success(res, 'Registration successful. Please check your email for the verification code.', { id: newUser.id }, 201);

        } catch (error) {
            console.error('Register error:', error);
            return responseHelper.error(res, 'Registration failed', error, 500);
        }
    },

    async verifyCode(req, res) {
        try {
            const { email, verification_code } = req.body;

            if (!email || !verification_code) {
                return responseHelper.error(res, 'Email and verification code are required.');
            }

            // 1. Find latest unused verification code
            const record = await verificationModel.findLatestCode(email);
            if (!record || record.verification_code !== verification_code) {
                return responseHelper.error(res, 'Invalid or expired verification code.');
            }

            // 2. Mark code as used
            await verificationModel.markUsed(record.id);

            // 3. Get user to know role
            const user = await userModel.findByEmail(email);
            if (!user) {
                return responseHelper.error(res, 'User not found.');
            }

            // 4. Set is_verified = true and update account_status based on role
            const updatedUser = await userModel.updateVerified(user.id, user.role);

            // 5. Audit log
            await auditLogModel.log(user.id, 'EMAIL_VERIFIED', 'User verified their email address.');

            // 6. Return response based on role
            let message = 'Email verified successfully.';
            if (user.role === 'tenant') {
                message += ' You can now log in.';
            } else {
                message += ' Please wait for admin approval before logging in.';
            }

            return responseHelper.success(res, message, { account_status: updatedUser.account_status });

        } catch (error) {
            console.error('Verify error:', error);
            return responseHelper.error(res, 'Verification failed', error, 500);
        }
    },

    async resendCode(req, res) {
        try {
            const { email } = req.body;

            if (!email) {
                return responseHelper.error(res, 'Email is required.');
            }

            // 1. Check user exists and is not verified
            const user = await userModel.findByEmail(email);
            if (!user) {
                return responseHelper.error(res, 'User not found.');
            }
            if (user.is_verified) {
                return responseHelper.error(res, 'Email is already verified.');
            }

            // 2. Generate new code
            const code = generateCode();
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

            // 3. Save new code
            await verificationModel.saveCode(user.id, email, code, expiresAt);

            // 4. Send email
            await sendVerificationEmail(email, code);

            // 5. Audit log
            await auditLogModel.log(user.id, 'RESEND_CODE', 'User requested a new verification code.');

            return responseHelper.success(res, 'A new verification code has been sent to your email.');

        } catch (error) {
            console.error('Resend code error:', error);
            return responseHelper.error(res, 'Failed to resend code', error, 500);
        }
    },

    async login(req, res) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return responseHelper.error(res, 'Email and password are required.');
            }

            // 1. Check if user exists
            const user = await userModel.findByEmail(email);
            if (!user) {
                // Log failed attempt if possible (no user id though)
                await auditLogModel.log(null, 'LOGIN_FAILED', `Failed login attempt for email: ${email}`);
                return responseHelper.error(res, 'Invalid credentials.', null, 401);
            }

            // 2. Compare password
            const isMatch = await bcrypt.compare(password, user.password_hash);
            if (!isMatch) {
                await auditLogModel.log(user.id, 'LOGIN_FAILED', 'Invalid password.');
                return responseHelper.error(res, 'Invalid credentials.', null, 401);
            }

            // Auto-lift expired suspensions before enforcing block
            const currentUser = await userModel.liftExpiredSuspension(user);

            // 3. Block conditions
            if (!currentUser.is_verified) {
                await auditLogModel.log(currentUser.id, 'LOGIN_BLOCKED', 'Email not verified.');
                return responseHelper.error(res, 'Please verify your email before logging in.', null, 403);
            }
            if (currentUser.account_status === 'pending') {
                await auditLogModel.log(currentUser.id, 'LOGIN_BLOCKED', 'Account pending admin approval.');
                return responseHelper.error(res, 'Your account is pending admin approval.', null, 403);
            }
            if (currentUser.account_status === 'rejected') {
                await auditLogModel.log(currentUser.id, 'LOGIN_BLOCKED', 'Account rejected.');
                return responseHelper.error(res, 'Your account application was rejected.', null, 403);
            }
            if (currentUser.account_status === 'disabled') {
                if (currentUser.suspension_lifted_at) {
                    const liftAt = new Date(currentUser.suspension_lifted_at);
                    const daysLeft = Math.max(1, Math.ceil((liftAt - new Date()) / (1000 * 60 * 60 * 24)));
                    await auditLogModel.log(currentUser.id, 'LOGIN_BLOCKED', `Account suspended. Lifts in ${daysLeft} day(s).`);
                    return responseHelper.error(res, `Your account has been temporarily suspended. It will automatically be lifted in ${daysLeft} day(s). Contact support for assistance.`, null, 403);
                } else {
                    await auditLogModel.log(currentUser.id, 'LOGIN_BLOCKED', 'Account disabled or banned.');
                    return responseHelper.error(res, 'Your account has been disabled or permanently banned. Contact support for assistance.', null, 403);
                }
            }

            // 4. Generate JWT token
            const token = jwt.sign(
                { id: user.id, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            // 5. Audit log
            await auditLogModel.log(user.id, 'LOGIN_SUCCESS', 'User logged in successfully.');

            // 6. Return response
            return responseHelper.success(res, 'Login successful', {
                token,
                user: {
                    id: user.id,
                    full_name: user.full_name,
                    email: user.email,
                    role: user.role
                }
            });

        } catch (error) {
            console.error('Login error:', error);
            return responseHelper.error(res, 'Login failed', error, 500);
        }
    },

    async forgotPassword(req, res) {
        try {
            const { email } = req.body;
            if (!email) {
                return responseHelper.error(res, 'Email is required.');
            }

            // 1. Verify user exists
            const user = await userModel.findByEmail(email);
            if (!user) {
                // Return success even if email not found for security, but do not send email
                return responseHelper.success(res, 'If your email is registered, we have sent a password reset code.');
            }

            // 2. Generate reset code
            const code = generateCode();
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

            // 3. Save code in verificationModel (reusing email_verifications table)
            await verificationModel.saveCode(user.id, email, code, expiresAt);

            // 4. Send email
            await sendForgotPasswordEmail(email, code);

            // 5. Audit log
            await auditLogModel.log(user.id, 'FORGOT_PASSWORD_REQUEST', `User requested password reset code`);

            return responseHelper.success(res, 'Password reset code sent. Please check your email.');

        } catch (error) {
            console.error('Forgot password error:', error);
            return responseHelper.error(res, 'Failed to process forgot password request', error, 500);
        }
    },

    async resetPassword(req, res) {
        try {
            const { email, verification_code, new_password } = req.body;
            if (!email || !verification_code || !new_password) {
                return responseHelper.error(res, 'Email, verification code, and new password are required.');
            }

            if (new_password.length < 8) {
                return responseHelper.error(res, 'Password must be at least 8 characters long.');
            }

            // 1. Find latest unused verification code
            const record = await verificationModel.findLatestCode(email);
            if (!record || record.verification_code !== verification_code) {
                return responseHelper.error(res, 'Invalid or expired password reset code.');
            }

            // 2. Mark code as used
            await verificationModel.markUsed(record.id);

            // 3. Get user
            const user = await userModel.findByEmail(email);
            if (!user) {
                return responseHelper.error(res, 'User not found.');
            }

            // 4. Hash new password
            const saltRounds = 12;
            const password_hash = await bcrypt.hash(new_password, saltRounds);

            // 5. Update user password
            await userModel.updatePassword(user.id, password_hash);

            // 6. Audit log
            await auditLogModel.log(user.id, 'PASSWORD_RESET_SUCCESS', `User successfully reset their password`);

            return responseHelper.success(res, 'Password reset successfully. You can now log in with your new password.');

        } catch (error) {
            console.error('Reset password error:', error);
            return responseHelper.error(res, 'Failed to reset password', error, 500);
        }
    },

    async getMe(req, res) {
        try {
            const user = await userModel.findById(req.user.id);
            if (!user) {
                return responseHelper.error(res, 'User not found.', null, 404);
            }
            return responseHelper.success(res, 'User profile retrieved successfully', user);
        } catch (error) {
            console.error('Get profile error:', error);
            return responseHelper.error(res, 'Failed to fetch user profile', error, 500);
        }
    }
};


module.exports = authController;
