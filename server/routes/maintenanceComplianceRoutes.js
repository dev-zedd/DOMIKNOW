const express = require('express');
const router = express.Router();
const maintenanceComplianceController = require('../controllers/maintenanceComplianceController');
const requireAuth = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');

// ── Public Routes (Onboarding & Activation) ─────────────────────────────────
router.post('/maintenance/set-password', maintenanceComplianceController.verifyInviteAndSetPassword);
router.post('/admin/maintenance/verify-invite', maintenanceComplianceController.verifyInviteAndSetPassword);

// ── Authenticated Routes ────────────────────────────────────────────────────
// 1. Admin Maintenance Onboarding & Global Pool
router.post('/admin/maintenance/create-user', requireAuth, requireRole('admin'), maintenanceComplianceController.createUser);
router.post('/admin/maintenance/send-invite', requireAuth, requireRole('admin'), maintenanceComplianceController.sendInvite);
router.get('/admin/maintenance/assignment-eligibility/:userId', requireAuth, requireRole('admin', 'landlord'), maintenanceComplianceController.getAssignmentEligibility);
router.get('/admin/maintenance/pool', requireAuth, requireRole('admin', 'landlord'), maintenanceComplianceController.getGlobalPool);

// 2. Global Maintenance Pool & Assignment
router.get('/maintenance/eligible-staff', requireAuth, requireRole('admin', 'landlord'), maintenanceComplianceController.getEligibleStaff);
router.post('/maintenance/assign', requireAuth, requireRole('admin', 'landlord'), maintenanceComplianceController.assignTechnician);

// 3. Maintenance Personnel Profile & Compliance
router.post('/maintenance/profile', requireAuth, requireRole('maintenance', 'admin'), maintenanceComplianceController.completeProfile);
router.get('/maintenance/my-compliance', requireAuth, requireRole('maintenance'), maintenanceComplianceController.getMyCompliance);

// 4. Screening Requirements & Records Management
router.get('/maintenance/screening/requirements', requireAuth, maintenanceComplianceController.getScreeningRequirements);
router.post('/maintenance/screening/requirements', requireAuth, requireRole('admin'), maintenanceComplianceController.upsertScreeningRequirement);
router.get('/maintenance/screening/records', requireAuth, requireRole('admin'), maintenanceComplianceController.getAllScreeningRecords);
router.post('/maintenance/screening/submit', requireAuth, requireRole('maintenance', 'admin'), maintenanceComplianceController.submitScreening);
router.post('/maintenance/screening/review', requireAuth, requireRole('admin'), maintenanceComplianceController.reviewScreening);

// 5. Maintenance Access Management
router.post('/maintenance/access/update', requireAuth, requireRole('admin'), maintenanceComplianceController.updateAccess);

// Aliases for developer / client convenience
router.get('/maintenance/pool', requireAuth, requireRole('admin', 'landlord'), maintenanceComplianceController.getGlobalPool);
router.get('/maintenance/assignment-eligibility/:userId', requireAuth, requireRole('admin', 'landlord'), maintenanceComplianceController.getAssignmentEligibility);
router.get('/admin/maintenance/open-requests', requireAuth, requireRole('admin', 'landlord'), maintenanceComplianceController.getOpenRequests);

module.exports = router;
