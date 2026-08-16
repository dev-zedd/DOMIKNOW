const feedbackModel = require('../models/feedbackModel');
const auditLogModel = require('../models/auditLogModel');
const responseHelper = require('../utils/responseHelper');

const feedbackController = {
    async getPublicFeedback(req, res) {
        try {
            const list = await feedbackModel.findPublicFeedback(req.query.limit);
            const publicList = list.map(item => ({
                id: item.id,
                rating: Number(item.rating) || 0,
                feedback: item.feedback_text,
                type: item.feedback_type,
                submitted_at: item.created_at,
                property_name: item.properties?.property_name || 'Verified rental'
            }));
            return responseHelper.success(res, 'Verified public feedback retrieved successfully.', publicList);
        } catch (error) {
            console.error('Get public feedback error:', error);
            return responseHelper.error(res, 'Failed to retrieve public feedback.', error, 500);
        }
    },

    async submitFeedback(req, res) {
        try {
            const { property_id, lease_id, rating, feedback_text, feedback_type } = req.body;
            const tenantId = req.user.id;

            // 1. Validate fields
            if (!property_id || !lease_id || rating === undefined || !feedback_type) {
                return responseHelper.error(res, 'Property ID, lease ID, rating, and feedback type are required.');
            }

            const parsedRating = parseInt(rating);
            if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
                return responseHelper.error(res, 'Rating must be an integer between 1 and 5.');
            }

            const allowedFeedbackTypes = ['property', 'landlord', 'rental_experience'];
            if (!allowedFeedbackTypes.includes(feedback_type)) {
                return responseHelper.error(res, 'Invalid feedback type. Allowed: property, landlord, rental_experience.');
            }

            // 2. Check lease eligibility (active, ended, or terminated)
            const lease = await feedbackModel.checkLeaseEligibility(tenantId, property_id, lease_id);
            if (!lease) {
                return responseHelper.error(res, 'You must have an active or ended lease for this property to submit feedback.');
            }

            // 3. Block duplicates (no duplicate feedback of the same type for the same lease)
            const duplicate = await feedbackModel.checkDuplicateFeedback(tenantId, lease_id, feedback_type);
            if (duplicate) {
                return responseHelper.error(res, 'You have already submitted feedback of this type for this lease agreement.');
            }

            // 4. Create feedback
            const feedback = await feedbackModel.createFeedback({
                tenant_id: tenantId,
                landlord_id: lease.landlord_id,
                property_id,
                lease_id,
                rating: parsedRating,
                feedback_text,
                feedback_type,
                is_authenticated: true,
                status: 'submitted'
            });

            // 5. Log audit
            await auditLogModel.log(tenantId, 'TENANT_SUBMITTED_FEEDBACK', `Tenant submitted feedback ${feedback.id} for property ${property_id}`);

            return responseHelper.success(res, 'Feedback submitted successfully.', feedback, 201);

        } catch (error) {
            console.error('Submit feedback error:', error);
            return responseHelper.error(res, 'Failed to submit feedback.', error, 500);
        }
    },

    async getMyFeedback(req, res) {
        try {
            const list = await feedbackModel.findByTenantId(req.user.id);
            return responseHelper.success(res, 'My feedback retrieved successfully.', list);
        } catch (error) {
            console.error('Get my feedback error:', error);
            return responseHelper.error(res, 'Failed to retrieve feedback.', error, 500);
        }
    },

    async getLandlordFeedback(req, res) {
        try {
            const list = await feedbackModel.findByLandlordId(req.user.id);
            return responseHelper.success(res, 'Feedback for landlord properties retrieved successfully.', list);
        } catch (error) {
            console.error('Get landlord feedback error:', error);
            return responseHelper.error(res, 'Failed to retrieve feedback list.', error, 500);
        }
    },

    async getAdminFeedback(req, res) {
        try {
            const list = await feedbackModel.findAllFeedback();
            return responseHelper.success(res, 'Global feedback retrieved for admin.', list);
        } catch (error) {
            console.error('Get admin feedback error:', error);
            return responseHelper.error(res, 'Failed to retrieve feedback list.', error, 500);
        }
    },

    async updateFeedbackStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const adminId = req.user.id;

            const allowedStatuses = ['submitted', 'visible', 'hidden', 'flagged'];
            if (!allowedStatuses.includes(status)) {
                return responseHelper.error(res, 'Invalid status. Allowed: submitted, visible, hidden, flagged.');
            }

            const updated = await feedbackModel.updateFeedbackStatus(id, status);

            await auditLogModel.log(adminId, 'ADMIN_UPDATED_FEEDBACK_STATUS', `Admin updated feedback status of ${id} to ${status}`);

            return responseHelper.success(res, `Feedback status updated to ${status}.`, updated);

        } catch (error) {
            console.error('Update feedback status error:', error);
            return responseHelper.error(res, 'Failed to update feedback status.', error, 500);
        }
    }
};

module.exports = feedbackController;
