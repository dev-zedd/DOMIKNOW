const supabase = require('../config/supabaseClient');

const propertyRatingModel = {
    /**
     * Check if tenant has an eligible lease for this property.
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
     * Find all eligible leases for a tenant and check if they have already rated the property.
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

        // Fetch property ratings this tenant already submitted
        const { data: ratings, error: ratErr } = await supabase
            .from('property_ratings')
            .select('lease_id')
            .eq('tenant_id', tenantId);

        if (ratErr) {
            // If table does not exist or has issues, fallback to empty array
            console.warn('Property ratings fetch error (table might not exist yet):', ratErr.message);
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
     * Check for existing property rating for a given lease (duplicate guard).
     */
    async findExistingRating(tenantId, leaseId) {
        const { data, error } = await supabase
            .from('property_ratings')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('lease_id', leaseId)
            .maybeSingle();

        if (error) {
            if (error.message.includes('relation "public.property_ratings" does not exist')) {
                return null;
            }
            throw error;
        }
        return data || null;
    },

    /**
     * Create a new property rating.
     */
    async createRating(ratingData) {
        // Calculate overall_computed_avg
        const sum = 
            parseInt(ratingData.cleanliness) +
            parseInt(ratingData.safety) +
            parseInt(ratingData.comfort) +
            parseInt(ratingData.amenities) +
            parseInt(ratingData.location) +
            parseInt(ratingData.internet_availability) +
            parseInt(ratingData.water_supply) +
            parseInt(ratingData.electricity_reliability) +
            parseInt(ratingData.noise_level) +
            parseInt(ratingData.overall_satisfaction);
        
        const avg = parseFloat((sum / 10).toFixed(2));
        ratingData.overall_computed_avg = avg;

        const { data, error } = await supabase
            .from('property_ratings')
            .insert([ratingData])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Update an existing property rating.
     */
    async updateRating(id, tenantId, updateData) {
        // Recalculate average if any rating values are being updated
        if (
            updateData.cleanliness !== undefined ||
            updateData.safety !== undefined ||
            updateData.comfort !== undefined ||
            updateData.amenities !== undefined ||
            updateData.location !== undefined ||
            updateData.internet_availability !== undefined ||
            updateData.water_supply !== undefined ||
            updateData.electricity_reliability !== undefined ||
            updateData.noise_level !== undefined ||
            updateData.overall_satisfaction !== undefined
        ) {
            // First fetch the existing record to fill missing fields
            const existing = await this.findById(id);
            if (!existing) throw new Error('Rating not found');

            const cleanliness = updateData.cleanliness !== undefined ? updateData.cleanliness : existing.cleanliness;
            const safety = updateData.safety !== undefined ? updateData.safety : existing.safety;
            const comfort = updateData.comfort !== undefined ? updateData.comfort : existing.comfort;
            const amenities = updateData.amenities !== undefined ? updateData.amenities : existing.amenities;
            const location = updateData.location !== undefined ? updateData.location : existing.location;
            const internet_availability = updateData.internet_availability !== undefined ? updateData.internet_availability : existing.internet_availability;
            const water_supply = updateData.water_supply !== undefined ? updateData.water_supply : existing.water_supply;
            const electricity_reliability = updateData.electricity_reliability !== undefined ? updateData.electricity_reliability : existing.electricity_reliability;
            const noise_level = updateData.noise_level !== undefined ? updateData.noise_level : existing.noise_level;
            const overall_satisfaction = updateData.overall_satisfaction !== undefined ? updateData.overall_satisfaction : existing.overall_satisfaction;

            const sum = 
                parseInt(cleanliness) +
                parseInt(safety) +
                parseInt(comfort) +
                parseInt(amenities) +
                parseInt(location) +
                parseInt(internet_availability) +
                parseInt(water_supply) +
                parseInt(electricity_reliability) +
                parseInt(noise_level) +
                parseInt(overall_satisfaction);
            
            updateData.overall_computed_avg = parseFloat((sum / 10).toFixed(2));
        }

        const { data, error } = await supabase
            .from('property_ratings')
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
            .from('property_ratings')
            .select(`
                *,
                lease_records (
                    lease_number,
                    lease_status
                ),
                landlord:users!property_ratings_landlord_id_fkey (
                    full_name
                ),
                properties (
                    property_name
                )
            `)
            .eq('tenant_id', tenantId)
            .order('submitted_at', { ascending: false });

        if (error) {
            if (error.message.includes('relation "public.property_ratings" does not exist')) {
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
            .from('property_ratings')
            .select(`
                *,
                lease_records (
                    lease_number,
                    lease_status
                ),
                landlord:users!property_ratings_landlord_id_fkey (
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
     * Fetch ratings received for landlord's properties.
     */
    async findByLandlordId(landlordId) {
        const { data, error } = await supabase
            .from('property_ratings')
            .select(`
                *,
                tenant:users!property_ratings_tenant_id_fkey (
                    full_name
                ),
                properties (
                    property_name
                )
            `)
            .eq('landlord_id', landlordId)
            .order('submitted_at', { ascending: false });

        if (error) {
            if (error.message.includes('relation "public.property_ratings" does not exist')) {
                return [];
            }
            throw error;
        }
        return data || [];
    },

    /**
     * Recalculate average_rating and rating_count for the property.
     */
    async recalculatePropertyRating(propertyId) {
        const { data: list, error } = await supabase
            .from('property_ratings')
            .select('overall_computed_avg')
            .eq('property_id', propertyId);

        if (error) throw error;

        const count = (list || []).length;
        const avg = count > 0
            ? parseFloat((list.reduce((s, r) => s + parseFloat(r.overall_computed_avg), 0) / count).toFixed(2))
            : 0.00;

        await supabase
            .from('properties')
            .update({ 
                average_rating: avg, 
                rating_count: count, 
                updated_at: new Date().toISOString() 
            })
            .eq('id', propertyId);
    }
};

module.exports = propertyRatingModel;
