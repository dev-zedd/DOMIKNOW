const { getBillingBalance } = require('../utils/billingBalanceHelper');
const supabase = require('../config/supabaseClient');

const paymentModel = {
    async createPaymentRecord(paymentData) {
        const { data, error } = await supabase
            .from('payment_records')
            .insert([{
                ...paymentData,
                payment_status: 'pending_verification'
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async findByTenantId(tenantId) {
        const { data, error } = await supabase
            .from('payment_records')
            .select(`
                id,
                payment_amount,
                payment_method,
                payment_reference_number,
                payment_proof_url,
                payment_proof_path,
                payment_status,
                verification_remarks,
                submitted_at,
                billing_records (
                    id,
                    billing_month,
                    total_amount,
                    billing_status
                ),
                properties (
                    property_name
                )
            `)
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async findByLandlordId(landlordId) {
        const { data, error } = await supabase
            .from('payment_records')
            .select(`
                id,
                payment_amount,
                payment_method,
                payment_reference_number,
                payment_proof_url,
                payment_proof_path,
                payment_status,
                verification_remarks,
                submitted_at,
                users!payment_records_tenant_id_fkey (
                    full_name,
                    email
                ),
                billing_records (
                    id,
                    billing_month,
                    total_amount,
                    billing_status
                ),
                properties (
                    property_name,
                    landlord_id
                )
            `)
            .eq('landlord_id', landlordId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async verifyPayment(id, landlordId, paymentStatus, remarks) {
        // Enforce ownership check
        const { data: payment, error: checkError } = await supabase
            .from('payment_records')
            .select('id, billing_id, payment_amount, landlord_id, payment_status')
            .eq('id', id)
            .maybeSingle();

        if (checkError) throw checkError;
        if (!payment || payment.landlord_id !== landlordId) {
            return null;
        }

        if (payment.payment_status !== 'pending_verification') {
            const error = new Error('This payment has already been reviewed. Refresh the payment list.');
            error.statusCode = 409;
            throw error;
        }

        // Update payment status
        const { data: updatedPayment, error } = await supabase
            .from('payment_records')
            .update({
                payment_status: paymentStatus,
                verification_remarks: remarks,
                verified_at: new Date(),
                updated_at: new Date()
            })
            .eq('id', id)
            .eq('payment_status', 'pending_verification')
            .select()
            .maybeSingle();

        if (error) throw error;

        if (!updatedPayment) {
            const conflict = new Error('This payment was reviewed by another request. Refresh the payment list.');
            conflict.statusCode = 409;
            throw conflict;
        }

        // Reconcile against all verified instalments, including earlier payments
        // when the current proof is rejected. Pending proofs are not money received.
        const { data: billing, error: billingError } = await supabase
            .from('billing_records').select('total_amount').eq('id', payment.billing_id).single();
        if (billingError) throw billingError;
        const { data: payments, error: paymentsError } = await supabase
            .from('payment_records').select('payment_amount, payment_status').eq('billing_id', payment.billing_id);
        if (paymentsError) throw paymentsError;
        const balance = getBillingBalance(billing.total_amount, payments || []);
        const finalStatus = balance.remaining_balance === 0 ? 'paid'
            : (payments || []).some(item => item.payment_status === 'pending_verification') ? 'waiting_verification'
            : balance.paid_amount > 0 ? 'partially_paid' : 'pending_payment';
        const { error: updateBillingError } = await supabase
            .from('billing_records').update({ billing_status: finalStatus, updated_at: new Date() })
            .eq('id', payment.billing_id);
        if (updateBillingError) throw updateBillingError;

        return updatedPayment;
    },

    async findAllPayments() {
        const { data, error } = await supabase
            .from('payment_records')
            .select(`
                id,
                payment_amount,
                payment_method,
                payment_reference_number,
                payment_proof_url,
                payment_proof_path,
                payment_status,
                verification_remarks,
                submitted_at,
                users:users!payment_records_tenant_id_fkey (
                    full_name,
                    email
                ),
                landlord:users!payment_records_landlord_id_fkey (
                    full_name,
                    email
                ),
                billing_records (
                    billing_month
                ),
                properties (
                    property_name
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    }
};

module.exports = paymentModel;
