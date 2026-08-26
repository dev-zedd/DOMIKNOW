const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/authMiddleware');
const responseHelper = require('../utils/responseHelper');
const { getSignedUrl, isPrivateBucket, isStorageObjectNotFound } = require('../utils/storageHelper');

/**
 * POST /api/storage/signed-url
 * 
 * Generates a fresh signed URL for a file in a private bucket.
 * Only authenticated users can call this endpoint.
 * 
 * Body: { bucket_name, file_path }
 * Returns: { signed_url }
 * 
 * Access control note:
 * This endpoint verifies the user is authenticated via JWT.
 * Fine-grained ownership checks are handled at the controller/model level
 * where the file paths are originally served — only authorized users
 * receive the file_path in the first place.
 */
router.post('/signed-url', requireAuth, async (req, res) => {
    try {
        const { bucket_name, file_path } = req.body;

        if (!bucket_name || !file_path) {
            return responseHelper.error(res, 'Bucket name and file path are required.');
        }

        // Only allow signed URL generation for private buckets
        if (!isPrivateBucket(bucket_name)) {
            return responseHelper.error(res, 'This bucket does not require signed URLs. Use the public URL directly.');
        }

        const signedUrl = await getSignedUrl(bucket_name, file_path);

        return responseHelper.success(res, 'Signed URL generated successfully.', { signed_url: signedUrl });

    } catch (error) {
        if (isStorageObjectNotFound(error)) {
            return responseHelper.error(res, 'The requested stored file no longer exists.', null, 404);
        }
        console.error('Generate signed URL error:', error);
        return responseHelper.error(res, 'Failed to generate signed URL.', error, 500);
    }
});

module.exports = router;
