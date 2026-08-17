const supabase = require('../config/supabaseClient');

const normalizedStatus = (value) => String(value || '').trim().toLowerCase();
const positiveAmount = (value) => {
    const amount = Number(value);
    return Number.isFinite(amount) && amount > 0 ? amount : null;
};
const optionalNonnegativeAmount = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const amount = Number(value);
    return Number.isFinite(amount) && amount >= 0 ? amount : null;
};
const normalizeBarangay = value => {
    const normalized = String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\(poblacion\)/g, '')
        .replace(/^brgy\.?\s*/, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    return ({ bagumayan: 'bagumbarangay', 'i mendiola': 'mendiola' })[normalized] || normalized;
};

function calculateRentalInventory(units = [], bedsByUnit = {}) {
    const listedRents = [];
    const availableRents = [];
    let totalListingCount = 0;
    let availableListingCount = 0;
    let availableUnitCount = 0;
    let totalBedCount = 0;
    let availableBedCount = 0;

    units.forEach(unit => {
        const unitBeds = Array.isArray(unit.beds) ? unit.beds : (bedsByUnit[unit.id] || []);
        const rentsByBed = unit.rental_style === 'per_bed' || unit.unit_type === 'bedspace';
        const unitIsAvailable = normalizedStatus(unit.status) === 'available';

        if (rentsByBed && unitBeds.length > 0) {
            let unitHasAvailableBed = false;
            totalBedCount += unitBeds.length;
            totalListingCount += unitBeds.length;

            unitBeds.forEach(bed => {
                const rent = positiveAmount(bed.monthly_rent);
                if (rent !== null) listedRents.push(rent);
                if (unitIsAvailable && normalizedStatus(bed.status) === 'available') {
                    availableListingCount += 1;
                    availableBedCount += 1;
                    unitHasAvailableBed = true;
                    if (rent !== null) availableRents.push(rent);
                }
            });

            if (unitHasAvailableBed) availableUnitCount += 1;
            return;
        }

        totalListingCount += 1;
        const rent = positiveAmount(unit.monthly_rent);
        if (rent !== null) listedRents.push(rent);
        if (unitIsAvailable) {
            availableListingCount += 1;
            availableUnitCount += 1;
            if (rent !== null) availableRents.push(rent);
        }
    });

    return {
        total_units: units.length,
        available_units: availableUnitCount,
        total_beds: totalBedCount,
        available_beds: availableBedCount,
        total_listing_count: totalListingCount,
        available_listing_count: totalListingCount > 0 ? availableListingCount : null,
        listed_rents: listedRents,
        available_rents: availableRents,
        min_monthly_rent: listedRents.length ? Math.min(...listedRents) : null,
        max_monthly_rent: listedRents.length ? Math.max(...listedRents) : null,
        min_available_monthly_rent: availableRents.length ? Math.min(...availableRents) : null,
        max_available_monthly_rent: availableRents.length ? Math.max(...availableRents) : null
    };
}

