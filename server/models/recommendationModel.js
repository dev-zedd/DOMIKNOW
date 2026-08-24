const supabase = require('../config/supabaseClient');

const COMPLETED_MAINTENANCE_STATUSES = new Set(['completed', 'verified', 'closed']);
const INVALID_MAINTENANCE_STATUSES = new Set(['rejected', 'cancelled']);
// Keep authenticated ratings aligned with the lease states accepted by
// propertyRatingModel, including the legacy `completed` state.
const VALID_LEASE_STATUSES = new Set(['active', 'expired', 'terminated', 'ended', 'completed']);
const LONG_TERM_PROPERTY_TYPES = new Set(['apartment', 'boarding_house', 'bedspace', 'studio_unit', 'room_for_rent', 'house']);

function groupBy(rows, key) {
    return (rows || []).reduce((groups, row) => {
        const value = row[key];
        if (value === null || value === undefined) return groups;
        if (!groups[value]) groups[value] = [];
        groups[value].push(row);
        return groups;
    }, {});
}

async function optionalSelect(table, columns, configure = query => query) {
    try {
        const { data, error } = await configure(supabase.from(table).select(columns));
        if (error) {
            console.warn(`[recommendationModel] ${table} data unavailable: ${error.message || error.code}`);
            return [];
        }
        return data || [];
    } catch (error) {
        console.warn(`[recommendationModel] ${table} data unavailable: ${error.message}`);
        return [];
    }
}

function deriveInventory(propertyUnits, bedsByUnit) {
    const availableRents = [];
    const availableListings = [];

    propertyUnits.forEach(unit => {
        const isPerBed = unit.rental_style === 'per_bed';
        if (isPerBed) {
            const availableBeds = (bedsByUnit[unit.id] || []).filter(bed => bed.status === 'available');
            availableBeds.forEach(bed => {
                const rent = Number(bed.monthly_rent);
                if (Number.isFinite(rent) && rent > 0) availableRents.push(rent);
            });
            if (availableBeds.length > 0) {
                availableListings.push({ capacity: availableBeds.length, count: availableBeds.length });
            }
            return;
        }

        if (unit.status !== 'available') return;
        const rent = Number(unit.monthly_rent);
        if (Number.isFinite(rent) && rent > 0) availableRents.push(rent);
        availableListings.push({ capacity: Math.max(1, Number(unit.capacity) || 1), count: 1 });
    });

    return {
        available_rents: availableRents,
        available_listing_count: availableListings.reduce((sum, item) => sum + item.count, 0),
        min_available_monthly_rent: availableRents.length ? Math.min(...availableRents) : null,
        max_available_monthly_rent: availableRents.length ? Math.max(...availableRents) : null,
        maximum_available_occupants: availableListings.length
            ? Math.max(...availableListings.map(item => item.capacity))
            : 0
    };
}

function parsePolicies(property) {
    if (property.policies && typeof property.policies === 'object' && !Array.isArray(property.policies)) return property.policies;
    if (typeof property.house_rules !== 'string') return {};
    try {
        const parsed = JSON.parse(property.house_rules);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
        return {};
    }
}

function completedOnTime(request, latestAssignment) {
    if (!request.completed_at || !latestAssignment?.due_date) return false;
    const completedAt = new Date(request.completed_at);
    const dueAt = new Date(`${latestAssignment.due_date}T23:59:59.999Z`);
    return Number.isFinite(completedAt.getTime()) && Number.isFinite(dueAt.getTime()) && completedAt <= dueAt;
}

