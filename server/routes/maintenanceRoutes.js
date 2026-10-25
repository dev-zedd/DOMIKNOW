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
router.post('/maintenance/landlord/requests', requireRole('landlord'), maintenanceController.createLandlordMaintenanceRequest);
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

// 5. Admin Centralized Operations & Operational Cost Monitoring
router.get('/maintenance/admin/overview', requireRole('admin'), maintenanceController.adminGetOverview);
router.get('/maintenance/admin/requests', requireRole('admin'), maintenanceController.adminGetAllRequests);
router.get('/maintenance/admin/workers', requireRole('admin'), maintenanceController.adminGetWorkers);
router.post('/maintenance/admin/workers', requireRole('admin'), maintenanceController.adminCreatePlatformWorker);
router.put('/maintenance/admin/requests/:id/dispatch', requireRole('admin'), maintenanceController.adminDispatchPersonnel);
router.put('/maintenance/admin/requests/:id/set-liability', requireRole('admin'), maintenanceController.adminValidateLiability);

// 6. Personnel Diagnostic Inspection & Quotation
router.post('/maintenance/requests/:id/inspection', requireRole('maintenance'), maintenanceController.workerSubmitInspection);

// 7. Quotation Decision & In-System Payments (Civil Code Art. 1654 / 1657)
router.put('/maintenance/requests/:id/quote-decision', requireRole('tenant', 'landlord', 'admin'), maintenanceController.partyDecideQuote);
router.post('/maintenance/requests/:id/pay', requireRole('tenant', 'landlord', 'admin'), maintenanceController.partyPayMaintenance);

// 8. Admin Maintenance Payment Verification & Oversight
router.get('/maintenance/admin/payments', requireRole('admin'), maintenanceController.adminGetMaintenancePayments);
router.put('/maintenance/admin/payments/:id/verify', requireRole('admin'), maintenanceController.adminVerifyMaintenancePayment);
router.put('/maintenance/admin/payments/:id/reject', requireRole('admin'), maintenanceController.adminRejectMaintenancePayment);

module.exports = router;