const propertyModel = {
    async findApproved(filters = {}) {
        const { 
            search, barangay, property_type, tenant_type, 
            min_price, max_price, min_rating, amenities,
            limit = 20, offset = 0, sort = 'newest'
        } = filters;

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
            if (property_type) {
                q = q.eq('property_type', property_type);
            }
            if (tenant_type) {
                q = q.eq('tenant_type_suitability', tenant_type);
            }
            if (min_rating) {
                q = q.gte('average_rating', parseFloat(min_rating));
            }
            return q;
        };

        query = applyFilters(query);

        // Inventory-derived price filtering and sorting happen after unit/bed aggregation.
        query = query.order('created_at', { ascending: false });

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
        const { data: unitsRecords, error: unitsError } = await supabase
            .from('property_units')
            .select('id, property_id, monthly_rent, rental_style, unit_type, status')
            .in('property_id', propertyIds);
        if (unitsError) throw unitsError;

        const unitIds = unitsRecords ? unitsRecords.map(u => u.id) : [];
        const { data: bedsRecords, error: bedsError } = await supabase
            .from('unit_beds')
            .select('unit_id, monthly_rent, status')
            .in('unit_id', unitIds.length > 0 ? unitIds : ['00000000-0000-0000-0000-000000000000']);
        if (bedsError) throw bedsError;

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
            const inventory = calculateRentalInventory(propUnits, bedsMap);

            return {
                ...p,
                amenities: amenitiesMap[p.id] || [],
                min_monthly_rent: inventory.min_monthly_rent,
                max_monthly_rent: inventory.max_monthly_rent,
                min_available_monthly_rent: inventory.min_available_monthly_rent,
                max_available_monthly_rent: inventory.max_available_monthly_rent,
                total_space_count: inventory.total_listing_count,
                available_space_count: inventory.available_listing_count,
                unit_stats: inventory
            };
        });

        // Filter by amenities if requested (intersection of target amenities)
        if (barangay) {
            results = results.filter(property => normalizeBarangay(property.barangay) === normalizeBarangay(barangay));
        }

        if (amenities && amenities.length > 0) {
            const filterAmenities = Array.isArray(amenities) ? amenities : [amenities];
            const normalizedAmenities = filterAmenities.map(amenity => String(amenity).trim().toLowerCase());
            results = results.filter(property => {
                const propertyAmenities = property.amenities.map(amenity => String(amenity).trim().toLowerCase());
                return normalizedAmenities.every(amenity => propertyAmenities.includes(amenity));
            });
        }

        const parsedMinPrice = optionalNonnegativeAmount(min_price);
        const parsedMaxPrice = optionalNonnegativeAmount(max_price);
        if (parsedMinPrice !== null || parsedMaxPrice !== null) {
            results = results.filter(property => {
                const rates = property.unit_stats.available_rents.length
                    ? property.unit_stats.available_rents
                    : property.unit_stats.listed_rents;
                return rates.some(rate =>
                    (parsedMinPrice === null || rate >= parsedMinPrice)
                    && (parsedMaxPrice === null || rate <= parsedMaxPrice)
                );
            });
        }

        const comparableRent = (property, fallback) => property.min_available_monthly_rent ?? property.min_monthly_rent ?? fallback;
        if (sort === 'price_asc') results.sort((a, b) => comparableRent(a, Number.POSITIVE_INFINITY) - comparableRent(b, Number.POSITIVE_INFINITY));
        else if (sort === 'price_desc') results.sort((a, b) => comparableRent(b, Number.NEGATIVE_INFINITY) - comparableRent(a, Number.NEGATIVE_INFINITY));
        else if (sort === 'rating_desc') {
            const verifiedRating = property => Number(property.rating_count) > 0 && Number(property.average_rating) >= 1
                ? Number(property.average_rating)
                : Number.NEGATIVE_INFINITY;
            results.sort((a, b) => verifiedRating(b) - verifiedRating(a));
        }
        else results.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

        const total = results.length;
        return { properties: results.slice(offset, offset + limit), total };
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

        const inventory = calculateRentalInventory(units);

        return {
            ...property,
            amenities: amenities.map(a => a.amenity_name),
            feedback_summary: feedback || null,
            units: units,
            min_monthly_rent: inventory.min_monthly_rent,
            max_monthly_rent: inventory.max_monthly_rent,
            min_available_monthly_rent: inventory.min_available_monthly_rent,
            max_available_monthly_rent: inventory.max_available_monthly_rent,
            total_space_count: inventory.total_listing_count,
            available_space_count: inventory.available_listing_count,
            unit_stats: inventory
        };
    },


    async getRecommendationCandidates() {
        // Fetch all approved properties along with their landlord information and amenities
        let properties = [];
        try {
            const { data, error } = await supabase
                .from('properties')
                .select('*, landlord:users!properties_landlord_id_fkey(id, full_name, landlord_trust_score, landlord_average_rating, landlord_rating_count)')
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

        const landlordIds = [...new Set(properties.map(property => property.landlord_id).filter(Boolean))];
        const reliabilityMap = {};
        const reviewedTrustCaseMap = {};

        const { data: units, error: unitsError } = await supabase
            .from('property_units')
            .select('id, property_id, monthly_rent, status, rental_style, unit_type')
            .in('property_id', propertyIds);

        if (unitsError) throw unitsError;

        const unitIds = (units || []).map(unit => unit.id);
        let beds = [];
        if (unitIds.length > 0) {
            const { data: bedRows, error: bedsError } = await supabase
                .from('unit_beds')
                .select('unit_id, monthly_rent, status')
                .in('unit_id', unitIds);
            if (bedsError) throw bedsError;
            beds = bedRows || [];
        }

        const bedsByUnit = {};
        beds.forEach(bed => {
            if (!bedsByUnit[bed.unit_id]) bedsByUnit[bed.unit_id] = [];
            bedsByUnit[bed.unit_id].push(bed);
        });

        const unitsByProperty = {};
        (units || []).forEach(unit => {
            if (!unitsByProperty[unit.property_id]) unitsByProperty[unit.property_id] = [];
            unitsByProperty[unit.property_id].push(unit);
        });

        if (landlordIds.length > 0) {
            const { data: reliabilityRows, error: reliabilityError } = await supabase
                .from('landlord_ratings_v2')
                .select('landlord_id, reliability')
                .in('landlord_id', landlordIds);

            if (!reliabilityError) {
                (reliabilityRows || []).forEach(row => {
                    const value = Number(row.reliability);
                    if (!Number.isFinite(value) || value < 1 || value > 5) return;
                    if (!reliabilityMap[row.landlord_id]) reliabilityMap[row.landlord_id] = { total: 0, count: 0 };
                    reliabilityMap[row.landlord_id].total += value;
                    reliabilityMap[row.landlord_id].count += 1;
                });
            }

            const { data: reviewedCases, error: reviewedCasesError } = await supabase
                .from('landlord_reports')
                .select('landlord_id')
                .in('landlord_id', landlordIds)
                .eq('status', 'approved');

            if (!reviewedCasesError) {
                (reviewedCases || []).forEach(row => {
                    reviewedTrustCaseMap[row.landlord_id] = (reviewedTrustCaseMap[row.landlord_id] || 0) + 1;
                });
            }
        }

        return properties.map(p => {
            const reliability = reliabilityMap[p.landlord_id];
            const propertyUnits = unitsByProperty[p.id] || [];
            const inventory = calculateRentalInventory(propertyUnits, bedsByUnit);

            return {
                ...p,
                amenities: amenitiesMap[p.id] || [],
                feedback_summary: feedbackMap[p.id] || null,
                available_rents: inventory.available_rents,
                unit_stats: inventory,
                recommendation_evidence: {
                    landlord_reliability: reliability?.count
                        ? Number((reliability.total / reliability.count).toFixed(2))
                        : null,
                    landlord_reliability_count: reliability?.count || 0,
                    reviewed_trust_case_count: reviewedTrustCaseMap[p.landlord_id] || 0
                }
            };
        });
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
