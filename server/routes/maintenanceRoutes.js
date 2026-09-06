const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenanceController');
const requireAuth = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');

router.use(requireAuth);

// 1. Tenant Operations
router.post('/maintenance/requests', requireRole('tenant'), maintenanceController.createMaintenanceRequest);
router.get('/maintenance/requests/tenant', requireRole('tenant'), maintenanceController.getMyMaintenanceRequests);
router.put('/maintenance/requests/:id/tenant-confirm', requireRole('tenant'), maintenanceController.tenantConfirmRequest);

// 2. Landlord Operations
router.get('/maintenance/requests/landlord', requireRole('landlord'), maintenanceController.getLandlordMaintenanceRequests);
router.put('/maintenance/requests/:id/landlord-respond', requireRole('landlord'), maintenanceController.landlordRespondRequest);
router.put('/maintenance/requests/:id/landlord-assign', requireRole('landlord'), maintenanceController.landlordAssignRequest);
router.put('/maintenance/requests/:id/landlord-verify', requireRole('landlord'), maintenanceController.landlordVerifyCompletion);
router.get('/maintenance/personnel', requireRole('landlord', 'admin'), maintenanceController.getMaintenancePersonnel);
router.post('/maintenance/workers', requireRole('landlord'), maintenanceController.createMaintenanceWorker);
router.delete('/maintenance/workers/:id', requireRole('landlord', 'admin'), maintenanceController.deleteMaintenanceWorker);

// 3. Maintenance Personnel Operations
router.get('/maintenance/requests/worker', requireRole('maintenance'), maintenanceController.getMaintenanceTasks);
router.put('/maintenance/requests/:id/worker-respond', requireRole('maintenance'), maintenanceController.workerRespondJob);
router.put('/maintenance/requests/:id/worker-status', requireRole('maintenance'), maintenanceController.workerUpdateStatus);
router.post('/maintenance/requests/:id/worker-report', requireRole('maintenance'), maintenanceController.workerSubmitReport);

// 4. Shared Operations
router.get('/maintenance/requests/:id', requireRole('tenant', 'landlord', 'maintenance', 'admin'), maintenanceController.getRequestDetails);

module.exports = router;
