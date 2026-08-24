const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const requireAuth = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');

router.use(requireAuth);

router.post('/', requireRole('landlord'), billingController.createBilling);
router.get('/', requireRole('landlord'), billingController.getLandlordBillings);
router.get('/my', requireRole('tenant'), billingController.getTenantBillings);
router.get('/overdue', requireRole('landlord'), billingController.getLandlordOverdueBillings);
router.get('/overdue/my', requireRole('tenant'), billingController.getTenantOverdueBillings);
router.get('/:id', requireRole('tenant', 'landlord', 'admin'), billingController.getBillingById);
router.put('/:id', requireRole('landlord'), billingController.updateBillingDetails);
router.delete('/:id', requireRole('landlord'), billingController.deleteBilling);

module.exports = router;
