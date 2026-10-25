const ratingsModel = require('../models/ratingsModel');
const auditLogModel = require('../models/auditLogModel');
const responseHelper = require('../utils/responseHelper');

const EDIT_WINDOW_DAYS = 7;

const ratingsController = {
    // ── Tenant: Get eligible leases (with rated flag) ─────────────────────
    async getEligibleLeases(req, res) {
        try {
            const leases = await ratingsModel.findEligibleLeasesByTenant(req.user.id);
            return responseHelper.success(res, 'Eligible leases retrieved.', leases);
        } catch (error) {
            console.error('Get eligible leases error:', error);
            return responseHelper.error(res, 'Failed to fetch eligible leases.', error, 500);
        }
    },

    // ── Tenant: Submit rating ──────────────────────────────────────────────
    async submitRating(req, res) {
        try {
            const { lease_id, rating, feedback } = req.body;
            const tenantId = req.user.id;

            // 1. Validate fields
            if (!lease_id || rating === undefined || !feedback) {
                return responseHelper.error(res, 'Lease ID, rating, and feedback are required.');
            }

            const parsedRating = parseInt(rating);
            if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
                return responseHelper.error(res, 'Rating must be between 1 and 5.');
            }

            if (feedback.trim().length < 10) {
                return responseHelper.error(res, 'Feedback must be at least 10 characters.');
            }

            // 2. Check lease eligibility
            const lease = await ratingsModel.findEligibleLease(tenantId, lease_id);
            if (!lease) {
                return responseHelper.error(res, 'You can only rate ended, terminated, or completed leases you are a party to.');
            }

            // 3. Block duplicate
            const existing = await ratingsModel.findExistingRating(tenantId, lease_id);
            if (existing) {
                return responseHelper.error(res, 'You have already submitted a rating for this lease contract.');
            }

            // 4. Create rating
            const result = await ratingsModel.createRating({
                lease_id,
                tenant_id: tenantId,
                landlord_id: lease.landlord_id,
                property_id: lease.property_id,
                rating: parsedRating,
                feedback: feedback.trim()
            });

            // 5. Recalculate property average
            await ratingsModel.recalculatePropertyRating(lease.property_id);

            await auditLogModel.log(tenantId, 'SUBMIT_LANDLORD_RATING', `Tenant submitted rating ${result.id} for lease ${lease_id}`);
            return responseHelper.success(res, 'Rating submitted successfully. Thank you for your feedback!', result, 201);

        } catch (error) {
            console.error('Submit rating error:', error);
            return responseHelper.error(res, 'Failed to submit rating.', error, 500);
        }
    },

    // ── Tenant: Get my submitted ratings ──────────────────────────────────
    async getMyRatings(req, res) {
        try {
            const list = await ratingsModel.findByTenantId(req.user.id);
            return responseHelper.success(res, 'Your ratings retrieved.', list);
        } catch (error) {
            console.error('Get my ratings error:', error);
            return responseHelper.error(res, 'Failed to retrieve ratings.', error, 500);
        }
    },

    // ── Tenant: Get single rating details ─────────────────────────────────
    async getRatingById(req, res) {
        try {
            const { id } = req.params;
            const rating = await ratingsModel.findById(id);

            if (!rating) {
                return responseHelper.error(res, 'Rating not found.', null, 404);
            }

            // Ownership check
            if (rating.tenant_id !== req.user.id) {
                return responseHelper.error(res, 'Access denied.', null, 403);
            }

            return responseHelper.success(res, 'Rating details retrieved.', rating);
        } catch (error) {
            console.error('Get rating by ID error:', error);
            return responseHelper.error(res, 'Failed to fetch rating details.', error, 500);
        }
    },

    // ── Tenant: Edit rating (within 7-day window) ─────────────────────────
    async editRating(req, res) {
        try {
            const { id } = req.params;
            const { rating, feedback } = req.body;
            const tenantId = req.user.id;

            const existing = await ratingsModel.findById(id);
            if (!existing) {
                return responseHelper.error(res, 'Rating not found.', null, 404);
            }

            if (existing.tenant_id !== tenantId) {
                return responseHelper.error(res, 'Access denied.', null, 403);
            }

            // Allow tenant to edit rating and feedback anytime

            const updates = {};
            if (rating !== undefined) {
                const parsedRating = parseInt(rating);
                if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
                    return responseHelper.error(res, 'Rating must be between 1 and 5.');
                }
                updates.rating = parsedRating;
            }
            if (feedback) {
                if (feedback.trim().length < 10) {
                    return responseHelper.error(res, 'Feedback must be at least 10 characters.');
                }
                updates.feedback = feedback.trim();
            }

            const updated = await ratingsModel.updateRating(id, tenantId, updates);
            await ratingsModel.recalculatePropertyRating(existing.property_id);

            await auditLogModel.log(tenantId, 'EDIT_LANDLORD_RATING', `Tenant edited rating ${id}`);
            return responseHelper.success(res, 'Rating updated successfully.', updated);

        } catch (error) {
            console.error('Edit rating error:', error);
            return responseHelper.error(res, 'Failed to update rating.', error, 500);
        }
    },

    // ── Landlord: View ratings received ───────────────────────────────────
    async getLandlordRatings(req, res) {
        try {
            const list = await ratingsModel.findByLandlordId(req.user.id);
            return responseHelper.success(res, 'Ratings received retrieved.', list);
        } catch (error) {
            console.error('Get landlord ratings error:', error);
            return responseHelper.error(res, 'Failed to retrieve ratings.', error, 500);
        }
    }
};

module.exports = ratingsController;
