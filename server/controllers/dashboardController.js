const userModel = require('../models/userModel');
const auditLogModel = require('../models/auditLogModel');
const responseHelper = require('../utils/responseHelper');

const dashboardController = {
    async getMe(req, res) {
        try {
            const userId = req.user.id;
            const user = await userModel.findById(userId);

            if (!user) {
                return responseHelper.error(res, 'User not found.', null, 404);
            }

            // Return user details, role, account status
            return responseHelper.success(res, 'Dashboard data retrieved', {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
                account_status: user.account_status,
                is_verified: user.is_verified,
                profile_image_url: user.profile_image_url
            });
        } catch (error) {
            console.error('Dashboard error:', error);
            return responseHelper.error(res, 'Failed to fetch dashboard data', error, 500);
        }
    }
};

module.exports = dashboardController;
