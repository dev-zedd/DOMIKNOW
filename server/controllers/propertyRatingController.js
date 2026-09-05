const propertyRatingModel = require('../models/propertyRatingModel');
const userModel = require('../models/userModel');
const auditLogModel = require('../models/auditLogModel');
const notificationModel = require('../models/notificationModel');
const responseHelper = require('../utils/responseHelper');
const cache = require('../utils/cacheHelper');

const TTL = { propertyRatings: 120 }; // Landlord property ratings – 2 min

const EDIT_WINDOW_DAYS = 7;

const propertyRatingController = {
    // Get eligible leases for rating
    async getEligibleLeases(req, res) {
        try {
            const tenantId = req.user.id;
            const user = await userModel.findById(tenantId);
            if (!user || !user.is_verified || user.account_status !== 'active') {
                return responseHelper.success(res, 'Eligible leases for property rating retrieved.', []);
            }
            const leases = await propertyRatingModel.findEligibleLeasesByTenant(tenantId);
            return responseHelper.success(res, 'Eligible leases for property rating retrieved.', leases);
        } catch (error) {
            console.error('Get eligible leases for property rating error:', error);
            return responseHelper.error(res, 'Failed to fetch eligible leases.', error, 500);
        }
    },

    // Submit property rating
    async submitPropertyRating(req, res) {
        try {
            const { 
                lease_id, 
                cleanliness, 
                safety, 
                comfort, 
                amenities, 
                location, 
                internet_availability, 
                water_supply, 
                electricity_reliability, 
                noise_level, 
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
                cleanliness, 
                safety, 
                comfort, 
                amenities, 
                location, 
                internet_availability, 
                water_supply, 
                electricity_reliability, 
                noise_level, 
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
            const lease = await propertyRatingModel.findEligibleLease(tenantId, lease_id);
            if (!lease) {
                return responseHelper.error(res, 'You can only rate properties under active, ended, terminated, or completed leases you are a party to.');
            }

            // 3. Block duplicate
            const existing = await propertyRatingModel.findExistingRating(tenantId, lease_id);
            if (existing) {
                return responseHelper.error(res, 'You have already submitted a property rating for this lease contract.');
            }

            // 4. Create property rating
            const ratingData = {
                lease_id,
                tenant_id: tenantId,
                landlord_id: lease.landlord_id,
                property_id: lease.property_id,
                cleanliness: parseInt(cleanliness),
                safety: parseInt(safety),
                comfort: parseInt(comfort),
                amenities: parseInt(amenities),
                location: parseInt(location),
                internet_availability: parseInt(internet_availability),
                water_supply: parseInt(water_supply),
                electricity_reliability: parseInt(electricity_reliability),
                noise_level: parseInt(noise_level),
                overall_satisfaction: parseInt(overall_satisfaction),
                feedback: feedback.trim()
            };

            const result = await propertyRatingModel.createRating(ratingData);

            // 5. Recalculate property average rating
            await propertyRatingModel.recalculatePropertyRating(lease.property_id);

            // 6. Write Audit Log
            await auditLogModel.log(tenantId, 'SUBMIT_PROPERTY_RATING', `Tenant submitted property rating ${result.id} for lease ${lease_id}`);

            await notificationModel.create({
                user_id: lease.landlord_id,
                type: 'property_rating_received',
                title: 'New property rating',
                message: 'A tenant submitted a verified rating for one of your properties.',
                reference_id: result.id
            });

            // Invalidate landlord's property ratings cache so new rating appears
            cache.invalidateLandlord(lease.landlord_id, 'propertyRatings');

            return responseHelper.success(res, 'Property rating submitted successfully. Thank you!', result, 201);

        } catch (error) {
            console.error('Submit property rating error:', error);
            return responseHelper.error(res, 'Failed to submit property rating.', error, 500);
        }
    },

    // Get tenant's submitted property ratings
    async getMyPropertyRatings(req, res) {
        try {
            const list = await propertyRatingModel.findByTenantId(req.user.id);
            return responseHelper.success(res, 'Your property ratings retrieved.', list);
        } catch (error) {
            console.error('Get my property ratings error:', error);
            return responseHelper.error(res, 'Failed to retrieve property ratings.', error, 500);
        }
    },

    // Get rating by ID
    async getPropertyRatingById(req, res) {
        try {
            const { id } = req.params;
            const rating = await propertyRatingModel.findById(id);

            if (!rating) {
                return responseHelper.error(res, 'Property rating not found.', null, 404);
            }

            // Ownership check (only tenant who submitted or the landlord of the property can view details)
            if (rating.tenant_id !== req.user.id && rating.landlord_id !== req.user.id) {
                return responseHelper.error(res, 'Access denied.', null, 403);
            }

            return responseHelper.success(res, 'Property rating details retrieved.', rating);
        } catch (error) {
            console.error('Get property rating details error:', error);
            return responseHelper.error(res, 'Failed to fetch rating details.', error, 500);
        }
    },

    // Edit property rating within edit window (7 days)
    async editPropertyRating(req, res) {
        try {
            const { id } = req.params;
            const { 
                cleanliness, 
                safety, 
                comfort, 
                amenities, 
                location, 
                internet_availability, 
                water_supply, 
                electricity_reliability, 
                noise_level, 
                overall_satisfaction,
                feedback 
            } = req.body;
            const tenantId = req.user.id;

            const existing = await propertyRatingModel.findById(id);
            if (!existing) {
                return responseHelper.error(res, 'Property rating not found.', null, 404);
            }

            if (existing.tenant_id !== tenantId) {
                return responseHelper.error(res, 'Access denied.', null, 403);
            }

            // Allow tenant to edit property rating anytime

            const updates = {};
            const criteria = {
                cleanliness, 
                safety, 
                comfort, 
                amenities, 
                location, 
                internet_availability, 
                water_supply, 
                electricity_reliability, 
                noise_level, 
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

            const updated = await propertyRatingModel.updateRating(id, tenantId, updates);
            await propertyRatingModel.recalculatePropertyRating(existing.property_id);

            // Invalidate landlord's property ratings cache
            cache.invalidateLandlord(existing.landlord_id, 'propertyRatings');

            await auditLogModel.log(tenantId, 'EDIT_PROPERTY_RATING', `Tenant edited property rating ${id}`);
            return responseHelper.success(res, 'Property rating updated successfully.', updated);

        } catch (error) {
            console.error('Edit property rating error:', error);
            return responseHelper.error(res, 'Failed to update property rating.', error, 500);
        }
    },

    // Landlord: Get ratings received for their properties
    async getLandlordPropertyRatings(req, res) {
        try {
            const landlordId = req.user.id;
            const cacheKey   = cache.landlordKey(landlordId, 'propertyRatings');

            const cached = cache.get(cacheKey);
            if (cached) {
                return responseHelper.success(res, 'Received property ratings retrieved.', cached);
            }

            const list = await propertyRatingModel.findByLandlordId(landlordId);
            cache.set(cacheKey, list, TTL.propertyRatings);
            return responseHelper.success(res, 'Received property ratings retrieved.', list);
        } catch (error) {
            console.error('Get landlord property ratings error:', error);
            return responseHelper.error(res, 'Failed to retrieve property ratings.', error, 500);
        }
    }
};

module.exports = propertyRatingController;
