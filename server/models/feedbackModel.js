const supabase = require('../config/supabaseClient');

const feedbackModel = {
    async checkLeaseEligibility(tenantId, propertyId, leaseId) {
        // Checks if tenant has active or ended lease for this property
        const { data, error } = await supabase
            .from('lease_records')
            .select('id, landlord_id')
            .eq('id', leaseId)
            .eq('tenant_id', tenantId)
            .eq('property_id', propertyId)
            .in('lease_status', ['active', 'ended', 'terminated'])
            .maybeSingle();

        if (error) throw error;
        return data || null;
    },

    async checkDuplicateFeedback(tenantId, leaseId, feedbackType) {
        const { data, error } = await supabase
            .from('ratings_feedback')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('lease_id', leaseId)
            .eq('feedback_type', feedbackType)
            .maybeSingle();

        if (error) throw error;
        return data || null;
    },

    async createFeedback(feedbackData) {
        const { data, error } = await supabase
            .from('ratings_feedback')
            .insert([{
                ...feedbackData,
                is_authenticated: true,
                status: 'submitted'
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async findByTenantId(tenantId) {
        const { data, error } = await supabase
            .from('ratings_feedback')
            .select(`
                *,
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
            .from('ratings_feedback')
            .select(`
                *,
                tenant:users!ratings_feedback_tenant_id_fkey (
                    full_name
                ),
                properties (
                    property_name
                )
            `)
            .eq('landlord_id', landlordId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async findAllFeedback() {
        const { data, error } = await supabase
            .from('ratings_feedback')
            .select(`
                *,
                tenant:users!ratings_feedback_tenant_id_fkey (
                    full_name
                ),
                properties (
                    property_name
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async findPublicFeedback(limit = 6) {
        const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 6, 1), 12);
        const { data, error } = await supabase
            .from('ratings_feedback')
            .select(`
                id,
                rating,
                feedback_text,
                feedback_type,
                created_at,
                properties (
                    property_name
                )
            `)
            .eq('status', 'visible')
            .eq('is_authenticated', true)
            .not('feedback_text', 'is', null)
            .neq('feedback_text', '')
            .order('created_at', { ascending: false })
            .limit(safeLimit);

        if (error) throw error;
        return data || [];
    },

    async updateFeedbackStatus(id, status) {
        const { data, error } = await supabase
            .from('ratings_feedback')
            .update({
                status,
                updated_at: new Date()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        if (data) {
            // Trigger recalculation for the property's average rating
            await this.recalculatePropertyRating(data.property_id);
        }

        return data;
    },

    async recalculatePropertyRating(propertyId) {
        // Fetch all visible, authenticated feedback for the property
        const { data: feedbackList, error: fetchErr } = await supabase
            .from('ratings_feedback')
            .select('rating')
            .eq('property_id', propertyId)
            .eq('status', 'visible')
            .eq('is_authenticated', true);

        if (fetchErr) throw fetchErr;

        let avgRating = 0.00;
        let count = 0;

        if (feedbackList && feedbackList.length > 0) {
            count = feedbackList.length;
            const sum = feedbackList.reduce((acc, curr) => acc + curr.rating, 0);
            avgRating = parseFloat((sum / count).toFixed(2));
        }

        // Update properties table
        const { error: propErr } = await supabase
            .from('properties')
            .update({
                average_rating: avgRating,
                feedback_count: count,
                updated_at: new Date()
            })
            .eq('id', propertyId);

        if (propErr) throw propErr;

        // Check if property_feedback_summary table exists and has a record for this property
        const { data: summary, error: sumFetchErr } = await supabase
            .from('property_feedback_summary')
            .select('id')
            .eq('property_id', propertyId)
            .maybeSingle();

        if (!sumFetchErr && summary) {
            // Update property_feedback_summary
            await supabase
                .from('property_feedback_summary')
                .update({
                    rating_average: avgRating,
                    total_feedback: count,
                    updated_at: new Date()
                })
                .eq('property_id', propertyId);
        }
    }
};

module.exports = feedbackModel;
