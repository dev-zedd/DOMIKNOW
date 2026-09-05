const userModel = require('../models/userModel');
const auditLogModel = require('../models/auditLogModel');
const responseHelper = require('../utils/responseHelper');
const cache = require('../utils/cacheHelper');

const TTL = { profile: 300 }; // User profile – 5 min

const dashboardController = {
    async getMe(req, res) {
        try {
            const userId = req.user.id;
            const role = req.user.role;

            // Cache profile for landlord (and all roles – keyed by userId so no cross-user risk)
            const cacheKey = `dashboard:${userId}:me`;
            const cached = cache.get(cacheKey);
            if (cached) {
                return responseHelper.success(res, 'Dashboard data retrieved', cached);
            }

            const user = await userModel.findById(userId);

            if (!user) {
                return responseHelper.error(res, 'User not found.', null, 404);
            }

            const payload = {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
                account_status: user.account_status,
                is_verified: user.is_verified,
                profile_image_url: user.profile_image_url
            };

            cache.set(cacheKey, payload, TTL.profile);

            // Return user details, role, account status
            return responseHelper.success(res, 'Dashboard data retrieved', payload);
        } catch (error) {
            console.error('Dashboard error:', error);
            return responseHelper.error(res, 'Failed to fetch dashboard data', error, 500);
        }
    }
};

module.exports = dashboardController;
