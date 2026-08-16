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

module.exports = {
    transporter,
    sendVerificationEmail,
    sendForgotPasswordEmail
};
