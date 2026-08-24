const express = require('express');
const router = express.Router();
const { query, body, param } = require('express-validator');
const propertyController = require('../controllers/propertyController');
const requireAuth = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');
const handleValidationErrors = require('../middleware/validationMiddleware');

// Validation rules for property search
const searchValidation = [
    query('search').optional().trim().isLength({ max: 255 }).withMessage('Search term too long'),
    query('barangay').optional().trim().isLength({ max: 100 }).withMessage('Barangay name too long'),
    query('property_type').optional().isIn([
        'apartment', 'boarding_house', 'bedspace', 'studio_unit', 'room_for_rent', 'house'
    ]).withMessage('Invalid property type'),

    query('tenant_type').optional().isIn(['student', 'worker', 'family', 'general']).withMessage('Invalid tenant type'),
    query('min_price').optional().isFloat({ min: 0 }).withMessage('Minimum price must be a positive number'),
    query('max_price').optional().isFloat({ min: 0 }).withMessage('Maximum price must be a positive number'),
    query('min_rating').optional().isFloat({ min: 0, max: 5 }).withMessage('Rating must be between 0 and 5'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('sort').optional().isIn(['price_asc', 'price_desc', 'rating_desc', 'newest']).withMessage('Invalid sort option')
];

const propertyIdValidation = [
    param('id').isUUID().withMessage('Invalid property ID format')
];

const compareValidation = [
    body('property_ids').isArray({ min: 2, max: 4 }).withMessage('Must provide 2-4 property IDs for comparison'),
    body('property_ids.*').isUUID().withMessage('Invalid property ID format')
];

// PUBLIC ROUTES - No authentication required for browsing approved properties
// Property Discovery API (PUBLIC - anyone can browse)
router.get('/', searchValidation, handleValidationErrors, propertyController.getAllProperties);

// Property Details API (PUBLIC - anyone can view details)
router.get('/:id', propertyIdValidation, handleValidationErrors, propertyController.getPropertyById);

// Tenant-only Multi-Criteria Property Recommendation (MC-REC-v1.0).
// Public GIS discovery remains available through GET /api/properties.
router.get('/recommendations/ranked', requireAuth, requireRole('tenant'), propertyController.getRecommended);
router.get('/recommendations/personalized', requireAuth, requireRole('tenant'), propertyController.getRecommended);

// Property Comparison API (Authenticated users)
router.post('/compare', requireAuth, compareValidation, handleValidationErrors, propertyController.compareProperties);

module.exports = router;
