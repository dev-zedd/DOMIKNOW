const bcrypt = require('bcrypt');
const userModel = require('../models/userModel');
const verificationModel = require('../models/verificationModel');
const maintenancePersonnelModel = require('../models/maintenancePersonnelModel');
const maintenanceComplianceService = require('../services/maintenanceComplianceService');
const auditLogModel = require('../models/auditLogModel');
const generateCode = require('../utils/generateCode');
const { sendMaintenanceInvitationEmail } = require('../config/mailer');
const responseHelper = require('../utils/responseHelper');
const { uploadFile } = require('../utils/storageHelper');

const ALLOWED_SCREENING_STATUSES = new Set([
    'pending', 'under_review', 'approved', 'conditional', 'rejected', 'expired', 'revoked'
]);

const ALLOWED_ACCESS_STATUSES = new Set([
    'pending', 'approved', 'restricted', 'rejected', 'revoked', 'expired'
]);

const maintenanceComplianceController = {
    // ── 1. Admin/HR: Create Maintenance Staff User ─────────────────────────
    async createUser(req, res) {
        try {
            const {
                full_name,
                email,
                contact_number,
                department,
                trade,
                service_area,
                supervisor_user_id
            } = req.body;

            const adminId = req.user.id;

            if (!full_name || !email) {
                return responseHelper.error(res, 'Full name and email are required to create a maintenance account.');
            }

            // Check duplicate email
            const existing = await userModel.findByEmail(email.trim().toLowerCase());
            if (existing) {
                return responseHelper.error(res, 'A user account with this email address already exists.');
            }

            // Generate random placeholder password until user sets their own
            const tempPassword = `Domi@${Math.random().toString(36).slice(-8)}!`;
            const password_hash = await bcrypt.hash(tempPassword, 12);

            const displayName = trade ? `${full_name.trim()} (${trade.trim()})` : full_name.trim();

            // Create user in users table — role = 'maintenance', account_status = 'pending', is_verified = false
            const newUser = await userModel.createUser({
                full_name: displayName,
                email: email.trim().toLowerCase(),
                password_hash,
                role: 'maintenance',
                contact_number: contact_number || null,
                address: service_area || null,
                is_verified: false,
                account_status: 'pending'
            });

            // Initialize profile, access record, and screening requirements
            await maintenanceComplianceService.initStaffRecords(newUser.id, {
                employee_number: `EMP-${Date.now().toString().slice(-6)}`,
                department: department || (trade ? `${trade} Department` : 'General Maintenance'),
                supervisor_user_id: supervisor_user_id || null,
                service_area: service_area || 'Global / All Properties',
                created_by: adminId
            });

            // Generate invitation code (6 digits) valid for 24 hours
            const code = generateCode();
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
            await verificationModel.saveCode(newUser.id, newUser.email, code, expiresAt);

            // Send invitation email
            const host = req.get('host');
            const protocol = req.protocol;
            const setupUrl = `${protocol}://${host}/pages/auth/maintenance-invite.html?email=${encodeURIComponent(newUser.email)}&code=${code}`;

            await sendMaintenanceInvitationEmail(newUser.email, {
                fullName: newUser.full_name,
                verificationCode: code,
                setupUrl
            });

            // Audit logs
            await auditLogModel.log(adminId, 'CREATE_MAINTENANCE_USER', `Admin created maintenance account for ${newUser.email} (${newUser.id}).`);
            await auditLogModel.log(adminId, 'INVITATION_SENT', `Invitation sent to ${newUser.email} with verification code.`);

            return responseHelper.success(res, 'Maintenance staff account created and invitation sent.', {
                user: {
                    id: newUser.id,
                    full_name: newUser.full_name,
                    email: newUser.email,
                    role: newUser.role,
                    account_status: newUser.account_status,
                    is_verified: newUser.is_verified
                },
                invitation_code: code,
                setup_url: setupUrl
            }, 201);

        } catch (error) {
            console.error('Create maintenance user error:', error);
            return responseHelper.error(res, 'Failed to create maintenance account.', error, 500);
        }
    },

    // ── 2. Admin/HR: Resend Invitation Email ────────────────────────────────
    async sendInvite(req, res) {
        try {
            const { userId, email } = req.body;
            const adminId = req.user.id;

            let user = null;
            if (userId) {
                user = await userModel.findById(userId);
            } else if (email) {
                user = await userModel.findByEmail(email.trim().toLowerCase());
            }

            if (!user || user.role !== 'maintenance') {
                return responseHelper.error(res, 'Maintenance user not found.');
            }

            // Generate new code
            const code = generateCode();
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
            await verificationModel.saveCode(user.id, user.email, code, expiresAt);

            const host = req.get('host');
            const protocol = req.protocol;
            const setupUrl = `${protocol}://${host}/pages/auth/maintenance-invite.html?email=${encodeURIComponent(user.email)}&code=${code}`;

            await sendMaintenanceInvitationEmail(user.email, {
                fullName: user.full_name,
                verificationCode: code,
                setupUrl
            });

            await auditLogModel.log(adminId, 'INVITATION_SENT', `Re-sent onboarding invitation to ${user.email}.`);

            return responseHelper.success(res, 'Invitation sent successfully.', {
                email: user.email,
                invitation_code: code,
                setup_url: setupUrl
            });

        } catch (error) {
            console.error('Send invite error:', error);
            return responseHelper.error(res, 'Failed to send invitation email.', error, 500);
        }
    },

    // ── 3. Maintenance User: Verify Invite & Set Password ───────────────────
    async verifyInviteAndSetPassword(req, res) {
        try {
            const { email, verification_code, password, contact_number, address } = req.body;

            if (!email || !verification_code || !password) {
                return responseHelper.error(res, 'Email, verification code, and new password are required.');
            }

            if (password.length < 8) {
                return responseHelper.error(res, 'Password must be at least 8 characters long.');
            }

            // Find valid verification record
            const record = await verificationModel.findLatestCode(email.trim().toLowerCase());
            if (!record || record.verification_code !== verification_code.trim()) {
                return responseHelper.error(res, 'Invalid or expired invitation code.');
            }

            const user = await userModel.findByEmail(email.trim().toLowerCase());
            if (!user) {
                return responseHelper.error(res, 'User not found.');
            }

            // Mark verification code as used
            await verificationModel.markUsed(record.id);

            // Hash new password
            const password_hash = await bcrypt.hash(password, 12);

            // Update user: set verified = true, account_status = 'active'
            await userModel.updatePassword(user.id, password_hash);
            const updated = await userModel.updateVerified(user.id, 'admin'); // sets active

            // Update contact or address if supplied
            if (contact_number || address) {
                await userModel.updateProfile(user.id, {
                    contact_number: contact_number || user.contact_number,
                    address: address || user.address
                });
            }

            await auditLogModel.log(user.id, 'EMAIL_VERIFIED', 'Maintenance staff verified email via onboarding invite.');
            await auditLogModel.log(user.id, 'PASSWORD_SET', 'Maintenance staff set their account password.');

            return responseHelper.success(res, 'Account verified and password set successfully. You can now log in.', {
                user_id: user.id,
                email: user.email,
                account_status: 'active'
            });

        } catch (error) {
            console.error('Verify invite error:', error);
            return responseHelper.error(res, 'Failed to complete invite verification.', error, 500);
        }
    },

    // ── 4. Complete / Update Maintenance Profile ───────────────────────────
    async completeProfile(req, res) {
        try {
            const {
                employee_number,
                department,
                supervisor_user_id,
                hire_date,
                certifications,
                service_area,
                availability_status,
                skills,
                userId
            } = req.body;

            // Target user is authenticated user if role is maintenance, or target userId if admin
            let targetUserId = req.user.id;
            if (req.user.role === 'admin' && userId) {
                targetUserId = userId;
            }

            const user = await userModel.findById(targetUserId);
            if (!user || user.role !== 'maintenance') {
                return responseHelper.error(res, 'Target user is not maintenance personnel.');
            }

            // Upsert profile
            const profile = await maintenancePersonnelModel.upsertProfile(targetUserId, {
                employee_number,
                department,
                supervisor_user_id,
                hire_date,
                certifications,
                service_area,
                availability_status: availability_status || 'available',
                is_active: true
            });

            // Sync skills if array provided
            let syncedSkills = [];
            if (Array.isArray(skills)) {
                syncedSkills = await maintenancePersonnelModel.syncSkills(targetUserId, skills);
            }

            await auditLogModel.log(req.user.id, 'PROFILE_COMPLETION', `Profile completed/updated for maintenance user ${targetUserId}.`);

            return responseHelper.success(res, 'Maintenance profile successfully updated.', {
                profile,
                skills: syncedSkills
            });

        } catch (error) {
            console.error('Update profile error:', error);
            return responseHelper.error(res, 'Failed to update maintenance profile.', error, 500);
        }
    },

    // ── 5. Get Eligible Maintenance Personnel ──────────────────────────────
    async getEligibleStaff(req, res) {
        try {
            const eligibleStaff = await maintenanceComplianceService.getGlobalPool({
                filterEligibleOnly: true,
                searchQuery: req.query.search,
                department: req.query.department
            });

            return responseHelper.success(res, 'Eligible maintenance personnel retrieved from global pool.', eligibleStaff);

        } catch (error) {
            console.error('Get eligible staff error:', error);
            return responseHelper.error(res, 'Failed to retrieve eligible maintenance staff.', error, 500);
        }
    },

    // ── 6. Maintenance User: Submit Screening Document / Evidence ─────────
    async submitScreening(req, res) {
        try {
            const {
                requirement_id,
                notes,
                document_url,
                base64_content,
                file_name,
                mime_type,
                file_size,
                userId
            } = req.body;

            let targetUserId = req.user.id;
            if (req.user.role === 'admin' && userId) {
                targetUserId = userId;
            }

            if (!requirement_id) {
                return responseHelper.error(res, 'Screening requirement ID is required.');
            }

            // Verify requirement exists
            const requirement = await maintenancePersonnelModel.findRequirementById(requirement_id);
            if (!requirement) {
                return responseHelper.error(res, 'Screening requirement not found.');
            }

            let finalDocUrl = document_url || null;

            // Handle base64 file upload if provided
            if (base64_content && file_name && mime_type) {
                const allowedMime = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
                if (!allowedMime.includes(mime_type)) {
                    return responseHelper.error(res, 'Invalid format. Allowed formats: PDF, JPG, JPEG, PNG, WEBP.');
                }
                if (file_size && parseInt(file_size) > 15 * 1024 * 1024) {
                    return responseHelper.error(res, 'File size exceeds maximum limit of 15MB.');
                }

                const uniqueName = `${Date.now()}-${file_name}`;
                const storagePath = `screening/${targetUserId}/${uniqueName}`;
                const uploadResult = await uploadFile('maintenance-images', storagePath, base64_content, mime_type);
                finalDocUrl = uploadResult.url;
            }

            // Find existing record or create new
            let record = await maintenancePersonnelModel.findScreeningRecordByUserAndRequirement(targetUserId, requirement_id);

            if (record) {
                record = await maintenancePersonnelModel.updateScreeningRecord(record.id, {
                    document_url: finalDocUrl,
                    notes: notes || record.notes,
                    status: 'under_review',
                    submitted_at: new Date().toISOString()
                });
            } else {
                record = await maintenancePersonnelModel.createScreeningRecord({
                    user_id: targetUserId,
                    requirement_id,
                    document_url: finalDocUrl,
                    notes: notes || 'Evidence submitted by technician',
                    status: 'under_review',
                    submitted_at: new Date().toISOString()
                });
            }

            await auditLogModel.log(
                req.user.id,
                'SCREENING_SUBMITTED',
                `Evidence submitted for screening requirement '${requirement.name}' (User: ${targetUserId}).`
            );

            return responseHelper.success(res, 'Screening document successfully submitted for review.', record);

        } catch (error) {
            console.error('Submit screening error:', error);
            return responseHelper.error(res, 'Failed to submit screening document.', error, 500);
        }
    },

    // ── 7. Screening Officer / Admin: Review Screening Record ──────────────
    async reviewScreening(req, res) {
        try {
            const {
                record_id,
                status,
                notes,
                expires_at
            } = req.body;

            const reviewerId = req.user.id;

            if (!record_id || !status) {
                return responseHelper.error(res, 'Record ID and status are required for review.');
            }

            if (!ALLOWED_SCREENING_STATUSES.has(status)) {
                return responseHelper.error(res, `Invalid status. Acceptable values: ${Array.from(ALLOWED_SCREENING_STATUSES).join(', ')}.`);
            }

            const record = await maintenancePersonnelModel.findScreeningRecordById(record_id);
            if (!record) {
                return responseHelper.error(res, 'Screening record not found.');
            }

            // Calculate expiration date if approved or conditional and not explicitly set
            let calculatedExpiry = expires_at || null;
            if ((status === 'approved' || status === 'conditional') && !calculatedExpiry) {
                const validDays = record.requirement?.valid_for_days || 365;
                const expDate = new Date();
                expDate.setDate(expDate.getDate() + validDays);
                calculatedExpiry = expDate.toISOString();
            }

            const updatedRecord = await maintenancePersonnelModel.updateScreeningRecord(record_id, {
                status,
                reviewed_by: reviewerId,
                reviewed_at: new Date().toISOString(),
                expires_at: calculatedExpiry,
                notes: notes !== undefined ? notes : record.notes
            });

            // Trigger access status evaluation & refresh
            await maintenanceComplianceService.evaluateRecordExpiration(record.user_id);

            // Audit log
            await auditLogModel.log(
                reviewerId,
                'SCREENING_REVIEW',
                `Screening record for requirement '${record.requirement?.name || record.requirement_id}' reviewed: status set to '${status}'. Technician ID: ${record.user_id}.`
            );

            return responseHelper.success(res, `Screening record status successfully updated to '${status}'.`, updatedRecord);

        } catch (error) {
            console.error('Review screening error:', error);
            return responseHelper.error(res, 'Failed to review screening record.', error, 500);
        }
    },

    // ── 8. Admin: Update Maintenance Access ─────────────────────────────────
    async updateAccess(req, res) {
        try {
            const {
                userId,
                access_status,
                expires_at,
                restriction_reason,
                site_id
            } = req.body;

            const adminId = req.user.id;

            if (!userId || !access_status) {
                return responseHelper.error(res, 'User ID and access status are required.');
            }

            if (!ALLOWED_ACCESS_STATUSES.has(access_status)) {
                return responseHelper.error(res, `Invalid access status. Allowed values: ${Array.from(ALLOWED_ACCESS_STATUSES).join(', ')}.`);
            }

            const user = await userModel.findById(userId);
            if (!user || user.role !== 'maintenance') {
                return responseHelper.error(res, 'Target user is not a maintenance personnel.');
            }

            const access = await maintenancePersonnelModel.upsertAccess(userId, {
                access_status,
                granted_by: adminId,
                granted_at: new Date().toISOString(),
                expires_at: expires_at || null,
                restriction_reason: restriction_reason || null,
                site_id: site_id || null
            });

            await auditLogModel.log(
                adminId,
                'ACCESS_UPDATE',
                `Maintenance access for ${user.email} (${userId}) updated to '${access_status}'. Reason: ${restriction_reason || 'N/A'}.`
            );

            return responseHelper.success(res, `Maintenance access successfully updated to '${access_status}'.`, access);

        } catch (error) {
            console.error('Update access error:', error);
            return responseHelper.error(res, 'Failed to update maintenance access.', error, 500);
        }
    },

    // ── 9. Admin / Landlord: Assign Technician with Compliance Enforcement ─
    async assignTechnician(req, res) {
        try {
            const {
                requestId,
                technicianId,
                dueDate,
                instructions
            } = req.body;

            const assignedByUserId = req.user.id;

            if (!requestId || !technicianId || !dueDate) {
                return responseHelper.error(res, 'Request ID, technician ID, and due date are required.');
            }

            const result = await maintenanceComplianceService.assignTechnician({
                requestId,
                technicianId,
                dueDate,
                instructions,
                assignedByUserId
            });

            return responseHelper.success(res, 'Technician assigned successfully with verified compliance.', result, 201);

        } catch (error) {
            console.error('Assignment error:', error.message);
            // Return explicit error message if blocked
            return responseHelper.error(res, error.message || 'Failed to assign technician.', error, 400);
        }
    },

    // ── 10. Admin: Get Assignment Eligibility for User ─────────────────────
    async getAssignmentEligibility(req, res) {
        try {
            const { userId } = req.params;

            if (!userId) {
                return responseHelper.error(res, 'User ID parameter is required.');
            }

            const eligibility = await maintenanceComplianceService.checkEligibility(userId);

            return responseHelper.success(res, 'Technician eligibility evaluated.', eligibility);

        } catch (error) {
            console.error('Get eligibility error:', error);
            return responseHelper.error(res, 'Failed to evaluate technician eligibility.', error, 500);
        }
    },

    // ── 11. Admin: Get Global Maintenance Pool ─────────────────────────────
    async getGlobalPool(req, res) {
        try {
            const filterEligibleOnly = req.query.eligible_only === 'true';
            const searchQuery = req.query.search || '';
            const department = req.query.department || '';

            const pool = await maintenanceComplianceService.getGlobalPool({
                filterEligibleOnly,
                searchQuery,
                department
            });

            return responseHelper.success(res, 'Global maintenance pool retrieved.', pool);

        } catch (error) {
            console.error('Get global pool error:', error);
            return responseHelper.error(res, 'Failed to retrieve maintenance pool.', error, 500);
        }
    },

    // ── 12. List & Manage Screening Requirements ───────────────────────────
    async getScreeningRequirements(req, res) {
        try {
            const requirements = await maintenancePersonnelModel.getScreeningRequirements('maintenance');
            return responseHelper.success(res, 'Screening requirements retrieved.', requirements);
        } catch (error) {
            console.error('Get requirements error:', error);
            return responseHelper.error(res, 'Failed to fetch requirements.', error, 500);
        }
    },

    async upsertScreeningRequirement(req, res) {
        try {
            const {
                id,
                code,
                name,
                description,
                required_for_assignment,
                valid_for_days,
                is_active
            } = req.body;

            if (!name) {
                return responseHelper.error(res, 'Requirement name is required.');
            }

            const requirement = await maintenancePersonnelModel.upsertScreeningRequirement({
                id,
                code,
                name,
                description,
                applies_to_role: 'maintenance',
                required_for_assignment: required_for_assignment !== undefined ? required_for_assignment : true,
                valid_for_days: valid_for_days !== undefined ? valid_for_days : 365,
                is_active: is_active !== undefined ? is_active : true
            });

            await auditLogModel.log(req.user.id, 'REQUIREMENT_UPDATED', `Screening requirement '${name}' updated/created.`);

            return responseHelper.success(res, 'Screening requirement successfully saved.', requirement);

        } catch (error) {
            console.error('Upsert requirement error:', error);
            return responseHelper.error(res, 'Failed to save screening requirement.', error, 500);
        }
    },

    // ── 13. Get All Screening Records (For Screening Officer Dashboard) ───
    async getAllScreeningRecords(req, res) {
        try {
            const records = await maintenancePersonnelModel.getAllScreeningRecords();
            return responseHelper.success(res, 'Screening records retrieved.', records);
        } catch (error) {
            console.error('Get all records error:', error);
            return responseHelper.error(res, 'Failed to fetch screening records.', error, 500);
        }
    },

    // ── 14. Technician: Get My Compliance & Screening Details ─────────────
    async getMyCompliance(req, res) {
        try {
            const userId = req.user.id;
            const eligibility = await maintenanceComplianceService.checkEligibility(userId);
            return responseHelper.success(res, 'Compliance details retrieved.', eligibility);
        } catch (error) {
            console.error('Get my compliance error:', error);
            return responseHelper.error(res, 'Failed to retrieve compliance information.', error, 500);
        }
    },

    // ── 15. Admin: Get Open Maintenance Requests for Assignment ──────────
    async getOpenRequests(req, res) {
        try {
            const requests = await maintenancePersonnelModel.getOpenRequests();
            return responseHelper.success(res, 'Open maintenance requests retrieved.', requests);
        } catch (error) {
            console.error('Get open requests error:', error);
            return responseHelper.error(res, 'Failed to fetch open requests.', error, 500);
        }
    }
};

module.exports = maintenanceComplianceController;
