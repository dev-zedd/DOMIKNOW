const supabase = require('../config/supabaseClient');

/**
 * Storage Helper Utility
 * Centralizes Supabase Storage operations for DOMIKNOW.
 * 
 * PUBLIC buckets:  property-images
 * PRIVATE buckets: property-documents, tenant-application-documents,
 *                  payment-proofs, maintenance-images, report-attachments,
 *                  dispute-attachments, violation-evidence
 */

// List of buckets that must use signed (private) URLs
const PRIVATE_BUCKETS = [
    'property-documents',
    'tenant-application-documents',
    'payment-proofs',
    'maintenance-images',
    'report-attachments',
    'dispute-attachments',
    'violation-evidence',
    'tenant-report-evidence',
    'landlord-report-evidence'
];

// Signed URL expiry: 7 days (in seconds) — sufficient for demo and capstone use
const SIGNED_URL_EXPIRY = 7 * 24 * 60 * 60;

// In-memory set of verified buckets to prevent redundant API calls on every upload
const verifiedBuckets = new Set();

const ensureBucket = async (bucketName) => {
    if (verifiedBuckets.has(bucketName)) return;

    try {
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();
        if (listError) {
            console.warn(`[storageHelper] Warning listing buckets (${listError.message || listError.status || 'Timeout'}). Proceeding with upload...`);
            return;
        }
        if (buckets && Array.isArray(buckets)) {
            buckets.forEach(b => verifiedBuckets.add(b.name));
        }
        if (!verifiedBuckets.has(bucketName)) {
            const isPrivate = PRIVATE_BUCKETS.includes(bucketName);
            const { error: createError } = await supabase.storage.createBucket(bucketName, {
                public: !isPrivate
            });
            if (createError) {
                // If bucket already exists error or other API warning, log cleanly
                if (createError.message && createError.message.includes('already exists')) {
                    verifiedBuckets.add(bucketName);
                } else {
                    console.warn(`[storageHelper] Notice creating bucket ${bucketName}:`, createError.message || createError);
                }
            } else {
                verifiedBuckets.add(bucketName);
                console.log(`Successfully verified/created Supabase storage bucket: ${bucketName} (public: ${!isPrivate})`);
            }
        }
    } catch (err) {
        console.warn(`[storageHelper] Non-fatal warning in ensureBucket for ${bucketName}:`, err.message || err);
    }
};

/**
 * Upload a base64-encoded file to a Supabase Storage bucket.
 * Returns { path, url } where url is:
 *   - a signed URL for private buckets
 *   - a public URL for public buckets
 */
const uploadFile = async (bucketName, filePath, fileInput, mimeType) => {
    // Proactively ensure the target bucket exists before uploading
    await ensureBucket(bucketName);

    let buffer;
    if (Buffer.isBuffer(fileInput)) {
        buffer = fileInput;
    } else if (typeof fileInput === 'string') {
        const base64Data = fileInput.replace(/^data:.*?;base64,/, '');
        buffer = Buffer.from(base64Data, 'base64');
    } else {
        throw new Error('Invalid file input passed to storageHelper (expected Buffer or base64 String).');
    }

    const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, buffer, {
            contentType: mimeType,
            upsert: true
        });

    if (error) throw error;

    // Determine URL type based on bucket privacy
    let fileUrl;
    if (PRIVATE_BUCKETS.includes(bucketName)) {
        // Generate signed URL for private buckets
        const { data: signedData, error: signedErr } = await supabase.storage
            .from(bucketName)
            .createSignedUrl(filePath, SIGNED_URL_EXPIRY);

        if (signedErr) throw signedErr;
        fileUrl = signedData.signedUrl;
    } else {
        // Use public URL for public buckets (e.g. property-images)
        const { data: urlData } = supabase.storage
            .from(bucketName)
            .getPublicUrl(filePath);
        fileUrl = urlData.publicUrl;
    }

    return {
        path: filePath,
        url: fileUrl,
        publicUrl: fileUrl,
        signedUrl: fileUrl
    };
};

/**
 * Remove one stored file. The explicit path keeps deletion scoped to the
 * authenticated user's known object rather than accepting arbitrary paths.
 */
const deleteFile = async (bucketName, filePath) => {
    const { error } = await supabase.storage
        .from(bucketName)
        .remove([filePath]);

    if (error) throw error;
    return true;
};

/**
 * Generate a fresh signed URL for a file stored in a private bucket.
 * Used when a previously stored signed URL has expired.
 */
const getSignedUrl = async (bucketName, filePath, expiresIn = SIGNED_URL_EXPIRY) => {
    const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(filePath, expiresIn);

    if (error) throw error;
    return data.signedUrl;
};

/**
 * Check if a bucket is classified as private.
 */
const isPrivateBucket = (bucketName) => {
    return PRIVATE_BUCKETS.includes(bucketName);
};

module.exports = {
    uploadFile,
    deleteFile,
    getSignedUrl,
    isPrivateBucket,
    PRIVATE_BUCKETS,
    SIGNED_URL_EXPIRY
};
