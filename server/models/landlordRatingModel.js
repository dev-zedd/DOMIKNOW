const supabase = require('../config/supabaseClient');

const landlordRatingModel = {
    /**
     * Check if tenant has an eligible lease for this landlord/property.
     * Statuses allowed: ended, terminated, completed, expired (finished contracts only).
     */
    async findEligibleLease(tenantId, leaseId) {
        const { data, error } = await supabase
            .from('lease_records')
            .select('id, landlord_id, property_id, lease_status, lease_number, lease_start_date')
            .eq('id', leaseId)
            .eq('tenant_id', tenantId)
            .in('lease_status', ['expired', 'ended', 'terminated', 'completed'])
            .maybeSingle();

        if (error) throw error;
        return data || null;
    },

    /**
     * Find all eligible leases for a tenant and check if they have already rated the landlord.
     * Only completed or ended contracts are eligible.
     */
    async findEligibleLeasesByTenant(tenantId) {
        const { data: leases, error: leaseErr } = await supabase
            .from('lease_records')
            .select(`
                id,
                lease_number,
                lease_status,
                lease_start_date,
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
            .in('lease_status', ['expired', 'ended', 'terminated', 'completed'])
            .order('created_at', { ascending: false });

        if (leaseErr) throw leaseErr;

        // Fetch landlord ratings this tenant already submitted (Module B)
        const { data: ratings, error: ratErr } = await supabase
            .from('landlord_ratings_v2')
            .select('lease_id')
            .eq('tenant_id', tenantId);

        if (ratErr) {
            // Fallback if table doesn't exist yet
            console.warn('Landlord ratings v2 fetch error:', ratErr.message);
            return (leases || []).map(lease => ({ ...lease, is_rated: false }));
        }

        const ratedLeaseIds = new Set((ratings || []).map(r => r.lease_id));

        const eligible = (leases || []).filter(lease => {
            const status = lease.lease_status;
            // Only finished contracts are eligible to rate/review
            return ['expired', 'ended', 'terminated', 'completed'].includes(status);
        });

        return eligible.map(lease => ({
            ...lease,
            is_rated: ratedLeaseIds.has(lease.id)
        }));
    },

    /**
     * Check for existing landlord rating for a given lease (duplicate guard).
     */
    async findExistingRating(tenantId, leaseId) {
        const { data, error } = await supabase
            .from('landlord_ratings_v2')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('lease_id', leaseId)
            .maybeSingle();

        if (error) {
            if (error.message.includes('relation "public.landlord_ratings_v2" does not exist')) {
                return null;
            }
            throw error;
        }
        return data || null;
    },

    /**
     * Create a new landlord rating.
     */
    async createRating(ratingData) {
        // Calculate overall_computed_avg (8 criteria)
        const sum = 
            parseInt(ratingData.communication) +
            parseInt(ratingData.responsiveness) +
            parseInt(ratingData.professionalism) +
            parseInt(ratingData.fairness) +
            parseInt(ratingData.maintenance_response) +
            parseInt(ratingData.respectfulness) +
            parseInt(ratingData.reliability) +
            parseInt(ratingData.overall_satisfaction);
        
        const avg = parseFloat((sum / 8).toFixed(2));
        ratingData.overall_computed_avg = avg;

        const { data, error } = await supabase
            .from('landlord_ratings_v2')
            .insert([ratingData])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Update an existing landlord rating.
     */
    async updateRating(id, tenantId, updateData) {
        // Recalculate average if any rating values are being updated
        if (
            updateData.communication !== undefined ||
            updateData.responsiveness !== undefined ||
            updateData.professionalism !== undefined ||
            updateData.fairness !== undefined ||
            updateData.maintenance_response !== undefined ||
            updateData.respectfulness !== undefined ||
            updateData.reliability !== undefined ||
            updateData.overall_satisfaction !== undefined
        ) {
            const existing = await this.findById(id);
            if (!existing) throw new Error('Rating not found');

            const communication = updateData.communication !== undefined ? updateData.communication : existing.communication;
            const responsiveness = updateData.responsiveness !== undefined ? updateData.responsiveness : existing.responsiveness;
            const professionalism = updateData.professionalism !== undefined ? updateData.professionalism : existing.professionalism;
            const fairness = updateData.fairness !== undefined ? updateData.fairness : existing.fairness;
            const maintenance_response = updateData.maintenance_response !== undefined ? updateData.maintenance_response : existing.maintenance_response;
            const respectfulness = updateData.respectfulness !== undefined ? updateData.respectfulness : existing.respectfulness;
            const reliability = updateData.reliability !== undefined ? updateData.reliability : existing.reliability;
            const overall_satisfaction = updateData.overall_satisfaction !== undefined ? updateData.overall_satisfaction : existing.overall_satisfaction;

            const sum = 
                parseInt(communication) +
                parseInt(responsiveness) +
                parseInt(professionalism) +
                parseInt(fairness) +
                parseInt(maintenance_response) +
                parseInt(respectfulness) +
                parseInt(reliability) +
                parseInt(overall_satisfaction);
            
            updateData.overall_computed_avg = parseFloat((sum / 8).toFixed(2));
        }

        const { data, error } = await supabase
            .from('landlord_ratings_v2')
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
     * Fetch ratings submitted by a tenant.
     */
    async findByTenantId(tenantId) {
        const { data, error } = await supabase
            .from('landlord_ratings_v2')
            .select(`
                *,
                lease_records (
                    lease_number,
                    lease_status
                ),
                landlord:users!landlord_ratings_v2_landlord_id_fkey (
                    full_name
                ),
                properties (
                    property_name
                )
            `)
            .eq('tenant_id', tenantId)
            .order('submitted_at', { ascending: false });

        if (error) {
            if (error.message.includes('relation "public.landlord_ratings_v2" does not exist')) {
                return [];
            }
            throw error;
        }
        return data || [];
    },

    /**
     * Fetch rating details by ID.
     */
    async findById(id) {
        const { data, error } = await supabase
            .from('landlord_ratings_v2')
            .select(`
                *,
                lease_records (
                    lease_number,
                    lease_status
                ),
                landlord:users!landlord_ratings_v2_landlord_id_fkey (
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
     * Fetch ratings received by a landlord.
     */
    async findByLandlordId(landlordId) {
        // Primary query: with FK-aliased tenant join
        let { data, error } = await supabase
            .from('landlord_ratings_v2')
            .select(`
                *,
                tenant:users!landlord_ratings_v2_tenant_id_fkey (
                    full_name
                ),
                properties (
                    property_name
                )
            `)
            .eq('landlord_id', landlordId)
            .order('submitted_at', { ascending: false });

        // Fallback: if FK alias fails (e.g. constraint name mismatch), try without alias
        if (error && (error.message.includes('Could not find a relationship') || error.message.includes('landlord_ratings_v2_tenant_id_fkey'))) {
            console.warn('findByLandlordId FK alias fallback:', error.message);
            const fallback = await supabase
                .from('landlord_ratings_v2')
                .select(`
                    *,
                    properties (
                        property_name
                    )
                `)
                .eq('landlord_id', landlordId)
                .order('submitted_at', { ascending: false });

            if (fallback.error) {
                if (fallback.error.message.includes('relation "public.landlord_ratings_v2" does not exist')) {
                    return [];
                }
                throw fallback.error;
            }
            return fallback.data || [];
        }

        if (error) {
            if (error.message.includes('relation "public.landlord_ratings_v2" does not exist')) {
                return [];
            }
            console.error('findByLandlordId error:', error.message);
            throw error;
        }
        return data || [];
    },

    /**
     * Recalculate average landlord rating and total rating count for a user (landlord role).
     */
    async recalculateLandlordRating(landlordId) {
        const { data: list, error } = await supabase
            .from('landlord_ratings_v2')
            .select('overall_computed_avg')
            .eq('landlord_id', landlordId);

        if (error) throw error;

        const count = (list || []).length;
        const avg = count > 0
            ? parseFloat((list.reduce((s, r) => s + parseFloat(r.overall_computed_avg), 0) / count).toFixed(2))
            : 0.00;

        await supabase
            .from('users')
            .update({ 
                landlord_average_rating: avg, 
                landlord_rating_count: count 
            })
            .eq('id', landlordId);
    }
};

module.exports = landlordRatingModel;
