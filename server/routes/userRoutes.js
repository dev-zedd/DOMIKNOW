const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const rateLimit = require('express-rate-limit');
const userController = require('../controllers/userController');
const requireAuth = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');
const handleValidationErrors = require('../middleware/validationMiddleware');

// Validation rules
const updateProfileValidation = [
    body('full_name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 255 }).withMessage('Full name must be between 2 and 255 characters'),
    body('contact_number')
        .optional()
        .trim()
        .isLength({ max: 50 }).withMessage('Contact number too long'),
    body('address')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Address too long')
];

const updateStatusValidation = [
    param('id')
        .isUUID().withMessage('Invalid user ID format'),
    body('account_status')
        .notEmpty().withMessage('Account status is required')
        .isIn(['pending', 'active', 'disabled', 'rejected']).withMessage('Invalid account status')
];

const changePasswordValidation = [
    body('current_password')
        .notEmpty().withMessage('Current password is required'),
    body('new_password')
        .notEmpty().withMessage('New password is required')
        .isLength({ min: 8, max: 128 }).withMessage('New password must be between 8 and 128 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('New password must contain an uppercase letter, a lowercase letter, and a number')
];

const profileImageValidation = [
    body('base64_content').notEmpty().withMessage('Profile image data is required'),
    body('mime_type').isIn(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']).withMessage('Unsupported profile image type'),
    body('file_size').isInt({ min: 1, max: 3 * 1024 * 1024 }).withMessage('Profile image must be smaller than 3 MB')
];

const passwordChangeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 8,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many password attempts. Please wait before trying again.' }
});

const userIdValidation = [
    param('id')
        .isUUID().withMessage('Invalid user ID format')
];

// Profile routes (all authenticated users)
router.get('/me', requireAuth, userController.getProfile);
router.put('/me', requireAuth, updateProfileValidation, handleValidationErrors, userController.updateProfile);
router.post('/me/avatar', requireAuth, profileImageValidation, handleValidationErrors, userController.uploadProfileImage);
router.delete('/me/avatar', requireAuth, userController.removeProfileImage);
router.put('/me/password', requireAuth, passwordChangeLimiter, changePasswordValidation, handleValidationErrors, userController.changePassword);

// Admin user management routes
router.get('/', requireAuth, requireRole('admin'), userController.getAllUsers);
router.get('/:id', requireAuth, requireRole('admin'), userIdValidation, handleValidationErrors, userController.getUserById);
router.put('/:id/status', requireAuth, requireRole('admin'), updateStatusValidation, handleValidationErrors, userController.updateUserStatus);

module.exports = router;
