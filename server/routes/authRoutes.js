const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const handleValidationErrors = require('../middleware/validationMiddleware');
const rateLimit = require('express-rate-limit');

// Rate limiters
const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: { success: false, message: 'Too many registration attempts, please try again later.' }
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: { success: false, message: 'Too many login attempts, please try again later.' }
});

const verifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: 'Too many verification attempts, please try again later.' }
});

// Validation rules
const registerValidation = [
    body('full_name')
        .trim()
        .notEmpty().withMessage('Full name is required')
        .isLength({ min: 2, max: 255 }).withMessage('Full name must be between 2 and 255 characters'),
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),
    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    body('role')
        .notEmpty().withMessage('Role is required')
        .isIn(['tenant', 'landlord']).withMessage('Public registration is available only for tenants and landlords'),
    body('contact_number')
        .optional()
        .trim()
        .isLength({ max: 50 }).withMessage('Contact number too long'),
    body('address')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Address too long')
];

const loginValidation = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),
    body('password')
        .notEmpty().withMessage('Password is required')
];

const verifyCodeValidation = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),
    body('verification_code')
        .trim()
        .notEmpty().withMessage('Verification code is required')
        .isLength({ min: 6, max: 6 }).withMessage('Verification code must be 6 digits')
        .isNumeric().withMessage('Verification code must be numeric')
];

const resendCodeValidation = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail()
];

const forgotPasswordValidation = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail()
];

const resetPasswordValidation = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),
    body('verification_code')
        .trim()
        .notEmpty().withMessage('Verification code is required'),
    body('new_password')
        .notEmpty().withMessage('New password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
];

const requireAuth = require('../middleware/authMiddleware');

// Routes with validation and rate limiting
router.post('/register', registerValidation, handleValidationErrors, authController.register);
router.post('/verify-code', verifyCodeValidation, handleValidationErrors, authController.verifyCode);
router.post('/resend-code', resendCodeValidation, handleValidationErrors, authController.resendCode);
router.post('/login', loginValidation, handleValidationErrors, authController.login);
router.post('/forgot-password', forgotPasswordValidation, handleValidationErrors, authController.forgotPassword);
router.post('/reset-password', resetPasswordValidation, handleValidationErrors, authController.resetPassword);
router.get('/me', requireAuth, authController.getMe);

module.exports = router;

