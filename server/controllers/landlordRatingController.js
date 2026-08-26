const landlordRatingModel = require('../models/landlordRatingModel');
const userModel = require('../models/userModel');
const auditLogModel = require('../models/auditLogModel');
const notificationModel = require('../models/notificationModel');
const responseHelper = require('../utils/responseHelper');

const EDIT_WINDOW_DAYS = 7;

const landlordRatingController = {
    // Get eligible leases for rating
    async getEligibleLeases(req, res) {
        try {
            const tenantId = req.user.id;
            const user = await userModel.findById(tenantId);
            if (!user || !user.is_verified || user.account_status !== 'active') {
                return responseHelper.success(res, 'Eligible leases for landlord rating retrieved.', []);
            }
            const leases = await landlordRatingModel.findEligibleLeasesByTenant(tenantId);
            return responseHelper.success(res, 'Eligible leases for landlord rating retrieved.', leases);
        } catch (error) {
            console.error('Get eligible leases for landlord rating error:', error);
            return responseHelper.error(res, 'Failed to fetch eligible leases.', error, 500);
        }
    },

    // Submit landlord rating
    async submitLandlordRating(req, res) {
        try {
            const { 
                lease_id, 
                communication, 
                responsiveness, 
                professionalism, 
                fairness, 
                maintenance_response, 
                respectfulness, 
                reliability, 
                overall_satisfaction,
                feedback 
            } = req.body;
            const tenantId = req.user.id;

            // 0. Verify tenant is verified and active
            const user = await userModel.findById(tenantId);
            if (!user || !user.is_verified || user.account_status !== 'active') {
                return responseHelper.error(res, 'Only verified tenants who actually rented the property can submit ratings.', null, 403);
            }

            // 1. Validate fields
            if (!lease_id || !feedback) {
                return responseHelper.error(res, 'Lease ID and feedback are required.');
            }

            const criteria = {
                communication, 
                responsiveness, 
                professionalism, 
                fairness, 
                maintenance_response, 
                respectfulness, 
                reliability, 
                overall_satisfaction
            };

            for (const [key, val] of Object.entries(criteria)) {
                if (val === undefined || val === null) {
                    return responseHelper.error(res, `${key.replace('_', ' ')} is required.`);
                }
                const parsedVal = parseInt(val);
                if (isNaN(parsedVal) || parsedVal < 1 || parsedVal > 5) {
                    return responseHelper.error(res, `${key.replace('_', ' ')} rating must be between 1 and 5.`);
                }
            }

            if (feedback.trim().length < 10) {
                return responseHelper.error(res, 'Feedback must be at least 10 characters.');
            }

            // 2. Check lease eligibility
            const lease = await landlordRatingModel.findEligibleLease(tenantId, lease_id);
            if (!lease) {
                return responseHelper.error(res, 'You can only rate landlords under active, ended, terminated, or completed leases you are a party to.');
            }

            // 3. Block duplicate
            const existing = await landlordRatingModel.findExistingRating(tenantId, lease_id);
            if (existing) {
                return responseHelper.error(res, 'You have already submitted a landlord rating for this lease contract.');
            }

            // 4. Create landlord rating
            const ratingData = {
                lease_id,
                tenant_id: tenantId,
                landlord_id: lease.landlord_id,
                property_id: lease.property_id,
                communication: parseInt(communication),
                responsiveness: parseInt(responsiveness),
                professionalism: parseInt(professionalism),
                fairness: parseInt(fairness),
                maintenance_response: parseInt(maintenance_response),
                respectfulness: parseInt(respectfulness),
                reliability: parseInt(reliability),
                overall_satisfaction: parseInt(overall_satisfaction),
                feedback: feedback.trim()
            };

            const result = await landlordRatingModel.createRating(ratingData);

            // 5. Recalculate landlord average rating
            await landlordRatingModel.recalculateLandlordRating(lease.landlord_id);

            // 6. Write Audit Log
            await auditLogModel.log(tenantId, 'SUBMIT_LANDLORD_RATING', `Tenant submitted landlord rating ${result.id} for lease ${lease_id}`);

            await notificationModel.create({
                user_id: lease.landlord_id,
                type: 'landlord_rating_received',
                title: 'New landlord rating',
                message: 'A tenant submitted a verified rating about their rental experience with you.',
                reference_id: result.id
            });

            return responseHelper.success(res, 'Landlord rating submitted successfully. Thank you!', result, 201);

        } catch (error) {
            console.error('Submit landlord rating error:', error);
            return responseHelper.error(res, 'Failed to submit landlord rating.', error, 500);
        }
    },

    // Get tenant's submitted landlord ratings
    async getMyLandlordRatings(req, res) {
        try {
            const list = await landlordRatingModel.findByTenantId(req.user.id);
            return responseHelper.success(res, 'Your landlord ratings retrieved.', list);
        } catch (error) {
            console.error('Get my landlord ratings error:', error);
            return responseHelper.error(res, 'Failed to retrieve landlord ratings.', error, 500);
        }
    },

    // Get rating by ID
    async getLandlordRatingById(req, res) {
        try {
            const { id } = req.params;
            const rating = await landlordRatingModel.findById(id);

            if (!rating) {
                return responseHelper.error(res, 'Landlord rating not found.', null, 404);
            }

            // Ownership check (only tenant who submitted or the landlord who is rated can view details)
            if (rating.tenant_id !== req.user.id && rating.landlord_id !== req.user.id) {
                return responseHelper.error(res, 'Access denied.', null, 403);
            }

            return responseHelper.success(res, 'Landlord rating details retrieved.', rating);
        } catch (error) {
            console.error('Get landlord rating details error:', error);
            return responseHelper.error(res, 'Failed to fetch rating details.', error, 500);
        }
    },

    // Edit landlord rating within edit window (7 days)
    async editLandlordRating(req, res) {
        try {
            const { id } = req.params;
            const { 
                communication, 
                responsiveness, 
                professionalism, 
                fairness, 
                maintenance_response, 
                respectfulness, 
                reliability, 
                overall_satisfaction,
                feedback 
            } = req.body;
            const tenantId = req.user.id;

            const existing = await landlordRatingModel.findById(id);
            if (!existing) {
                return responseHelper.error(res, 'Landlord rating not found.', null, 404);
            }

            if (existing.tenant_id !== tenantId) {
                return responseHelper.error(res, 'Access denied.', null, 403);
            }

            // Allow tenant to edit landlord rating anytime

            const updates = {};
            const criteria = {
                communication, 
                responsiveness, 
                professionalism, 
                fairness, 
                maintenance_response, 
                respectfulness, 
                reliability, 
                overall_satisfaction
            };

            for (const [key, val] of Object.entries(criteria)) {
                if (val !== undefined) {
                    const parsedVal = parseInt(val);
                    if (isNaN(parsedVal) || parsedVal < 1 || parsedVal > 5) {
                        return responseHelper.error(res, `${key.replace('_', ' ')} must be between 1 and 5.`);
                    }
                    updates[key] = parsedVal;
                }
            }

            if (feedback !== undefined) {
                if (feedback.trim().length < 10) {
                    return responseHelper.error(res, 'Feedback must be at least 10 characters.');
                }
                updates.feedback = feedback.trim();
            }

            if (Object.keys(updates).length === 0) {
                return responseHelper.error(res, 'No update parameters provided.');
            }

            const updated = await landlordRatingModel.updateRating(id, tenantId, updates);
            await landlordRatingModel.recalculateLandlordRating(existing.landlord_id);

            await auditLogModel.log(tenantId, 'EDIT_LANDLORD_RATING', `Tenant edited landlord rating ${id}`);
            return responseHelper.success(res, 'Landlord rating updated successfully.', updated);

        } catch (error) {
            console.error('Edit landlord rating error:', error);
            return responseHelper.error(res, 'Failed to update landlord rating.', error, 500);
        }
    },

    // Landlord: Get ratings received
    async getLandlordReceivedRatings(req, res) {
        try {
            const list = await landlordRatingModel.findByLandlordId(req.user.id);
            return responseHelper.success(res, 'Received landlord ratings retrieved.', list);
        } catch (error) {
            console.error('Get landlord received ratings error:', error);
            return responseHelper.error(res, 'Failed to retrieve landlord ratings.', error, 500);
        }
    }
};

module.exports = landlordRatingController;
