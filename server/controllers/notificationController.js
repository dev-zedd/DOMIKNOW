const notificationModel = require('../models/notificationModel');
const responseHelper = require('../utils/responseHelper');

const notificationController = {
    /**
     * GET /api/notifications/my
     * Get all notifications for the logged-in user.
     */
    async getMyNotifications(req, res) {
        try {
            const userId = req.user.id;
            const notifications = await notificationModel.findByUserId(userId);

            const unreadCount = notifications.filter(n => !n.read_status).length;

            return responseHelper.success(res, 'Notifications retrieved successfully.', {
                notifications,
                unreadCount
            });
        } catch (error) {
            console.error('[notificationController] getMyNotifications error:', error);
            return responseHelper.error(res, 'Failed to retrieve notifications.', error, 500);
        }
    },

    /**
     * PUT /api/notifications/:id/read
     * Mark a single notification as read
     */
    async markAsRead(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            const updated = await notificationModel.markAsRead(id, userId);
            return responseHelper.success(res, 'Notification marked as read.', updated);
        } catch (error) {
            console.error('[notificationController] markAsRead error:', error);
            return responseHelper.error(res, 'Failed to mark notification as read.', error, 500);
        }
    },

    /**
     * PUT /api/notifications/read-all
     * Mark all notifications for logged-in user as read
     */
    async markAllRead(req, res) {
        try {
            const userId = req.user.id;
            await notificationModel.markAllRead(userId);
            return responseHelper.success(res, 'All notifications marked as read.');
        } catch (error) {
            console.error('[notificationController] markAllRead error:', error);
            return responseHelper.error(res, 'Failed to mark all notifications as read.', error, 500);
        }
    },

    /**
     * DELETE /api/notifications/:id
     * Delete a single notification explicitly by user action
     */
    async deleteNotification(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            await notificationModel.delete(id, userId);
            return responseHelper.success(res, 'Notification deleted successfully.');
        } catch (error) {
            console.error('[notificationController] deleteNotification error:', error);
            return responseHelper.error(res, 'Failed to delete notification.', error, 500);
        }
    }
};

module.exports = notificationController;
