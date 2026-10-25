require('dotenv').config();
const nodemailer = require('nodemailer');

const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: smtpPass,
    },
});

const sendVerificationEmail = async (toEmail, verificationCode) => {
    const mailOptions = {
        from: process.env.SMTP_FROM || 'DomiKnow <no-reply@domiknow.com>',
        to: toEmail,
        subject: 'DomiKnow - Email Verification Code',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <h2 style="color: #4F46E5; text-align: center;">DomiKnow</h2>
                <h3 style="color: #333;">Verify Your Email Address</h3>
                <p style="color: #555;">Thank you for registering with DomiKnow. Please use the following verification code to verify your email address:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <span style="display: inline-block; padding: 15px 30px; font-size: 24px; font-weight: bold; background-color: #F3F4F6; color: #111827; letter-spacing: 5px; border-radius: 5px;">${verificationCode}</span>
                </div>
                <p style="color: #555;"><strong>Note:</strong> This code will expire in 15 minutes.</p>
                <p style="color: #555; font-size: 14px; margin-top: 30px;">If you did not request this, please ignore this email.</p>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Verification email sent to ${toEmail}`);
        return true;
    } catch (error) {
        console.error('Error sending email:', error.message || error);
        console.log(`\n==================================================`);
        console.log(`[DEV VERIFICATION CODE FOR ${toEmail}]: ${verificationCode}`);
        console.log(`==================================================\n`);
        return false;
    }
};

const sendForgotPasswordEmail = async (toEmail, resetCode) => {
    const mailOptions = {
        from: process.env.SMTP_FROM || 'DomiKnow <no-reply@domiknow.com>',
        to: toEmail,
        subject: 'DomiKnow - Password Reset Code',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <h2 style="color: #0F4953; text-align: center;">DomiKnow</h2>
                <h3 style="color: #333;">Reset Your Password</h3>
                <p style="color: #555;">We received a request to reset your DomiKnow account password. Please use the following code to verify your request:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <span style="display: inline-block; padding: 15px 30px; font-size: 24px; font-weight: bold; background-color: #F3F4F6; color: #111827; letter-spacing: 5px; border-radius: 5px;">${resetCode}</span>
                </div>
                <p style="color: #555;"><strong>Note:</strong> This code will expire in 15 minutes.</p>
                <p style="color: #555; font-size: 14px; margin-top: 30px;">If you did not request a password reset, please ignore this email or contact support.</p>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Password reset email sent to ${toEmail}`);
        return true;
    } catch (error) {
        console.error('Error sending password reset email:', error.message || error);
        console.log(`\n==================================================`);
        console.log(`[DEV RESET CODE FOR ${toEmail}]: ${resetCode}`);
        console.log(`==================================================\n`);
        return false;
    }
};

const sendMaintenanceInvitationEmail = async (toEmail, { fullName, verificationCode, setupUrl }) => {
    const mailOptions = {
        from: process.env.SMTP_FROM || 'DomiKnow <no-reply@domiknow.com>',
        to: toEmail,
        subject: 'DomiKnow - Maintenance Staff Account Invitation',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <h2 style="color: #0F4953; margin: 0; font-size: 28px; font-weight: 700;">DomiKnow</h2>
                    <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Field Operations & Maintenance Workforce</p>
                </div>
                <h3 style="color: #1e293b; font-size: 20px; margin-bottom: 12px;">Welcome to the Team, ${fullName || 'Technician'}!</h3>
                <p style="color: #475569; font-size: 15px; line-height: 1.6;">
                    An administrative maintenance staff account has been created for you on the DomiKnow Property Management Platform.
                </p>
                <p style="color: #475569; font-size: 15px; line-height: 1.6;">
                    To complete your onboarding, please verify your email and set your account password using the 6-digit invitation code below:
                </p>
                <div style="text-align: center; margin: 32px 0;">
                    <span style="display: inline-block; padding: 16px 36px; font-size: 28px; font-weight: 800; background-color: #f0fdfa; color: #0F4953; border: 2px dashed #0d9488; letter-spacing: 6px; border-radius: 8px;">${verificationCode}</span>
                </div>
                ${setupUrl ? `
                <div style="text-align: center; margin-bottom: 30px;">
                    <a href="${setupUrl}" style="display: inline-block; background-color: #0F4953; color: #ffffff; text-decoration: none; padding: 12px 28px; font-size: 15px; font-weight: 600; border-radius: 8px;">Activate Account & Set Password</a>
                </div>
                ` : ''}
                <p style="color: #64748b; font-size: 13px;"><strong>Note:</strong> This verification invitation code will expire in 24 hours.</p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                <p style="color: #94a3b8; font-size: 12px; text-align: center;">
                    If you were not expecting this invitation, please contact your DomiKnow Property Administrator or HR Operations.
                </p>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Maintenance invitation email sent to ${toEmail}`);
        return true;
    } catch (error) {
        console.error('Error sending maintenance invitation email:', error.message || error);
        console.log(`\n==================================================`);
        console.log(`[DEV MAINTENANCE INVITATION CODE FOR ${toEmail}]: ${verificationCode}`);
        if (setupUrl) console.log(`[DEV SETUP URL]: ${setupUrl}`);
        console.log(`==================================================\n`);
        return false;
    }
};

module.exports = {
    transporter,
    sendVerificationEmail,
    sendForgotPasswordEmail,
    sendMaintenanceInvitationEmail
};

