const supabase = require('../config/supabaseClient');

const screeningModel = {
    async createScreening(data) {
        const { data: record, error } = await supabase
            .from('tenant_screening')
            .insert([{
                ...data,
                status: 'pending'
            }])
            .select()
            .single();

        if (error) throw error;
        return record;
    },

    async findActiveScreening(tenantId, applicationId) {
        const { data, error } = await supabase
            .from('tenant_screening')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('application_id', applicationId)
            .eq('status', 'pending')
            .maybeSingle();

        if (error) throw error;
        return data || null;
    },

    async findByTenantId(tenantId) {
        const { data, error } = await supabase
            .from('tenant_screening')
            .select(`
                id,
                application_id,
                monthly_income,
                employment_status,
                screening_score,
                screening_result_label,
                screening_remarks,
                status,
                created_at,
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
            .from('tenant_screening')
            .select(`
                id,
                application_id,
                tenant_id,
                property_id,
                landlord_id,
                monthly_income,
                employment_status,
                employment_details,
                payment_behavior_score,
                previous_rental_history,
                rental_conduct_notes,
                screening_score,
                screening_result_label,
                screening_remarks,
                status,
                created_at,
                users!tenant_screening_tenant_id_fkey (
                    full_name,
                    email,
                    contact_number
                ),
                properties (
                    property_name,
                    landlord_id
                )
            `)
            .eq('landlord_id', landlordId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        let results = data || [];
        if (results.length === 0) {
            const { data: propScreenings } = await supabase
                .from('tenant_screening')
                .select(`
                    id,
                    application_id,
                    tenant_id,
                    property_id,
                    landlord_id,
                    monthly_income,
                    employment_status,
                    employment_details,
                    payment_behavior_score,
                    previous_rental_history,
                    rental_conduct_notes,
                    screening_score,
                    screening_result_label,
                    screening_remarks,
                    status,
                    created_at,
                    users!tenant_screening_tenant_id_fkey (
                        full_name,
                        email,
                        contact_number
                    ),
                    properties (
                        property_name,
                        landlord_id
                    )
                `)
                .eq('properties.landlord_id', landlordId)
                .order('created_at', { ascending: false });
            if (propScreenings && propScreenings.length > 0) {
                results = propScreenings.filter(item => item.properties !== null);
            }
        }
        return results;
    },

    async findScreeningDetails(id, landlordId) {
        const { data, error } = await supabase
            .from('tenant_screening')
            .select(`
                id,
                tenant_id,
                application_id,
                property_id,
                landlord_id,
                monthly_income,
                employment_status,
                employment_details,
                payment_behavior_score,
                previous_rental_history,
                rental_conduct_notes,
                screening_score,
                screening_result_label,
                screening_remarks,
                status,
                created_at,
                users!tenant_screening_tenant_id_fkey (
                    full_name,
                    email,
                    contact_number,
                    address
                ),
                properties (
                    property_name,
                    address,
                    monthly_rent,
                    landlord_id
                ),
                tenant_applications (
                    application_message,
                    desired_move_in_date
                )
            `)
            .eq('id', id)
            .maybeSingle();

        if (error) throw error;
        if (!data) return null;

        // Verify that landlord owns the property
        if (landlordId && data.properties && data.properties.landlord_id !== landlordId) {
            return null;
        }

        return data;
    },

    async updateScreeningScore(id, landlordId, scoreData) {
        // Confirm landlord ownership first
        const { data: screening, error: checkError } = await supabase
            .from('tenant_screening')
            .select('id, property_id, properties ( landlord_id )')
            .eq('id', id)
            .maybeSingle();

        if (checkError) throw checkError;
        if (!screening || !screening.properties || screening.properties.landlord_id !== landlordId) {
            return null;
        }

        const { data, error } = await supabase
            .from('tenant_screening')
            .update({
                ...scoreData,
                status: 'reviewed',
                updated_at: new Date()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async findAllScreenings() {
        const { data, error } = await supabase
            .from('tenant_screening')
            .select(`
                id,
                monthly_income,
                employment_status,
                screening_score,
                screening_result_label,
                status,
                created_at,
                users!tenant_screening_tenant_id_fkey (
                    full_name,
                    email
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

module.exports = screeningModel;
