const supabase = require('../config/supabaseClient');

const ratingsModel = {
    /**
     * Check if tenant has an ended, terminated, or completed lease for this property.
     * Returns the lease record (with landlord_id) or null.
     */
    async findEligibleLease(tenantId, leaseId) {
        const { data, error } = await supabase
            .from('lease_records')
            .select('id, landlord_id, property_id, lease_status, lease_number')
            .eq('id', leaseId)
            .eq('tenant_id', tenantId)
            .in('lease_status', ['ended', 'terminated', 'completed', 'expired'])
            .maybeSingle();

        if (error) throw error;
        return data || null;
    },

    /**
     * Get all eligible leases for rating for a tenant (ended/terminated/completed/expired).
     * Returns leases with property name and landlord info, including whether
     * a rating has already been submitted for each.
     */
    async findEligibleLeasesByTenant(tenantId) {
        const { data: leases, error: leaseErr } = await supabase
            .from('lease_records')
            .select(`
                id,
                lease_number,
                lease_status,
                property_id,
                landlord:users!lease_records_landlord_id_fkey (
                    id,
                    full_name
                ),
                properties (
                    id,
                    property_name
                )
            `)
            .eq('tenant_id', tenantId)
            .in('lease_status', ['ended', 'terminated', 'completed', 'expired'])
            .order('created_at', { ascending: false });

        if (leaseErr) throw leaseErr;

        // Fetch all ratings this tenant already submitted
        const { data: ratings, error: ratErr } = await supabase
            .from('landlord_ratings')
            .select('lease_id')
            .eq('tenant_id', tenantId);

        if (ratErr) throw ratErr;

        const ratedLeaseIds = new Set((ratings || []).map(r => r.lease_id));

        return (leases || []).map(lease => ({
            ...lease,
            is_rated: ratedLeaseIds.has(lease.id)
        }));
    },

    /**
     * Check for existing rating for a given lease & tenant (duplicate guard).
     */
    async findExistingRating(tenantId, leaseId) {
        const { data, error } = await supabase
            .from('landlord_ratings')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('lease_id', leaseId)
            .maybeSingle();

        if (error) throw error;
        return data || null;
    },

    /**
     * Create a new rating record.
     */
    async createRating(ratingData) {
        const { data, error } = await supabase
            .from('landlord_ratings')
            .insert([ratingData])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Update an existing rating (within edit window).
     */
    async updateRating(id, tenantId, updateData) {
        const { data, error } = await supabase
            .from('landlord_ratings')
            .update({
                ...updateData,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .eq('tenant_id', tenantId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Fetch all ratings submitted by a specific tenant.
     */
    async findByTenantId(tenantId) {
        const { data, error } = await supabase
            .from('landlord_ratings')
            .select(`
                id,
                rating,
                feedback,
                submitted_at,
                updated_at,
                lease_id,
                lease_records!landlord_ratings_lease_id_fkey (
                    lease_number,
                    lease_status
                ),
                landlord:users!landlord_ratings_landlord_id_fkey (
                    full_name
                ),
                properties (
                    property_name
                )
            `)
            .eq('tenant_id', tenantId)
            .order('submitted_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    /**
     * Fetch a single rating by ID.
     */
    async findById(id) {
        const { data, error } = await supabase
            .from('landlord_ratings')
            .select(`
                id,
                rating,
                feedback,
                submitted_at,
                updated_at,
                lease_id,
                tenant_id,
                landlord_id,
                property_id,
                lease_records!landlord_ratings_lease_id_fkey (
                    lease_number,
                    lease_status
                ),
                landlord:users!landlord_ratings_landlord_id_fkey (
                    full_name
                ),
                properties (
                    property_name
                )
            `)
            .eq('id', id)
            .maybeSingle();

        if (error) throw error;
        return data || null;
    },

    /**
     * Get all ratings for a landlord (for their dashboard view).
     */
    async findByLandlordId(landlordId) {
        const { data, error } = await supabase
            .from('landlord_ratings')
            .select(`
                id,
                rating,
                feedback,
                submitted_at,
                tenant:users!landlord_ratings_tenant_id_fkey (
                    full_name
                ),
                properties (
                    property_name
                )
            `)
            .eq('landlord_id', landlordId)
            .order('submitted_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    /**
     * Recalculate average_rating and rating_count on the properties table.
     */
    async recalculatePropertyRating(propertyId) {
        const { data: list, error } = await supabase
            .from('landlord_ratings')
            .select('rating')
            .eq('property_id', propertyId);

        if (error) throw error;

        const count = (list || []).length;
        const avg = count > 0
            ? parseFloat((list.reduce((s, r) => s + r.rating, 0) / count).toFixed(2))
            : 0.00;

        await supabase
            .from('properties')
            .update({ average_rating: avg, rating_count: count, updated_at: new Date().toISOString() })
            .eq('id', propertyId);
    }
};

module.exports = ratingsModel;
