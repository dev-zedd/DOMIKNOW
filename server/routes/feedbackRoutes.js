const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');
const requireAuth = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');

router.get('/public/feedback', feedbackController.getPublicFeedback);

router.use(requireAuth);

router.post('/tenant/feedback', requireRole('tenant'), feedbackController.submitFeedback);
router.get('/tenant/feedback/my', requireRole('tenant'), feedbackController.getMyFeedback);
router.get('/landlord/feedback', requireRole('landlord'), feedbackController.getLandlordFeedback);
router.get('/admin/feedback', requireRole('admin'), feedbackController.getAdminFeedback);
router.put('/admin/feedback/:id/status', requireRole('admin'), feedbackController.updateFeedbackStatus);

module.exports = router;
