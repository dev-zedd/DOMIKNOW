const paymentModel = require('../models/paymentModel');
const auditLogModel = require('../models/auditLogModel');
const notificationModel = require('../models/notificationModel');
const responseHelper = require('../utils/responseHelper');
const supabase = require('../config/supabaseClient');
const { uploadFile } = require('../utils/storageHelper');
const { attachPaymentProofUrls } = require('../utils/paymentProofHelper');
const cache = require('../utils/cacheHelper');

// Cache TTL (seconds)
const TTL = { payments: 90 }; // Payments list – 1.5 min

const paymentController = {
    async submitPayment(req, res) {
        try {
            const { 
                billing_id, payment_amount, payment_method, 
                payment_reference_number, base64_content, file_name, mime_type, file_size 
            } = req.body;
            
            const tenantId = req.user.id;

            // 1. Validate required fields
            if (!billing_id || !payment_amount || !payment_method || !payment_reference_number || !base64_content || !file_name || !mime_type || !file_size) {
                return responseHelper.error(res, 'All details (billing, amount, method, reference, and file proof payload) are required.');
            }

            // 2. Validate billing record belongs to tenant
            const { data: billing, error: billingErr } = await supabase
                .from('billing_records')
                .select('id, tenant_id, lease_id, landlord_id, property_id, billing_status')
                .eq('id', billing_id)
                .maybeSingle();

            if (billingErr) throw billingErr;
            if (!billing || billing.tenant_id !== tenantId) {
                return responseHelper.error(res, 'Billing statement not found or access denied.', null, 404);
            }

            const allowedBillingStatuses = ['unpaid', 'pending_payment', 'partially_paid', 'overdue'];
            if (!allowedBillingStatuses.includes(billing.billing_status)) {
                return responseHelper.error(res, `Cannot submit payment. Billing status is currently '${billing.billing_status}'.`);
            }

            // Rule: Only one Payment Record can be Pending Verification for a billing at a time
            const { data: existingPending, error: pendingErr } = await supabase
                .from('payment_records')
                .select('id')
                .eq('billing_id', billing_id)
                .eq('payment_status', 'pending_verification')
                .maybeSingle();

            if (pendingErr) throw pendingErr;
            if (existingPending) {
                return responseHelper.error(res, 'A payment submission is already pending verification for this billing statement.');
            }

            // 3. File type check
            const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
            if (!allowedMimeTypes.includes(mime_type)) {
                return responseHelper.error(res, 'Invalid file format. Only PDF, JPG, JPEG, and PNG are allowed.');
            }

            // File size check (limit 10MB)
            if (parseInt(file_size) > 10 * 1024 * 1024) {
                return responseHelper.error(res, 'Payment proof file exceeds maximum limit of 10MB.');
            }

            // 4. Upload file payload to Supabase
            const uniqueName = `${Date.now()}-${file_name}`;
            const storagePath = `payments/${billing_id}/${uniqueName}`;
            const uploadResult = await uploadFile('payment-proofs', storagePath, base64_content, mime_type);

            // 5. Sanitize payment method to adhere to DB check constraint ('gcash', 'bank_transfer', 'cash', 'other')
            const validDbMethods = ['gcash', 'bank_transfer', 'cash', 'other'];
            let sanitizedMethod = (payment_method || '').toLowerCase().trim();
            if (!validDbMethods.includes(sanitizedMethod)) {
                sanitizedMethod = 'other';
            }

            // Save payment record
            const paymentRecord = await paymentModel.createPaymentRecord({
                billing_id,
                lease_id: billing.lease_id,
                tenant_id: tenantId,
                landlord_id: billing.landlord_id,
                property_id: billing.property_id,
                payment_amount: parseFloat(payment_amount),
                payment_method: sanitizedMethod,
                payment_reference_number,
                payment_proof_url: uploadResult.url,
                payment_proof_path: uploadResult.path,
                payment_status: 'pending_verification'
            });

            // 6. Update billing status to waiting_verification
            const { error: updateBillingErr } = await supabase
                .from('billing_records')
                .update({ billing_status: 'waiting_verification', updated_at: new Date() })
                .eq('id', billing_id);

            if (updateBillingErr) throw updateBillingErr;

            // 7. Audit log
            await auditLogModel.log(tenantId, 'SUBMIT_PAYMENT_PROOF', `Tenant submitted payment reference ${payment_reference_number} for bill ${billing_id}`);

            await notificationModel.create({
                user_id: billing.landlord_id,
                type: 'payment_submitted',
                title: 'Payment proof needs verification',
                message: `A tenant submitted a payment proof for PHP ${Number(payment_amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Review the payment before updating the billing record.`,
                reference_id: paymentRecord.id
            });

            // Invalidate landlord's payments and billings cache so pending proof appears
            cache.invalidateLandlord(billing.landlord_id, 'payments');
            cache.invalidateLandlord(billing.landlord_id, 'billings');

            return responseHelper.success(res, 'Payment proof successfully submitted and logged for verification.', paymentRecord, 201);

        } catch (error) {
            console.error('Submit payment error:', error);
            return responseHelper.error(res, 'Failed to upload payment proof', error, 500);
        }
    },

    async getTenantPayments(req, res) {
        try {
            const list = await paymentModel.findByTenantId(req.user.id);
            await attachPaymentProofUrls(list, 'tenant-payments');
            return responseHelper.success(res, 'Your payment logs retrieved successfully', list);
        } catch (error) {
            console.error('Get tenant payments error:', error);
            return responseHelper.error(res, 'Failed to fetch payment history', error, 500);
        }
    },

    async getLandlordPayments(req, res) {
        try {
            const userId = req.user.id;
            const cacheKey = cache.landlordKey(userId, 'payments');
            const cached = cache.get(cacheKey);
            if (cached) {
                return responseHelper.success(res, 'Landlord payments log retrieved successfully', cached);
            }

            const list = await paymentModel.findByLandlordId(userId);
            await attachPaymentProofUrls(list, 'landlord-payments');
            cache.set(cacheKey, list, TTL.payments);
            return responseHelper.success(res, 'Landlord payments log retrieved successfully', list);
        } catch (error) {
            console.error('Get landlord payments error:', error);
            return responseHelper.error(res, 'Failed to fetch payments queue', error, 500);
        }
    },

    async verifyPayment(req, res) {
        try {
            const { id } = req.params;
            const { payment_status, verification_remarks } = req.body;
            const landlordId = req.user.id;

            const allowedStatuses = ['verified', 'rejected'];
            if (!allowedStatuses.includes(payment_status)) {
                return responseHelper.error(res, 'Invalid verification status. Allowed: verified, rejected.');
            }

            // Requirements check: Rejections must require remarks
            if (payment_status === 'rejected' && (!verification_remarks || verification_remarks.trim() === '')) {
                return responseHelper.error(res, 'Remarks are required when rejecting a payment submission.');
            }

            const updated = await paymentModel.verifyPayment(id, landlordId, payment_status, verification_remarks);
            if (!updated) {
                return responseHelper.error(res, 'Payment submission not found or access denied.', null, 404);
            }

            // Audit logs
            const actionType = payment_status === 'verified' ? 'VERIFY_PAYMENT' : 'REJECT_PAYMENT';
            await auditLogModel.log(landlordId, actionType, `Landlord marked payment submission ${id} as ${payment_status}`);

            await notificationModel.create({
                user_id: updated.tenant_id,
                type: payment_status === 'verified' ? 'payment_verified' : 'payment_rejected',
                title: payment_status === 'verified' ? 'Payment verified' : 'Payment proof needs attention',
                message: payment_status === 'verified'
                    ? 'Your landlord verified your payment. Your billing record has been updated.'
                    : `Your payment proof was not accepted. ${verification_remarks || 'Review the billing entry and submit a valid proof.'}`,
                reference_id: updated.billing_id || id
            });

            // Invalidate landlord payments and billings caches – verification updates both
            cache.invalidateLandlord(landlordId, 'payments');
            cache.invalidateLandlord(landlordId, 'billings');

            return responseHelper.success(res, `Payment submission successfully marked as ${payment_status}`, updated);

        } catch (error) {
            console.error('Verify payment error:', error);
            return responseHelper.error(res, 'Failed to update payment status', error, 500);
        }
    }
};

module.exports = paymentController;
