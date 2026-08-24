const express = require('express');
const router = express.Router();
const leaseController = require('../controllers/leaseController');
const requireAuth = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');

router.use(requireAuth);

router.post('/', requireRole('landlord'), leaseController.createLease);
router.get('/', requireRole('landlord'), leaseController.getLandlordLeases);
router.get('/my', requireRole('tenant'), leaseController.getTenantLeases);
router.get('/:id', requireRole('tenant', 'landlord', 'admin'), leaseController.getLeaseById);
router.put('/:id', requireRole('landlord'), leaseController.updateLeaseDetails);
router.put('/:id/status', requireRole('landlord'), leaseController.updateLeaseStatus);
router.put('/:id/accept', requireRole('tenant'), leaseController.acceptLease);
router.put('/:id/reject', requireRole('tenant'), leaseController.rejectLease);
router.put('/:id/respond', requireRole('tenant'), leaseController.respondLease);

module.exports = router;
