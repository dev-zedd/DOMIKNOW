const supabase = require('../config/supabaseClient');

const propertyModel = {
    async findApproved(filters = {}) {
        const { 
            search, barangay, property_type, tenant_type, 
            min_price, max_price, min_rating, amenities,
            limit = 20, offset = 0, sort = 'newest'
        } = filters;

        // Build base query for counting total
        let countQuery = supabase
            .from('properties')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'approved');

        // Build main query
        let query = supabase
            .from('properties')
            .select('*')
            .eq('status', 'approved');

        // Apply filters to both queries
        const applyFilters = (q) => {
            if (search) {
                q = q.or(`property_name.ilike.%${search}%,description.ilike.%${search}%,address.ilike.%${search}%`);
            }
            if (barangay) {
                q = q.eq('barangay', barangay);
            }
            if (property_type) {
                q = q.eq('property_type', property_type);
            }
            if (tenant_type) {
                q = q.eq('tenant_type_suitability', tenant_type);
            }
            if (min_price) {
                q = q.gte('monthly_rent', parseFloat(min_price));
            }
            if (max_price) {
                q = q.lte('monthly_rent', parseFloat(max_price));
            }
            if (min_rating) {
                q = q.gte('average_rating', parseFloat(min_rating));
            }
            return q;
        };

        countQuery = applyFilters(countQuery);
        query = applyFilters(query);

        // Apply sorting
        switch (sort) {
            case 'price_asc':
                query = query.order('monthly_rent', { ascending: true });
                break;
            case 'price_desc':
                query = query.order('monthly_rent', { ascending: false });
                break;
            case 'rating_desc':
                query = query.order('average_rating', { ascending: false });
                break;
            case 'newest':
            default:
                query = query.order('created_at', { ascending: false });
                break;
        }

        // Apply pagination
        query = query.range(offset, offset + limit - 1);

        // Execute queries
        const { count: total } = await countQuery;
        const { data: properties, error } = await query;
        
        if (error) throw error;

        // Fetch amenities for all these properties to perform dynamic amenity filtering and populating
        if (properties.length === 0) {
            return { properties: [], total: 0 };
        }

        const propertyIds = properties.map(p => p.id);
        const { data: amenitiesRecords, error: amenError } = await supabase
            .from('property_amenities')
            .select('property_id, amenity_name')
            .in('property_id', propertyIds);

        if (amenError) throw amenError;

        // Group amenities by property_id
        const amenitiesMap = {};
        amenitiesRecords.forEach(rec => {
            if (!amenitiesMap[rec.property_id]) {
                amenitiesMap[rec.property_id] = [];
            }
            amenitiesMap[rec.property_id].push(rec.amenity_name);
        });

        // Fetch units for all these properties
        const { data: unitsRecords } = await supabase
            .from('property_units')
            .select('id, property_id, monthly_rent, rental_style, unit_type, status')
            .in('property_id', propertyIds);

        const unitIds = unitsRecords ? unitsRecords.map(u => u.id) : [];
        const { data: bedsRecords } = await supabase
            .from('unit_beds')
            .select('unit_id, monthly_rent, status')
            .in('unit_id', unitIds.length > 0 ? unitIds : ['00000000-0000-0000-0000-000000000000']);

        // Group units by property_id
        const unitsMap = {};
        if (unitsRecords) {
            unitsRecords.forEach(u => {
                if (!unitsMap[u.property_id]) {
                    unitsMap[u.property_id] = [];
                }
                unitsMap[u.property_id].push(u);
            });
        }

        // Group beds by unit_id
        const bedsMap = {};
        if (bedsRecords) {
            bedsRecords.forEach(b => {
                if (!bedsMap[b.unit_id]) {
                    bedsMap[b.unit_id] = [];
                }
                bedsMap[b.unit_id].push(b);
            });
        }

        // Attach amenities & calculate actual rent bounds
        let results = properties.map(p => {
            const propUnits = unitsMap[p.id] || [];
            let rents = [];
            let totalSpaces = 0;
            let availableSpaces = 0;
            propUnits.forEach(u => {
                if (u.rental_style === 'per_bed' || u.unit_type === 'bedspace') {
                    const unitBeds = bedsMap[u.id] || [];
                    unitBeds.forEach(b => {
                        if (parseFloat(b.monthly_rent) > 0) rents.push(parseFloat(b.monthly_rent));
                        totalSpaces += 1;
                        if (String(b.status || '').toLowerCase() === 'available') availableSpaces += 1;
                    });
                    // Treat a bedspace unit without individual bed records as one rentable space.
                    if (unitBeds.length === 0) {
                        if (parseFloat(u.monthly_rent) > 0) rents.push(parseFloat(u.monthly_rent));
                        totalSpaces += 1;
                        if (String(u.status || '').toLowerCase() === 'available') availableSpaces += 1;
                    }
                } else {
                    if (parseFloat(u.monthly_rent) > 0) rents.push(parseFloat(u.monthly_rent));
                    totalSpaces += 1;
                    if (String(u.status || '').toLowerCase() === 'available') availableSpaces += 1;
                }
            });

            const minRent = rents.length > 0 ? Math.min(...rents) : parseFloat(p.monthly_rent || 0);
            const maxRent = rents.length > 0 ? Math.max(...rents) : parseFloat(p.monthly_rent || 0);

            return {
                ...p,
                amenities: amenitiesMap[p.id] || [],
                min_monthly_rent: minRent,
                max_monthly_rent: maxRent,
                total_space_count: totalSpaces,
                available_space_count: totalSpaces > 0 ? availableSpaces : null
            };
        });

        // Filter by amenities if requested (intersection of target amenities)
        if (amenities && amenities.length > 0) {
            const filterAmenities = Array.isArray(amenities) ? amenities : [amenities];
            results = results.filter(p => 
                filterAmenities.every(amen => p.amenities.includes(amen))
            );
        }

        return { properties: results, total: total || 0 };
    },

    async findById(id) {
        // 1. Fetch property details
        const { data: property, error } = await supabase
            .from('properties')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) throw error;
        if (!property) return null;

        // 2. Fetch amenities
        const { data: amenities, error: amenError } = await supabase
            .from('property_amenities')
            .select('amenity_name')
            .eq('property_id', id);

        if (amenError) throw amenError;

        // 3. Fetch feedback summary
        const { data: feedback, error: feedError } = await supabase
            .from('property_feedback_summary')
            .select('*')
            .eq('property_id', id)
            .maybeSingle();

        // 4. Fetch unit details & aggregate stats
        let units = [];
        try {
            const unitModel = require('./unitModel');
            units = await unitModel.findByPropertyId(id);
        } catch (uErr) {
            console.warn('Note on unit fetching for property:', uErr.message);
        }

        const availableUnits = units.filter(u => u.status === 'available');
        const rents = units.map(u => parseFloat(u.monthly_rent || property.monthly_rent || 0)).filter(r => r > 0);
        const minRent = rents.length > 0 ? Math.min(...rents) : parseFloat(property.monthly_rent || 0);
        const maxRent = rents.length > 0 ? Math.max(...rents) : parseFloat(property.monthly_rent || 0);

        return {
            ...property,
            amenities: amenities.map(a => a.amenity_name),
            feedback_summary: feedback || null,
            units: units,
            unit_stats: {
                total_units: units.length,
                available_units: availableUnits.length,
                min_monthly_rent: minRent,
                max_monthly_rent: maxRent
            }
        };
    },


    async getRecommendationCandidates() {
        // Fetch all approved properties along with their landlord information and amenities
        let properties = [];
        try {
            const { data, error } = await supabase
                .from('properties')
                .select('*, landlord:users(id, full_name, landlord_trust_score)')
                .eq('status', 'approved');

            if (!error && data) {
                properties = data;
            } else {
                const { data: rawProps } = await supabase.from('properties').select('*').eq('status', 'approved');
                properties = rawProps || [];
            }
        } catch (e) {
            const { data: rawProps } = await supabase.from('properties').select('*').eq('status', 'approved');
            properties = rawProps || [];
        }

        if (properties.length === 0) return [];

        const propertyIds = properties.map(p => p.id);
        const { data: amenities, error: amenError } = await supabase
            .from('property_amenities')
            .select('property_id, amenity_name')
            .in('property_id', propertyIds);

        if (amenError) throw amenError;

        const amenitiesMap = {};
        amenities.forEach(rec => {
            if (!amenitiesMap[rec.property_id]) {
                amenitiesMap[rec.property_id] = [];
            }
            amenitiesMap[rec.property_id].push(rec.amenity_name);
        });

        // Fetch feedback summaries
        const { data: feedbacks, error: feedError } = await supabase
            .from('property_feedback_summary')
            .select('*')
            .in('property_id', propertyIds);

        if (feedError) throw feedError;

        const feedbackMap = {};
        feedbacks.forEach(rec => {
            feedbackMap[rec.property_id] = rec;
        });

        return properties.map(p => ({
            ...p,
            amenities: amenitiesMap[p.id] || [],
            feedback_summary: feedbackMap[p.id] || null
        }));
    },

    async findComparisonList(propertyIds) {
        const { data: properties, error } = await supabase
            .from('properties')
            .select('*')
            .in('id', propertyIds);

        if (error) throw error;
        if (properties.length === 0) return [];

        const { data: amenities, error: amenError } = await supabase
            .from('property_amenities')
            .select('property_id, amenity_name')
            .in('property_id', propertyIds);

        if (amenError) throw amenError;

        const amenitiesMap = {};
        amenities.forEach(rec => {
            if (!amenitiesMap[rec.property_id]) {
                amenitiesMap[rec.property_id] = [];
            }
            amenitiesMap[rec.property_id].push(rec.amenity_name);
        });

        return properties.map(p => ({
            ...p,
            amenities: amenitiesMap[p.id] || []
        }));
    },

    /**
     * Deactivate all properties owned by a landlord (used on permanent ban).
     * Sets status to 'deactivated' so they are hidden from public listings.
     */
    async deactivateByLandlordId(landlordId) {
        const { data, error } = await supabase
            .from('properties')
            .update({ status: 'deactivated', updated_at: new Date() })
            .eq('landlord_id', landlordId)
            .select('id, property_name, status');

        if (error) throw error;
        return data || [];
    }
};

module.exports = propertyModel;
