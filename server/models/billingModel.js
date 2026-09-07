const { withBillingBalance } = require('../utils/billingBalanceHelper');
const supabase = require('../config/supabaseClient');

const billingModel = {
    async createBilling(billingData) {
        const { data, error } = await supabase
            .from('billing_records')
            .insert([{
                ...billingData,
                billing_status: billingData.billing_status || 'pending_payment'
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async findByLandlordId(landlordId) {
        const { data, error } = await supabase
            .from('billing_records')
            .select(`
                id,
                lease_id,
                tenant_id,
                landlord_id,
                billing_month,
                rent_amount,
                utility_amount,
                water,
                electricity,
                internet,
                parking,
                other_charges,
                penalty_amount,
                total_amount,
                payment_records (payment_amount, payment_status),
                due_date,
                billing_status,
                remarks,
                created_at,
                users!billing_records_tenant_id_fkey (
                    full_name,
                    email
                ),
                properties (
                    property_name,
                    address
                ),
                lease_records (
                    lease_number,
                    monthly_rent,
                    utilities_covered
                )
            `)
            .eq('landlord_id', landlordId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map(withBillingBalance);
    },

    async findByTenantId(tenantId) {
        const { data, error } = await supabase
            .from('billing_records')
            .select(`
                id,
                lease_id,
                tenant_id,
                landlord_id,
                billing_month,
                rent_amount,
                utility_amount,
                water,
                electricity,
                internet,
                parking,
                other_charges,
                penalty_amount,
                total_amount,
                payment_records (payment_amount, payment_status),
                due_date,
                billing_status,
                remarks,
                created_at,
                users!billing_records_landlord_id_fkey (
                    full_name,
                    email
                ),
                properties (
                    property_name,
                    address
                ),
                lease_records (
                    lease_number,
                    monthly_rent,
                    utilities_covered
                )
            `)
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map(withBillingBalance);
    },

    async findById(id) {
        const { data, error } = await supabase
            .from('billing_records')
            .select(`
                id,
                lease_id,
                tenant_id,
                landlord_id,
                billing_month,
                rent_amount,
                utility_amount,
                water,
                electricity,
                internet,
                parking,
                other_charges,
                penalty_amount,
                total_amount,
                payment_records (payment_amount, payment_status),
                due_date,
                billing_status,
                remarks,
                created_at,
                tenant:users!billing_records_tenant_id_fkey (
                    full_name,
                    email,
                    contact_number
                ),
                landlord:users!billing_records_landlord_id_fkey (
                    full_name,
                    email,
                    contact_number
                ),
                properties (
                    property_name,
                    address
                ),
                lease_records (
                    lease_number,
                    monthly_rent,
                    utilities_covered
                )
            `)
            .eq('id', id)
            .maybeSingle();

        if (error) throw error;
        return withBillingBalance(data);
    },

    async findOverdueByLandlordId(landlordId) {
        const todayStr = new Date().toISOString().split('T')[0];
        
        const { data, error } = await supabase
            .from('billing_records')
            .select(`
                id,
                billing_month,
                rent_amount,
                utility_amount,
                water,
                electricity,
                internet,
                parking,
                other_charges,
                penalty_amount,
                total_amount,
                payment_records (payment_amount, payment_status),
                due_date,
                billing_status,
                users!billing_records_tenant_id_fkey (
                    full_name
                ),
                properties (
                    property_name
                )
            `)
            .eq('landlord_id', landlordId)
            .in('billing_status', ['pending_payment', 'unpaid', 'partially_paid', 'overdue'])
            .lt('due_date', todayStr)
            .order('due_date', { ascending: true });

        if (error) throw error;
        return (data || []).map(withBillingBalance);
    },

    async findOverdueByTenantId(tenantId) {
        const todayStr = new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('billing_records')
            .select(`
                id,
                billing_month,
                rent_amount,
                utility_amount,
                water,
                electricity,
                internet,
                parking,
                other_charges,
                penalty_amount,
                total_amount,
                payment_records (payment_amount, payment_status),
                due_date,
                billing_status,
                properties (
                    property_name
                )
            `)
            .eq('tenant_id', tenantId)
            .in('billing_status', ['pending_payment', 'unpaid', 'partially_paid', 'overdue'])
            .lt('due_date', todayStr)
            .order('due_date', { ascending: true });

        if (error) throw error;
        return (data || []).map(withBillingBalance);
    },

    async findAllBillings() {
        const { data, error } = await supabase
            .from('billing_records')
            .select(`
                id,
                billing_month,
                rent_amount,
                utility_amount,
                penalty_amount,
                total_amount,
                payment_records (payment_amount, payment_status),
                due_date,
                billing_status,
                tenant:users!billing_records_tenant_id_fkey (
                    full_name
                ),
                landlord:users!billing_records_landlord_id_fkey (
                    full_name
                ),
                properties (
                    property_name
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map(withBillingBalance);
    },

    async updateBilling(id, landlordId, billingData) {
        // Enforce ownership
        const { data: checkData, error: checkError } = await supabase
            .from('billing_records')
            .select('id, billing_status')
            .eq('id', id)
            .eq('landlord_id', landlordId)
            .maybeSingle();

        if (checkError) throw checkError;
        if (!checkData) return null;

        // Limit editing based on the current status of the billing
        const editableStatuses = ['draft', 'pending_payment', 'unpaid'];
        if (!editableStatuses.includes(checkData.billing_status)) {
            throw new Error(`Only billings in Draft or Pending status can be updated. Current status is ${checkData.billing_status.toUpperCase()}.`);
        }

        const { data, error } = await supabase
            .from('billing_records')
            .update({
                ...billingData,
                updated_at: new Date()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async updateBillingStatus(id, status) {
        const { data, error } = await supabase
            .from('billing_records')
            .update({
                billing_status: status,
                updated_at: new Date()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteBilling(id) {
        const { data, error } = await supabase
            .from('billing_records')
            .delete()
            .eq('id', id)
            .select();

        if (error) throw error;
        return data;
    }
};

module.exports = billingModel;
