const { getSignedUrl, isStorageObjectNotFound } = require('./storageHelper');

/**
 * Replace persisted/expired proof URLs with fresh signed URLs. Missing legacy
 * objects are represented explicitly instead of leaking a stale demo URL or
 * producing one full stack trace per payment row.
 */
const attachPaymentProofUrls = async (payments, context = 'payments') => {
    const list = Array.isArray(payments) ? payments : [];
    let missingCount = 0;
    const unexpectedMessages = new Set();

    await Promise.all(list.map(async (payment) => {
        payment.payment_proof_url = null;
        payment.payment_proof_available = false;

        if (!payment.payment_proof_path) {
            payment.payment_proof_state = 'not_uploaded';
            return;
        }

        try {
            payment.payment_proof_url = await getSignedUrl('payment-proofs', payment.payment_proof_path);
            payment.payment_proof_available = true;
            payment.payment_proof_state = 'available';
        } catch (error) {
            if (isStorageObjectNotFound(error)) {
                payment.payment_proof_state = 'missing';
                missingCount += 1;
                return;
            }

            payment.payment_proof_state = 'temporarily_unavailable';
            unexpectedMessages.add(error?.message || 'Unknown storage error');
        }
    }));

    if (missingCount) {
        console.warn(`[${context}] ${missingCount} payment proof object(s) are missing from Supabase Storage.`);
    }
    if (unexpectedMessages.size) {
        console.error(`[${context}] Payment proof signing failed: ${Array.from(unexpectedMessages).join('; ')}`);
    }

    return list;
};

module.exports = { attachPaymentProofUrls };