const recommendationModel = {
    async getCanonicalCandidates() {
        let properties = [];
        const joined = await supabase
            .from('properties')
            .select('*, landlord:users!properties_landlord_id_fkey(id, full_name, is_verified, account_status)');

        if (!joined.error) {
            properties = joined.data || [];
        } else {
            const { data: rawProperties, error: propertyError } = await supabase
                .from('properties')
                .select('*');
            if (propertyError) throw propertyError;
            properties = rawProperties || [];

            const landlordIds = [...new Set(properties.map(property => property.landlord_id).filter(Boolean))];
            const landlords = landlordIds.length
                ? await optionalSelect('users', 'id, full_name, is_verified, account_status', query => query.in('id', landlordIds))
                : [];
            const landlordMap = Object.fromEntries(landlords.map(landlord => [landlord.id, landlord]));
            properties = properties.map(property => ({ ...property, landlord: landlordMap[property.landlord_id] || null }));
        }

        if (properties.length === 0) return [];
        const propertyIds = properties.map(property => property.id);

        const [amenities, documents, units, ratings, maintenance, complaints, verifiedReports] = await Promise.all([
            optionalSelect('property_amenities', 'property_id, amenity_name', query => query.in('property_id', propertyIds)),
            optionalSelect('property_documents', 'property_id, document_type, status', query => query.in('property_id', propertyIds)),
            optionalSelect('property_units', 'id, property_id, monthly_rent, status, rental_style, capacity, unit_type', query => query.in('property_id', propertyIds)),
            optionalSelect('property_ratings', 'property_id, tenant_id, lease_id, overall_computed_avg', query => query.in('property_id', propertyIds)),
            optionalSelect('maintenance_requests', 'id, property_id, status, completed_at', query => query.in('property_id', propertyIds)),
            optionalSelect('complaints', 'id, property_id, status', query => query.in('property_id', propertyIds)),
            optionalSelect('landlord_reports', 'id, property_id, status', query => query.in('property_id', propertyIds).eq('status', 'approved'))
        ]);

        const unitIds = units.map(unit => unit.id);
        const ratingLeaseIds = ratings.map(rating => rating.lease_id).filter(Boolean);
        const maintenanceIds = maintenance.map(request => request.id);
        const [beds, leases, assignments] = await Promise.all([
            unitIds.length
                ? optionalSelect('unit_beds', 'unit_id, monthly_rent, status', query => query.in('unit_id', unitIds))
                : [],
            ratingLeaseIds.length
                ? optionalSelect('lease_records', 'id, tenant_id, property_id, lease_status', query => query.in('id', ratingLeaseIds))
                : [],
            maintenanceIds.length
                ? optionalSelect('maintenance_assignments', 'maintenance_request_id, due_date, assigned_at', query => query.in('maintenance_request_id', maintenanceIds))
                : []
        ]);

        const amenitiesByProperty = groupBy(amenities, 'property_id');
        const documentsByProperty = groupBy(documents, 'property_id');
        const unitsByProperty = groupBy(units, 'property_id');
        const bedsByUnit = groupBy(beds, 'unit_id');
        const maintenanceByProperty = groupBy(maintenance, 'property_id');
        const complaintsByProperty = groupBy(complaints, 'property_id');
        const reportsByProperty = groupBy(verifiedReports, 'property_id');
        const leaseMap = Object.fromEntries(leases.map(lease => [lease.id, lease]));
        const assignmentsByRequest = groupBy(assignments, 'maintenance_request_id');

        const ratingMetrics = {};
        ratings.forEach(rating => {
            const lease = leaseMap[rating.lease_id];
            const stars = Number(rating.overall_computed_avg);
            const validRelationship = lease
                && lease.tenant_id === rating.tenant_id
                && lease.property_id === rating.property_id
                && VALID_LEASE_STATUSES.has(lease.lease_status);
            if (!validRelationship || !Number.isFinite(stars) || stars < 1 || stars > 5) return;
            if (!ratingMetrics[rating.property_id]) ratingMetrics[rating.property_id] = { count: 0, sum: 0 };
            ratingMetrics[rating.property_id].count += 1;
            ratingMetrics[rating.property_id].sum += stars;
        });

        return properties.map(property => {
            const propertyDocuments = documentsByProperty[property.id] || [];
            const hasPermit = propertyDocuments.some(document => document.document_type === 'government_permit');
            const hasOwnershipAuthority = propertyDocuments.some(document =>
                ['ownership_proof', 'authorization_letter'].includes(document.document_type));
            const hasValidPermit = propertyDocuments.some(document =>
                document.document_type === 'government_permit' && document.status === 'accepted');
            const hasValidOwnershipAuthority = propertyDocuments.some(document =>
                ['ownership_proof', 'authorization_letter'].includes(document.document_type) && document.status === 'accepted');
            const inventory = deriveInventory(unitsByProperty[property.id] || [], bedsByUnit);
            const propertyMaintenance = (maintenanceByProperty[property.id] || [])
                .filter(request => !INVALID_MAINTENANCE_STATUSES.has(request.status));
            const completedMaintenance = propertyMaintenance.filter(request => COMPLETED_MAINTENANCE_STATUSES.has(request.status));
            const timelyMaintenance = completedMaintenance.filter(request => {
                const ordered = [...(assignmentsByRequest[request.id] || [])]
                    .sort((a, b) => new Date(b.assigned_at) - new Date(a.assigned_at));
                return completedOnTime(request, ordered[0]);
            });
            const verifiedComplaints = (complaintsByProperty[property.id] || [])
                .filter(complaint => ['in_progress', 'resolved', 'closed'].includes(complaint.status));
            const resolvedComplaints = verifiedComplaints.filter(complaint => ['resolved', 'closed'].includes(complaint.status));
            const approvedReports = reportsByProperty[property.id] || [];
            const propertyRatings = ratingMetrics[property.id] || { count: 0, sum: 0 };
            const landlord = property.landlord || {};

            return {
                ...property,
                amenities: (amenitiesByProperty[property.id] || []).map(item => item.amenity_name),
                available_rents: inventory.available_rents,
                unit_stats: inventory,
                property_active: property.status === 'approved',
                property_approved: property.status === 'approved',
                landlord_verified: landlord.is_verified === true && landlord.account_status === 'active',
                suspended: landlord.account_status === 'disabled',
                long_term_residential_eligible: LONG_TERM_PROPERTY_TYPES.has(property.property_type),
                required_documents_complete: hasPermit && hasOwnershipAuthority,
                required_documents_valid: hasValidPermit && hasValidOwnershipAuthority,
                available_units: inventory.available_listing_count,
                monthly_rent: inventory.min_available_monthly_rent,
                maximum_occupants: inventory.maximum_available_occupants || Number(property.max_occupants) || 0,
                policies: parsePolicies(property),
                ratings: {
                    valid_authenticated_review_count: propertyRatings.count,
                    valid_authenticated_star_sum: propertyRatings.sum
                },
                operations: {
                    valid_maintenance_request_count: propertyMaintenance.length,
                    completed_maintenance_request_count: completedMaintenance.length,
                    timely_completed_maintenance_request_count: timelyMaintenance.length,
                    verified_issue_count: verifiedComplaints.length + approvedReports.length,
                    resolved_verified_issue_count: resolvedComplaints.length
                },
                last_verified_at: property.admin_reviewed_at || property.updated_at || property.created_at
            };
        });
    },

    async persistRun(snapshot) {
        const runRow = {
            id: snapshot.run_id,
            formula_version: snapshot.formula_version,
            tenant_id: snapshot.tenant_id,
            generated_at: snapshot.generated_at,
            tenant_input_snapshot: snapshot.tenant_input_snapshot,
            active_criteria: snapshot.active_criteria,
            raw_importance: snapshot.raw_importance,
            normalized_weights: snapshot.normalized_weights,
            platform_priors: snapshot.platform_priors,
            candidate_count: snapshot.candidate_count,
            eligible_count: snapshot.eligible_count,
            excluded_count: snapshot.excluded_count
        };

        const { error: runError } = await supabase.from('recommendation_runs').insert([runRow]);
        if (runError) throw runError;

        try {
            if (snapshot.results.length > 0) {
                const resultRows = snapshot.results.map(result => ({
                    recommendation_run_id: snapshot.run_id,
                    property_id: result.property_id,
                    rank: result.rank,
                    eligibility_passed: true,
                    raw_score: result.raw_score,
                    display_score: result.display_score,
                    criterion_scores: result.criterion_scores,
                    fallback_flags: result.fallback_flags,
                    property_input_snapshot: result.property_input_snapshot,
                    explanation_snapshot: result.explanation_snapshot
                }));
                const { error } = await supabase.from('recommendation_candidates').insert(resultRows);
                if (error) throw error;
            }
            if (snapshot.exclusions.length > 0) {
                const exclusionRows = snapshot.exclusions.map(exclusion => ({
                    recommendation_run_id: snapshot.run_id,
                    property_id: exclusion.property_id,
                    reason_codes: exclusion.reason_codes
                }));
                const { error } = await supabase.from('recommendation_exclusions').insert(exclusionRows);
                if (error) throw error;
            }
        } catch (error) {
            await supabase.from('recommendation_runs').delete().eq('id', snapshot.run_id);
            throw error;
        }
        return snapshot.run_id;
    },

    async persistRunFallback(snapshot) {
        const { data, error } = await supabase
            .from('audit_logs')
            .insert([{
                user_id: snapshot.tenant_id,
                action: 'RECOMMENDATION_RUN_MC_REC_V1_0',
                description: JSON.stringify(snapshot)
            }])
            .select('id')
            .single();
        if (error) throw error;
        return data?.id || snapshot.run_id;
    }
};

module.exports = recommendationModel;
