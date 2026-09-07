const supabase = require('../config/supabaseClient');

const leaseModel = {
    async createLease(leaseData) {
        const { data, error } = await supabase
            .from('lease_records')
            .insert([{
                ...leaseData,
                lease_status: leaseData.lease_status || 'pending_tenant_acceptance'
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async findLeaseByApplicationId(applicationId) {
        const { data, error } = await supabase
            .from('lease_records')
            .select('id, lease_status')
            .eq('application_id', applicationId)
            .maybeSingle();

        if (error) throw error;
        return data || null;
    },

    async findLeaseById(id) {
        const { data, error } = await supabase
            .from('lease_records')
            .select(`
                *,
                tenant:users!lease_records_tenant_id_fkey (
                    full_name,
                    email,
                    contact_number,
                    address
                ),
                landlord:users!lease_records_landlord_id_fkey (
                    full_name,
                    email,
                    contact_number,
                    address
                ),
                properties (
                    property_name,
                    property_type,
                    address,
                    barangay,
                    municipality,
                    province
                ),
                property_units (
                    unit_number,
                    rental_style
                ),
                unit_beds (
                    bed_label
                )
            `)
            .eq('id', id)
            .maybeSingle();

        if (error) throw error;
        if (!data) return null;

        // Fetch property amenities & unit amenities
        if (data.property_id) {
            const { data: propAmenities } = await supabase
                .from('property_amenities')
                .select('amenity_name')
                .eq('property_id', data.property_id);

            let unitAmenities = [];
            if (data.unit_id) {
                const { data: uAmenities } = await supabase
                    .from('unit_amenities')
                    .select('amenity_name')
                    .eq('unit_id', data.unit_id);
                unitAmenities = (uAmenities || []).map(a => a.amenity_name);
            }

            const combinedAmenities = Array.from(new Set([
                ...(propAmenities || []).map(a => a.amenity_name),
                ...unitAmenities
            ]));

            if (data.properties) {
                data.properties.amenities = combinedAmenities;
            }
        }

        return data;
    },

    async findByLandlordId(landlordId) {
        const { data, error } = await supabase
            .from('lease_records')
            .select(`
                id,
                application_id,
                tenant_id,
                lease_number,
                property_id,
                unit_id,
                bed_id,
                lease_start_date,
                lease_end_date,
                monthly_rent,
                security_deposit,
                payment_due_day,
                utilities_covered,
                lease_status,
                created_at,
                users!lease_records_tenant_id_fkey (
                    full_name,
                    email
                ),
                properties (
                    property_name,
                    address
                ),
                property_units (
                    unit_number,
                    rental_style
                ),
                unit_beds (
                    bed_label
                )
            `)
            .eq('landlord_id', landlordId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async findByTenantId(tenantId) {
        const { data, error } = await supabase
            .from('lease_records')
            .select(`
                id,
                lease_number,
                property_id,
                unit_id,
                bed_id,
                lease_start_date,
                lease_end_date,
                monthly_rent,
                security_deposit,
                payment_due_day,
                utilities_covered,
                lease_status,
                created_at,
                landlord:users!lease_records_landlord_id_fkey (
                    full_name,
                    email
                ),
                properties (
                    id,
                    property_name,
                    address
                ),
                property_units (
                    unit_number,
                    rental_style
                ),
                unit_beds (
                    bed_label
                )
            `)
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async updateLease(id, landlordId, leaseData) {
        // Enforce landlord ownership
        const { data: checkData, error: checkError } = await supabase
            .from('lease_records')
            .select('id, lease_status')
            .eq('id', id)
            .eq('landlord_id', landlordId)
            .maybeSingle();

        if (checkError) throw checkError;
        if (!checkData) return null;

        // Allow update only if pending or rejected
        if (checkData.lease_status !== 'pending_tenant_acceptance' && checkData.lease_status !== 'rejected') {
            throw Object.assign(new Error('Only leases that are pending acceptance or rejected can be modified.'), { statusCode: 409 });
        }

        const { data, error } = await supabase
            .from('lease_records')
            .update({
                ...leaseData,
                updated_at: new Date()
            })
            .eq('id', id).eq('landlord_id', landlordId).eq('lease_status', checkData.lease_status)
            .select()
            .maybeSingle();

        if (error) throw error;
        if (!data) throw Object.assign(new Error('The lease changed during this request. Refresh and try again.'), { statusCode: 409 });
        return data;
    },

    async acceptLease(id, tenantId, signatureName) {
        // Enforce tenant ownership check
        const { data: lease, error: checkError } = await supabase
            .from('lease_records')
            .select('id, lease_status')
            .eq('id', id)
            .eq('tenant_id', tenantId)
            .maybeSingle();

        if (checkError) throw checkError;
        if (!lease) return null;

        if (lease.lease_status !== 'pending_tenant_acceptance') {
            throw Object.assign(new Error('This lease is not pending acceptance.'), { statusCode: 409 });
        }

        const { data, error } = await supabase
            .from('lease_records')
            .update({
                lease_status: 'active',
                tenant_signature_name: signatureName,
                tenant_signature_date: new Date(),
                updated_at: new Date()
            })
            .eq('id', id).eq('tenant_id', tenantId).eq('lease_status', lease.lease_status)
            .select()
            .maybeSingle();

        if (error) throw error;
        if (!data) throw Object.assign(new Error('The lease changed during this request. Refresh and try again.'), { statusCode: 409 });
        return data;
    },

    async rejectLease(id, tenantId, signatureName, tenantNotes = '') {
        // Enforce tenant ownership check
        const { data: lease, error: checkError } = await supabase
            .from('lease_records')
            .select('id, lease_status')
            .eq('id', id)
            .eq('tenant_id', tenantId)
            .maybeSingle();

        if (checkError) throw checkError;
        if (!lease) return null;

        if (lease.lease_status !== 'pending_tenant_acceptance') {
            throw Object.assign(new Error('This lease is not pending acceptance.'), { statusCode: 409 });
        }

        const { data, error } = await supabase
            .from('lease_records')
            .update({
                lease_status: 'rejected',
                tenant_signature_name: signatureName,
                tenant_signature_date: new Date(),
                terms_and_conditions: tenantNotes,
                updated_at: new Date()
            })
            .eq('id', id).eq('tenant_id', tenantId).eq('lease_status', lease.lease_status)
            .select()
            .maybeSingle();

        if (error) throw error;
        if (!data) throw Object.assign(new Error('The lease changed during this request. Refresh and try again.'), { statusCode: 409 });
        return data;
    },

    async updateLeaseStatus(id, landlordId, status) {
        // Enforce landlord ownership check
        const { data: lease, error: checkError } = await supabase
            .from('lease_records')
            .select('id, lease_status')
            .eq('id', id)
            .eq('landlord_id', landlordId)
            .maybeSingle();

        if (checkError) throw checkError;
        if (!lease) return null;

        const allowedTransitions = {
            pending_tenant_acceptance: ['cancelled'],
            rejected: ['cancelled'],
            accepted: ['active', 'cancelled'],
            active: ['expired', 'terminated', 'ended']
        };
        if (!(allowedTransitions[lease.lease_status] || []).includes(status)) {
            const error = new Error(`Lease cannot move from ${lease.lease_status} to ${status}.`);
            error.statusCode = 400;
            throw error;
        }

        const { data, error } = await supabase
            .from('lease_records')
            .update({
                lease_status: status,
                updated_at: new Date()
            })
            .eq('id', id).eq('landlord_id', landlordId).eq('lease_status', lease.lease_status)
            .select()
            .maybeSingle();

        if (error) throw error;
        if (!data) throw Object.assign(new Error('The lease changed during this request. Refresh and try again.'), { statusCode: 409 });
        return data;
    },

    async findAllLeases() {
        const { data, error } = await supabase
            .from('lease_records')
            .select(`
                id,
                lease_number,
                lease_start_date,
                lease_end_date,
                monthly_rent,
                security_deposit,
                lease_status,
                tenant:users!lease_records_tenant_id_fkey (
                    full_name
                ),
                landlord:users!lease_records_landlord_id_fkey (
                    full_name
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

module.exports = leaseModel;
