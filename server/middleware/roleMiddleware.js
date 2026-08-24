const responseHelper = require('../utils/responseHelper');
const requireAuth = require('./authMiddleware');

/**
 * Middleware to check if the authenticated user has the required role
 * @param  {...string} allowedRoles - List of roles permitted to access the route
 */
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        const authorize = () => {
            if (!req.user?.role) {
                return responseHelper.error(res, 'User role not found. Authentication required.', null, 401);
            }

            if (!allowedRoles.includes(req.user.role)) {
                return responseHelper.error(res, 'Access denied. Insufficient permissions.', null, 403);
            }

            return next();
        };

        // Some route modules use requireRole as their complete protection layer,
        // while others explicitly place requireAuth before it. Authenticate here
        // only when a previous middleware has not already populated req.user.
        if (req.user?.role) return authorize();
        return requireAuth(req, res, authorize);
    };
};

module.exports = requireRole;
