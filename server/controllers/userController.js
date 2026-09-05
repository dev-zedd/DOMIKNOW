const bcrypt = require('bcrypt');
const userModel = require('../models/userModel');
const auditLogModel = require('../models/auditLogModel');
const notificationModel = require('../models/notificationModel');
const responseHelper = require('../utils/responseHelper');
const { uploadFile, deleteFile } = require('../utils/storageHelper');
const cache = require('../utils/cacheHelper');

const TTL = { profile: 300 }; // Profile – 5 min
const profileKey = (userId) => `user:${userId}:profile`;

function matchesImageSignature(buffer, mimeType) {
    if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
        return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }
    if (mimeType === 'image/png') {
        return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
    }
    if (mimeType === 'image/webp') {
        return buffer.length >= 12
            && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
            && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    }
    return false;
}

const userController = {
    async getProfile(req, res) {
        try {
            const userId = req.user.id;
            const cacheKey = profileKey(userId);
            const cached = cache.get(cacheKey);
            if (cached) {
                return responseHelper.success(res, 'Profile retrieved', cached);
            }

            const user = await userModel.findById(userId);
            if (!user) {
                return responseHelper.error(res, 'User not found', null, 404);
            }

            cache.set(cacheKey, user, TTL.profile);
            return responseHelper.success(res, 'Profile retrieved', user);
        } catch (error) {
            console.error('Get profile error:', error);
            return responseHelper.error(res, 'Failed to fetch profile', error, 500);
        }
    },

    async updateProfile(req, res) {
        try {
            // Only allow updating specific fields
            const { full_name, contact_number, address } = req.body;
            
            const updatedUser = await userModel.updateProfile(req.user.id, {
                full_name,
                contact_number: contact_number === '' ? null : contact_number,
                address: address === '' ? null : address
            });

            await auditLogModel.log(req.user.id, 'PROFILE_UPDATE', 'User updated their profile.');

            // Invalidate profile and dashboard caches
            cache.del(profileKey(req.user.id));
            cache.del(`dashboard:${req.user.id}:me`);

            return responseHelper.success(res, 'Profile updated successfully', updatedUser);
        } catch (error) {
            console.error('Update profile error:', error);
            return responseHelper.error(res, 'Failed to update profile', error, 500);
        }
    },

    async uploadProfileImage(req, res) {
        try {
            const { base64_content, mime_type, file_size } = req.body;
            const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

            if (!base64_content || !mime_type || !file_size) {
                return responseHelper.error(res, 'Profile image data, type, and size are required.');
            }
            if (!allowedMimeTypes.includes(mime_type)) {
                return responseHelper.error(res, 'Profile photo must be a JPG, PNG, or WEBP image.');
            }

            const parsedSize = Number(file_size);
            const encodedContent = String(base64_content).replace(/^data:.*?;base64,/, '');
            const imageBuffer = Buffer.from(encodedContent, 'base64');
            const decodedSize = imageBuffer.length;
            if (!Number.isFinite(parsedSize) || parsedSize <= 0 || parsedSize > 3 * 1024 * 1024
                || decodedSize <= 0 || decodedSize > 3 * 1024 * 1024) {
                return responseHelper.error(res, 'Profile photo must be smaller than 3 MB.');
            }
            if (!matchesImageSignature(imageBuffer, mime_type)) {
                return responseHelper.error(res, 'The uploaded file does not match the selected image type.');
            }

            const storagePath = `users/${req.user.id}/avatar`;
            const uploadResult = await uploadFile('profile-images', storagePath, base64_content, mime_type);
            const separator = uploadResult.url.includes('?') ? '&' : '?';
            const versionedUrl = `${uploadResult.url}${separator}v=${Date.now()}`;
            const updatedUser = await userModel.updateProfile(req.user.id, {
                profile_image_url: versionedUrl
            });

            await auditLogModel.log(req.user.id, 'PROFILE_IMAGE_UPDATE', 'User updated their profile photo.');

            // Invalidate profile and dashboard caches
            cache.del(profileKey(req.user.id));
            cache.del(`dashboard:${req.user.id}:me`);

            return responseHelper.success(res, 'Profile photo updated successfully', updatedUser);
        } catch (error) {
            console.error('Upload profile image error:', error);
            return responseHelper.error(res, 'Failed to update profile photo', error, 500);
        }
    },

    async removeProfileImage(req, res) {
        try {
            await deleteFile('profile-images', `users/${req.user.id}/avatar`);
            const updatedUser = await userModel.updateProfile(req.user.id, {
                profile_image_url: null
            });
            await auditLogModel.log(req.user.id, 'PROFILE_IMAGE_REMOVE', 'User removed their profile photo.');

            // Invalidate profile and dashboard caches
            cache.del(profileKey(req.user.id));
            cache.del(`dashboard:${req.user.id}:me`);

            return responseHelper.success(res, 'Profile photo removed successfully', updatedUser);
        } catch (error) {
            console.error('Remove profile image error:', error);
            return responseHelper.error(res, 'Failed to remove profile photo', error, 500);
        }
    },

    async changePassword(req, res) {
        try {
            const { current_password, new_password } = req.body;
            const credentials = await userModel.findCredentialsById(req.user.id);
            if (!credentials) {
                return responseHelper.error(res, 'User account not found.', null, 404);
            }

            const currentPasswordMatches = await bcrypt.compare(current_password, credentials.password_hash);
            if (!currentPasswordMatches) {
                await auditLogModel.log(req.user.id, 'PASSWORD_CHANGE_FAILED', 'Current password did not match.');
                return responseHelper.error(res, 'Current password is incorrect.', null, 400);
            }

            const isSamePassword = await bcrypt.compare(new_password, credentials.password_hash);
            if (isSamePassword) {
                return responseHelper.error(res, 'Choose a new password that is different from your current password.');
            }

            const passwordHash = await bcrypt.hash(new_password, 12);
            await userModel.updatePassword(req.user.id, passwordHash);
            await auditLogModel.log(req.user.id, 'PASSWORD_CHANGE_SUCCESS', 'User changed their password from the profile module.');
            await notificationModel.create({
                user_id: req.user.id,
                type: 'security_update',
                title: 'Password changed',
                message: 'Your DOMIKNOW password was changed successfully. If this was not you, contact platform support immediately.',
                reference_id: null
            });

            return responseHelper.success(res, 'Password changed successfully.');
        } catch (error) {
            console.error('Change password error:', error);
            return responseHelper.error(res, 'Failed to change password', error, 500);
        }
    },

    // Admin routes
    async getAllUsers(req, res) {
        try {
            const users = await userModel.getAllUsers();
            return responseHelper.success(res, 'Users retrieved', users);
        } catch (error) {
            console.error('Get all users error:', error);
            return responseHelper.error(res, 'Failed to fetch users', error, 500);
        }
    },

    async getUserById(req, res) {
        try {
            const { id } = req.params;
            const user = await userModel.findById(id);
            if (!user) {
                return responseHelper.error(res, 'User not found', null, 404);
            }
            return responseHelper.success(res, 'User retrieved', user);
        } catch (error) {
            console.error('Get user by id error:', error);
            return responseHelper.error(res, 'Failed to fetch user', error, 500);
        }
    },

    async updateUserStatus(req, res) {
        try {
            const { id } = req.params;
            const { account_status } = req.body;

            const allowedStatuses = ['active', 'disabled', 'rejected', 'pending'];
            if (!allowedStatuses.includes(account_status)) {
                return responseHelper.error(res, 'Invalid account status');
            }

            const updatedUser = await userModel.updateStatus(id, account_status);

            await auditLogModel.log(req.user.id, `ADMIN_USER_STATUS_UPDATE`, `Admin changed user ${id} status to ${account_status}`);

            const statusCopy = {
                active: {
                    title: 'Account activated',
                    message: 'Your DOMIKNOW account is active. You can now use the features available to your role.'
                },
                disabled: {
                    title: 'Account disabled',
                    message: 'Your DOMIKNOW account was disabled by an administrator. Contact platform support if you need assistance.'
                },
                rejected: {
                    title: 'Account application not approved',
                    message: 'Your DOMIKNOW account application was not approved. Contact platform support for clarification.'
                },
                pending: {
                    title: 'Account review pending',
                    message: 'Your DOMIKNOW account is awaiting administrator review.'
                }
            }[account_status];

            await notificationModel.create({
                user_id: id,
                type: `account_status_${account_status}`,
                title: statusCopy.title,
                message: statusCopy.message,
                reference_id: id
            });

            return responseHelper.success(res, `User status updated to ${account_status}`, updatedUser);
        } catch (error) {
            console.error('Update user status error:', error);
            return responseHelper.error(res, 'Failed to update user status', error, 500);
        }
    }
};

module.exports = userController;
