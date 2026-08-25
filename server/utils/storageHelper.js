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

/**
 * Supabase Storage methods expect an object path relative to the selected
 * bucket. Older seed/import data sometimes includes the bucket name (or even
 * a complete Supabase URL), which makes the SDK look for a duplicated path
 * such as payment-proofs/payment-proofs/file.jpg.
 */
const normalizeStoragePath = (bucketName, filePath) => {
    if (typeof bucketName !== 'string' || !bucketName.trim()) {
        throw new TypeError('A storage bucket name is required.');
    }
    if (typeof filePath !== 'string' || !filePath.trim()) {
        throw new TypeError('A storage object path is required.');
    }

    const cleanBucket = bucketName.trim().replace(/^\/+|\/+$/g, '');
    let normalized = filePath.trim().replace(/\\/g, '/');

    if (/^https?:\/\//i.test(normalized)) {
        const parsed = new URL(normalized);
        const decodedPath = decodeURIComponent(parsed.pathname);
        const bucketMarker = `/${cleanBucket}/`;
        const bucketIndex = decodedPath.indexOf(bucketMarker);
        if (bucketIndex === -1) {
            throw new Error(`Storage URL does not reference the ${cleanBucket} bucket.`);
        }
        normalized = decodedPath.slice(bucketIndex + bucketMarker.length);
    } else {
        normalized = normalized.split('?')[0].split('#')[0];
        try {
            normalized = decodeURIComponent(normalized);
        } catch (error) {
            // Keep a literal path when it contains a non-URI percent symbol.
        }
    }

    normalized = normalized.replace(/^\/+/, '');
    if (normalized.toLowerCase().startsWith(`${cleanBucket.toLowerCase()}/`)) {
        normalized = normalized.slice(cleanBucket.length + 1);
    }

    const segments = normalized.split('/').filter(Boolean);
    if (!segments.length || segments.some((segment) => segment === '..')) {
        throw new Error('Invalid storage object path.');
    }

    return segments.join('/');
};

const isStorageObjectNotFound = (error) => {
    return Number(error?.statusCode) === 404 ||
        Number(error?.status) === 404 ||
        /object not found/i.test(String(error?.message || ''));
};

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

    const normalizedPath = normalizeStoragePath(bucketName, filePath);
    const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(normalizedPath, buffer, {
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
            .createSignedUrl(normalizedPath, SIGNED_URL_EXPIRY);

        if (signedErr) throw signedErr;
        fileUrl = signedData.signedUrl;
    } else {
        // Use public URL for public buckets (e.g. property-images)
        const { data: urlData } = supabase.storage
            .from(bucketName)
            .getPublicUrl(normalizedPath);
        fileUrl = urlData.publicUrl;
    }

    return {
        path: normalizedPath,
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
    const normalizedPath = normalizeStoragePath(bucketName, filePath);
    const { error } = await supabase.storage
        .from(bucketName)
        .remove([normalizedPath]);

    if (error) throw error;
    return true;
};

/**
 * Generate a fresh signed URL for a file stored in a private bucket.
 * Used when a previously stored signed URL has expired.
 */
const getSignedUrl = async (bucketName, filePath, expiresIn = SIGNED_URL_EXPIRY) => {
    const normalizedPath = normalizeStoragePath(bucketName, filePath);
    const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(normalizedPath, expiresIn);

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
    normalizeStoragePath,
    isStorageObjectNotFound,
    isPrivateBucket,
    PRIVATE_BUCKETS,
    SIGNED_URL_EXPIRY
};
