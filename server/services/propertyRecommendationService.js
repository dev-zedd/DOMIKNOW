const { randomUUID } = require('crypto');

const CONSTANTS = Object.freeze({
    SCORE_MIN: 0,
    SCORE_MAX: 100,
    RATING_MIN: 1,
    RATING_MAX: 5,
    RATING_NEUTRAL: 3,
    WEIGHT_MIN: 0,
    WEIGHT_MAX: 5,
    EARTH_RADIUS_KM: 6371.0088,
    DISPLAY_DECIMAL_PLACES: 2,
    FLOAT_EPSILON: 1e-9,
    FORMULA_VERSION: 'MC-REC-v1.0'
});

const CRITERIA = Object.freeze({
    C1: 'tenant_preference_match',
    C2: 'location_suitability',
    C3: 'amenity_match',
    C4: 'authenticated_rating',
    C5: 'operations_reliability'
});

class RecommendationValidationError extends Error {
    constructor(code, message, details = null) {
        super(message);
        this.name = 'RecommendationValidationError';
        this.code = code;
        this.details = details;
    }
}

const clamp = (value, min = CONSTANTS.SCORE_MIN, max = CONSTANTS.SCORE_MAX) =>
    Math.min(max, Math.max(min, Number(value)));

const roundForDisplay = value => Number(Number(value).toFixed(CONSTANTS.DISPLAY_DECIMAL_PLACES));

const normalizeToken = value => {
    const normalized = String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    return ({
        'wi fi': 'wifi',
        aircon: 'air conditioning',
        'private bathroom': 'own cr'
    })[normalized] || normalized;
};

const uniqueTokens = values => [...new Set((Array.isArray(values) ? values : [])
    .map(normalizeToken)
    .filter(Boolean))];

const finiteOrNull = value => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const isPresentNumber = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const isValidLatitude = value => isPresentNumber(value) && Number(value) >= -90 && Number(value) <= 90;
const isValidLongitude = value => isPresentNumber(value) && Number(value) >= -180 && Number(value) <= 180;

function normalizePreferenceList(values, valueKey) {
    if (!Array.isArray(values)) return [];
    return values
        .filter(item => item && typeof item === 'object' && normalizeToken(item.key))
        .map(item => ({ key: normalizeToken(item.key), [valueKey]: item[valueKey] }));
}

function normalizeTenantProfile(input = {}) {
    const rawImportance = input.criterion_importance || {};
    const preferredTypes = input.preferred_property_types || {};
    const distance = input.distance || {};
    const budget = input.budget || {};
    const referenceLocation = input.reference_location || {};
    const requiredAmenities = uniqueTokens(input.required_amenities);
    const requiredAmenitySet = new Set(requiredAmenities);

    return {
        tenant_id: input.tenant_id || null,
        reference_location: {
            latitude: finiteOrNull(referenceLocation.latitude),
            longitude: finiteOrNull(referenceLocation.longitude)
        },
        distance: {
            ideal_distance_km: finiteOrNull(distance.ideal_distance_km),
            maximum_distance_km: finiteOrNull(distance.maximum_distance_km),
            maximum_distance_is_required: distance.maximum_distance_is_required === true
        },
        budget: {
            comfortable_monthly_budget: finiteOrNull(budget.comfortable_monthly_budget),
            hard_maximum_monthly_budget: finiteOrNull(budget.hard_maximum_monthly_budget)
        },
        preferred_property_types: {
            values: uniqueTokens(preferredTypes.values),
            required: preferredTypes.required === true
        },
        occupant_count: Number(input.occupant_count ?? 1),
        desired_amenities: uniqueTokens(input.desired_amenities).filter(item => !requiredAmenitySet.has(item)),
        required_amenities: requiredAmenities,
        soft_policy_preferences: normalizePreferenceList(input.soft_policy_preferences, 'desired_value'),
        required_policy_preferences: normalizePreferenceList(input.required_policy_preferences, 'required_value'),
        criterion_importance: Object.fromEntries(Object.entries(CRITERIA).map(([code, key]) => [
            code,
            finiteOrNull(rawImportance[code] ?? rawImportance[key]) ?? 0
        ]))
    };
}

function validateTenantProfile(profile) {
    const errors = [];
    const { latitude, longitude } = profile.reference_location;
    const { ideal_distance_km: ideal, maximum_distance_km: maximum, maximum_distance_is_required: distanceRequired } = profile.distance;
    const { comfortable_monthly_budget: comfortable, hard_maximum_monthly_budget: hardMaximum } = profile.budget;

    if ((latitude !== null || longitude !== null) && (!isValidLatitude(latitude) || !isValidLongitude(longitude))) {
        errors.push('Reference latitude and longitude must both be valid coordinates.');
    }
    if (ideal !== null && ideal < 0) errors.push('Ideal distance cannot be negative.');
    if (maximum !== null && maximum <= 0) errors.push('Maximum distance must be greater than zero.');
    if (maximum !== null && (ideal ?? 0) >= maximum) errors.push('Ideal distance must be smaller than maximum distance.');
    if (distanceRequired && maximum === null) errors.push('A required maximum distance needs a maximum distance value.');
    if (distanceRequired && (!isValidLatitude(latitude) || !isValidLongitude(longitude))) {
        errors.push('A required maximum distance needs a valid reference location.');
    }
    if (comfortable !== null && comfortable <= 0) errors.push('Comfortable monthly budget must be greater than zero.');
    if (hardMaximum !== null && hardMaximum <= 0) errors.push('Hard maximum monthly budget must be greater than zero.');
    if (comfortable !== null && hardMaximum === null) errors.push('A comfortable monthly budget requires a hard maximum monthly budget.');
    if (comfortable !== null && hardMaximum !== null && comfortable > hardMaximum) {
        errors.push('Comfortable monthly budget cannot exceed the hard maximum budget.');
    }
    if (!Number.isInteger(profile.occupant_count) || profile.occupant_count <= 0) {
        errors.push('Occupant count must be a positive whole number.');
    }
    if (profile.preferred_property_types.required && profile.preferred_property_types.values.length === 0) {
        errors.push('At least one property type is required when property type is mandatory.');
    }
    Object.entries(profile.criterion_importance).forEach(([code, value]) => {
        if (!Number.isInteger(value) || value < CONSTANTS.WEIGHT_MIN || value > CONSTANTS.WEIGHT_MAX) {
            errors.push(`${code} importance must be a whole number from 0 to 5.`);
        }
    });

    if (errors.length > 0) {
        throw new RecommendationValidationError('INVALID_TENANT_RECOMMENDATION_PROFILE', errors[0], errors);
    }
}

function determineActiveCriteria(profile) {
    const hasC1Configuration = profile.budget.comfortable_monthly_budget !== null
        || profile.budget.hard_maximum_monthly_budget !== null
        || (!profile.preferred_property_types.required && profile.preferred_property_types.values.length > 0)
        || profile.soft_policy_preferences.length > 0;
    const hasC2Configuration = isValidLatitude(profile.reference_location.latitude)
        && isValidLongitude(profile.reference_location.longitude)
        && profile.distance.maximum_distance_km !== null;
    const configuration = {
        C1: hasC1Configuration,
        C2: hasC2Configuration,
        C3: profile.desired_amenities.length > 0,
        C4: true,
        C5: true
    };

    return Object.keys(CRITERIA).filter(code =>
        profile.criterion_importance[code] > 0 && configuration[code]
    );
}

function normalizeCriterionWeights(rawImportance, activeCriteria) {
    const total = activeCriteria.reduce((sum, code) => sum + Number(rawImportance[code] || 0), 0);
    if (total <= 0) {
        throw new RecommendationValidationError(
            'NO_ACTIVE_RECOMMENDATION_CRITERIA',
            'Choose at least one available recommendation criterion with importance greater than zero.'
        );
    }
    const weights = Object.fromEntries(activeCriteria.map(code => [code, Number(rawImportance[code]) / total]));
    const sum = Object.values(weights).reduce((value, weight) => value + weight, 0);
    if (Math.abs(sum - 1) > CONSTANTS.FLOAT_EPSILON) {
        throw new Error('Normalized recommendation weights do not sum to one.');
    }
    return weights;
}

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
    if (![isValidLatitude(lat1), isValidLongitude(lon1), isValidLatitude(lat2), isValidLongitude(lon2)].every(Boolean)) {
        throw new RecommendationValidationError('INVALID_COORDINATES', 'Haversine distance requires valid coordinates.');
    }
    const radians = degrees => Number(degrees) * Math.PI / 180;
    const phi1 = radians(lat1);
    const phi2 = radians(lat2);
    const deltaPhi = radians(Number(lat2) - Number(lat1));
    const deltaLambda = radians(Number(lon2) - Number(lon1));
    const a = Math.sin(deltaPhi / 2) ** 2
        + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
    return CONSTANTS.EARTH_RADIUS_KM * c;
}

function computeLocationSuitability(distanceKm, idealDistanceKm, maximumDistanceKm) {
    const ideal = idealDistanceKm ?? 0;
    if (!Number.isFinite(distanceKm) || distanceKm < 0 || !Number.isFinite(ideal)
        || ideal < 0 || !Number.isFinite(maximumDistanceKm) || maximumDistanceKm <= 0 || ideal >= maximumDistanceKm) {
        throw new RecommendationValidationError('INVALID_DISTANCE_CONFIGURATION', 'Location suitability inputs are invalid.');
    }
    if (distanceKm <= ideal) return 100;
    if (distanceKm >= maximumDistanceKm) return 0;
    return clamp(100 * ((maximumDistanceKm - distanceKm) / (maximumDistanceKm - ideal)));
}

function propertyPolicyMap(property) {
    const policies = property.policies && typeof property.policies === 'object' && !Array.isArray(property.policies)
        ? property.policies
        : {};
    return Object.fromEntries(Object.entries(policies).map(([key, value]) => [normalizeToken(key), value]));
}

function policyValueMatches(actual, expected) {
    if (Array.isArray(actual) || Array.isArray(expected)) {
        const actualValues = uniqueTokens(Array.isArray(actual) ? actual : [actual]);
        const expectedValues = uniqueTokens(Array.isArray(expected) ? expected : [expected]);
        return expectedValues.every(value => actualValues.includes(value));
    }
    if (typeof actual === 'boolean' || typeof expected === 'boolean') return actual === expected;
    if (Number.isFinite(Number(actual)) && Number.isFinite(Number(expected)) && actual !== '' && expected !== '') {
        return Number(actual) === Number(expected);
    }
    return normalizeToken(actual) === normalizeToken(expected);
}

function computePriceSuitability(rent, comfortableBudget, hardMaximumBudget) {
    if (comfortableBudget === null && hardMaximumBudget === null) return null;
    if (!Number.isFinite(Number(rent)) || Number(rent) <= 0) return null;
    const value = Number(rent);
    if (comfortableBudget !== null && hardMaximumBudget !== null) {
        if (value <= comfortableBudget) return 100;
        if (value >= hardMaximumBudget) return 0;
        if (hardMaximumBudget === comfortableBudget) return value <= hardMaximumBudget ? 100 : 0;
        return clamp(100 * ((hardMaximumBudget - value) / (hardMaximumBudget - comfortableBudget)));
    }
    return value <= hardMaximumBudget ? 100 : 0;
}

function computeTenantPreferenceMatch(profile, property) {
    const components = {};
    const price = computePriceSuitability(
        property.monthly_rent,
        profile.budget.comfortable_monthly_budget,
        profile.budget.hard_maximum_monthly_budget
    );
    if (price !== null) components.price_suitability = price;

    if (!profile.preferred_property_types.required && profile.preferred_property_types.values.length > 0) {
        components.property_type_match = profile.preferred_property_types.values.includes(normalizeToken(property.property_type)) ? 100 : 0;
    }

    if (profile.soft_policy_preferences.length > 0) {
        const policies = propertyPolicyMap(property);
        const matched = profile.soft_policy_preferences.filter(preference =>
            Object.prototype.hasOwnProperty.call(policies, preference.key)
            && policyValueMatches(policies[preference.key], preference.desired_value)
        ).length;
        components.soft_policy_match = 100 * (matched / profile.soft_policy_preferences.length);
    }

    const values = Object.values(components);
    return {
        score: values.length > 0 ? clamp(values.reduce((sum, value) => sum + value, 0) / values.length) : null,
        components
    };
}

function computeAmenityMatch(desiredAmenities, propertyAmenities) {
    const desired = uniqueTokens(desiredAmenities);
    if (desired.length === 0) return null;
    const available = new Set(uniqueTokens(propertyAmenities));
    const matched = desired.filter(amenity => available.has(amenity));
    return {
        score: clamp(100 * (matched.length / desired.length)),
        matched,
        desired_count: desired.length
    };
}

function median(numbers) {
    if (!numbers.length) return null;
    const sorted = [...numbers].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function validRatingMetrics(property) {
    const count = Number(property.ratings?.valid_authenticated_review_count ?? 0);
    const sum = Number(property.ratings?.valid_authenticated_star_sum ?? 0);
    if (!Number.isInteger(count) || count < 0 || !Number.isFinite(sum) || sum < 0) return null;
    if (count === 0) return sum === 0 ? { count: 0, sum: 0, mean: null } : null;
    const mean = sum / count;
    if (mean < CONSTANTS.RATING_MIN || mean > CONSTANTS.RATING_MAX) return null;
    return { count, sum, mean };
}

function computeRatingPrior(properties) {
    let totalCount = 0;
    let totalStars = 0;
    const ratedPropertyCounts = [];
    properties.forEach(property => {
        const metrics = validRatingMetrics(property);
        if (!metrics) return;
        totalCount += metrics.count;
        totalStars += metrics.sum;
        if (metrics.count > 0 && property.property_active !== false && property.property_approved !== false) {
            ratedPropertyCounts.push(metrics.count);
        }
    });
    return {
        global_mean: totalCount > 0 ? totalStars / totalCount : CONSTANTS.RATING_NEUTRAL,
        rating_count_prior: Math.max(1, median(ratedPropertyCounts) ?? 1)
    };
}

function computeAuthenticatedRatingScore(propertyMean, reviewCount, globalMean, ratingCountPrior) {
    const count = Number(reviewCount);
    const priorCount = Math.max(1, Number(ratingCountPrior));
    const adjusted = count > 0
        ? ((count / (count + priorCount)) * Number(propertyMean))
            + ((priorCount / (count + priorCount)) * Number(globalMean))
        : Number(globalMean);
    return {
        adjusted_rating: adjusted,
        score: clamp(100 * ((adjusted - CONSTANTS.RATING_MIN) / (CONSTANTS.RATING_MAX - CONSTANTS.RATING_MIN))),
        prior_used: count === 0
    };
}

function validOperationsMetrics(property) {
    const raw = property.operations || {};
    const metrics = {
        valid_maintenance_request_count: Number(raw.valid_maintenance_request_count ?? 0),
        completed_maintenance_request_count: Number(raw.completed_maintenance_request_count ?? 0),
        timely_completed_maintenance_request_count: Number(raw.timely_completed_maintenance_request_count ?? 0),
        verified_issue_count: Number(raw.verified_issue_count ?? 0),
        resolved_verified_issue_count: Number(raw.resolved_verified_issue_count ?? 0)
    };
    const allWholeNonNegative = Object.values(metrics).every(value => Number.isInteger(value) && value >= 0);
    if (!allWholeNonNegative
        || metrics.completed_maintenance_request_count > metrics.valid_maintenance_request_count
        || metrics.timely_completed_maintenance_request_count > metrics.completed_maintenance_request_count
        || metrics.resolved_verified_issue_count > metrics.verified_issue_count) return null;
    return metrics;
}

function computeReliabilityPriors(properties) {
    const totals = { valid: 0, completed: 0, timelyDenominator: 0, timely: 0, issues: 0, resolved: 0 };
    properties.forEach(property => {
        const metrics = validOperationsMetrics(property);
        if (!metrics) return;
        totals.valid += metrics.valid_maintenance_request_count;
        totals.completed += metrics.completed_maintenance_request_count;
        totals.timelyDenominator += metrics.completed_maintenance_request_count;
        totals.timely += metrics.timely_completed_maintenance_request_count;
        totals.issues += metrics.verified_issue_count;
        totals.resolved += metrics.resolved_verified_issue_count;
    });
    return {
        global_mcr: totals.valid > 0 ? totals.completed / totals.valid : 0.5,
        global_tmr: totals.timelyDenominator > 0 ? totals.timely / totals.timelyDenominator : 0.5,
        global_irr: totals.issues > 0 ? totals.resolved / totals.issues : 0.5
    };
}

function computeRentalOperationsReliability(propertyOperations, priors) {
    const metrics = validOperationsMetrics({ operations: propertyOperations });
    if (!metrics) throw new RecommendationValidationError('INVALID_RECOMMENDATION_DATA', 'Operational counts are inconsistent.');
    const fallbackFlags = {
        mcr_prior_used: metrics.valid_maintenance_request_count === 0,
        tmr_prior_used: metrics.completed_maintenance_request_count === 0,
        irr_prior_used: metrics.verified_issue_count === 0
    };
    const components = {
        maintenance_completion_rate: fallbackFlags.mcr_prior_used
            ? priors.global_mcr
            : metrics.completed_maintenance_request_count / metrics.valid_maintenance_request_count,
        timely_maintenance_completion_rate: fallbackFlags.tmr_prior_used
            ? priors.global_tmr
            : metrics.timely_completed_maintenance_request_count / metrics.completed_maintenance_request_count,
        verified_issue_resolution_rate: fallbackFlags.irr_prior_used
            ? priors.global_irr
            : metrics.resolved_verified_issue_count / metrics.verified_issue_count
    };
    return {
        score: clamp(100 * (Object.values(components).reduce((sum, value) => sum + value, 0) / 3)),
        components,
        fallback_flags: fallbackFlags,
        counts: metrics
    };
}

function evaluateEligibility(profile, property, activeCriteria) {
    const reasons = [];
    if (property.property_active !== true) reasons.push('PROPERTY_INACTIVE');
    if (property.property_approved !== true) reasons.push('PROPERTY_NOT_APPROVED');
    if (property.landlord_verified !== true) reasons.push('LANDLORD_NOT_VERIFIED');
    if (property.suspended === true) reasons.push('PROPERTY_SUSPENDED');
    if (property.long_term_residential_eligible !== true) reasons.push('NOT_LONG_TERM_RESIDENTIAL_ELIGIBLE');
    if (property.required_documents_complete !== true) reasons.push('REQUIRED_DOCUMENTS_INCOMPLETE');
    if (property.required_documents_valid !== true) reasons.push('REQUIRED_DOCUMENTS_INVALID');
    if (!Number.isInteger(Number(property.available_units)) || Number(property.available_units) <= 0) reasons.push('NO_AVAILABLE_UNITS');

    if (!Number.isFinite(Number(property.maximum_occupants)) || Number(property.maximum_occupants) <= 0) {
        reasons.push('INCOMPLETE_RECOMMENDATION_DATA');
    } else if (Number(property.maximum_occupants) < profile.occupant_count) {
        reasons.push('OCCUPANCY_CAPACITY_NOT_MET');
    }

    const amenities = new Set(uniqueTokens(property.amenities));
    if (!profile.required_amenities.every(amenity => amenities.has(amenity))) reasons.push('REQUIRED_AMENITY_NOT_MET');

    if (profile.preferred_property_types.required
        && !profile.preferred_property_types.values.includes(normalizeToken(property.property_type))) {
        reasons.push('REQUIRED_PROPERTY_TYPE_NOT_MET');
    }

    const hardMaximum = profile.budget.hard_maximum_monthly_budget;
    const hasValidMonthlyRent = Number.isFinite(Number(property.monthly_rent)) && Number(property.monthly_rent) > 0;
    if (hardMaximum !== null && !hasValidMonthlyRent) {
        reasons.push('INCOMPLETE_RECOMMENDATION_DATA');
    } else if (hardMaximum !== null && Number(property.monthly_rent) > hardMaximum) {
        reasons.push('HARD_BUDGET_LIMIT_EXCEEDED');
    }

    const policies = propertyPolicyMap(property);
    if (!profile.required_policy_preferences.every(preference =>
        Object.prototype.hasOwnProperty.call(policies, preference.key)
        && policyValueMatches(policies[preference.key], preference.required_value))) {
        reasons.push('REQUIRED_POLICY_NOT_MET');
    }

    let distanceKm = null;
    const distanceNeeded = activeCriteria.includes('C2') || profile.distance.maximum_distance_is_required;
    if (distanceNeeded) {
        if (!isValidLatitude(property.latitude) || !isValidLongitude(property.longitude)) {
            reasons.push('INCOMPLETE_RECOMMENDATION_DATA');
        } else {
            distanceKm = haversineDistanceKm(
                profile.reference_location.latitude,
                profile.reference_location.longitude,
                property.latitude,
                property.longitude
            );
            if (profile.distance.maximum_distance_is_required && distanceKm > profile.distance.maximum_distance_km) {
                reasons.push('MAXIMUM_DISTANCE_EXCEEDED');
            }
        }
    }

    const priceActive = activeCriteria.includes('C1')
        && (profile.budget.comfortable_monthly_budget !== null || hardMaximum !== null);
    if (priceActive && !hasValidMonthlyRent) {
        reasons.push('INCOMPLETE_RECOMMENDATION_DATA');
    }
    if (activeCriteria.includes('C3') && !Array.isArray(property.amenities)) reasons.push('INCOMPLETE_RECOMMENDATION_DATA');
    if (activeCriteria.includes('C4') && !validRatingMetrics(property)) reasons.push('INVALID_RECOMMENDATION_DATA');
    if (activeCriteria.includes('C5') && !validOperationsMetrics(property)) reasons.push('INVALID_RECOMMENDATION_DATA');

    return { passed: reasons.length === 0, reason_codes: [...new Set(reasons)], distance_km: distanceKm };
}

function computeSuitabilityScore(scores, weights) {
    return clamp(Object.keys(weights).reduce((total, code) => total + (weights[code] * scores[code]), 0));
}

function buildExplanationData(profile, property, scores, weights, details) {
    const labels = {
        C1: 'Tenant Preference Match',
        C2: 'Location Suitability',
        C3: 'Property Attribute and Amenity Match',
        C4: 'Authenticated Rating Score',
        C5: 'Rental Operations Reliability'
    };
    const breakdown = {};
    Object.keys(weights).forEach(code => {
        const contribution = weights[code] * scores[code];
        breakdown[CRITERIA[code]] = {
            code,
            label: labels[code],
            score: scores[code],
            display_score: roundForDisplay(scores[code]),
            weight: weights[code],
            weighted_contribution: contribution,
            display_contribution: roundForDisplay(contribution)
        };
    });

    const explanations = Object.values(breakdown)
        .sort((a, b) => b.weighted_contribution - a.weighted_contribution)
        .map(item => {
            if (item.code === 'C1') return `Tenant preference match contributed ${item.display_contribution} points.`;
            if (item.code === 'C2') return `The property is ${roundForDisplay(details.distance_km)} km from your reference location.`;
            if (item.code === 'C3') return `The property matches ${details.amenities.matched.length} of ${details.amenities.desired_count} desired amenities.`;
            if (item.code === 'C4') return details.rating.review_count > 0
                ? `${details.rating.review_count} authenticated rating${details.rating.review_count === 1 ? '' : 's'} contributed to the adjusted rating score.`
                : 'No authenticated rating history yet; the platform rating prior was used.';
            return Object.values(details.reliability.fallback_flags).some(Boolean)
                ? 'Limited operational history; platform reliability priors were used where records were unavailable.'
                : 'Property-specific maintenance and verified issue-resolution records were used.';
        });

    return { criterion_breakdown: breakdown, explanations };
}

function compareCandidates(a, b) {
    const compareDescending = (left, right) => {
        const delta = Number(right || 0) - Number(left || 0);
        return Math.abs(delta) <= CONSTANTS.FLOAT_EPSILON ? 0 : delta;
    };
    let compared = compareDescending(a.raw_score, b.raw_score);
    if (compared) return compared;
    for (const code of ['C1', 'C2', 'C3', 'C4', 'C5']) {
        compared = compareDescending(a.criterion_scores[code], b.criterion_scores[code]);
        if (compared) return compared;
    }
    const aVerified = new Date(a.property.last_verified_at || 0).getTime() || 0;
    const bVerified = new Date(b.property.last_verified_at || 0).getTime() || 0;
    if (aVerified !== bVerified) return bVerified - aVerified;
    return String(a.property.id).localeCompare(String(b.property.id));
}

function recommendProperties(tenantInput, properties, options = {}) {
    const profile = normalizeTenantProfile(tenantInput);
    validateTenantProfile(profile);
    const activeCriteria = determineActiveCriteria(profile);
    const weights = normalizeCriterionWeights(profile.criterion_importance, activeCriteria);
    const ratingPrior = computeRatingPrior(properties);
    const reliabilityPriors = computeReliabilityPriors(properties);
    const candidates = [];
    const exclusions = [];

    properties.forEach(property => {
        const eligibility = evaluateEligibility(profile, property, activeCriteria);
        if (!eligibility.passed) {
            exclusions.push({ property_id: property.id, reason_codes: eligibility.reason_codes });
            return;
        }

        const scores = {};
        const details = {};
        if (activeCriteria.includes('C1')) {
            details.preference = computeTenantPreferenceMatch(profile, property);
            scores.C1 = details.preference.score;
        }
        if (activeCriteria.includes('C2')) {
            details.distance_km = eligibility.distance_km;
            scores.C2 = computeLocationSuitability(
                eligibility.distance_km,
                profile.distance.ideal_distance_km ?? 0,
                profile.distance.maximum_distance_km
            );
        }
        if (activeCriteria.includes('C3')) {
            details.amenities = computeAmenityMatch(profile.desired_amenities, property.amenities);
            scores.C3 = details.amenities.score;
        }
        if (activeCriteria.includes('C4')) {
            const ratingMetrics = validRatingMetrics(property);
            details.rating = {
                ...computeAuthenticatedRatingScore(
                    ratingMetrics.mean,
                    ratingMetrics.count,
                    ratingPrior.global_mean,
                    ratingPrior.rating_count_prior
                ),
                review_count: ratingMetrics.count,
                raw_mean: ratingMetrics.mean
            };
            scores.C4 = details.rating.score;
        }
        if (activeCriteria.includes('C5')) {
            details.reliability = computeRentalOperationsReliability(property.operations, reliabilityPriors);
            scores.C5 = details.reliability.score;
        }

        const rawScore = computeSuitabilityScore(scores, weights);
        const explanation = buildExplanationData(profile, property, scores, weights, details);
        candidates.push({
            property,
            raw_score: rawScore,
            property_suitability_score: roundForDisplay(rawScore),
            score: roundForDisplay(rawScore),
            criterion_scores: scores,
            normalized_weights: weights,
            criterion_breakdown: explanation.criterion_breakdown,
            explanations: explanation.explanations,
            distance_km: eligibility.distance_km,
            fallback_flags: {
                rating_prior_used: details.rating?.prior_used || false,
                ...(details.reliability?.fallback_flags || {})
            },
            evidence: details
        });
    });

    candidates.sort(compareCandidates);
    candidates.forEach((candidate, index) => { candidate.rank = index + 1; });

    const generatedAt = options.now ? new Date(options.now).toISOString() : new Date().toISOString();
    const snapshot = {
        run_id: options.run_id || randomUUID(),
        formula_version: CONSTANTS.FORMULA_VERSION,
        tenant_id: profile.tenant_id,
        generated_at: generatedAt,
        tenant_input_snapshot: profile,
        active_criteria: activeCriteria,
        raw_importance: Object.fromEntries(activeCriteria.map(code => [code, profile.criterion_importance[code]])),
        normalized_weights: weights,
        platform_priors: {
            rating_global_mean: ratingPrior.global_mean,
            rating_count_median: ratingPrior.rating_count_prior,
            ...reliabilityPriors
        },
        candidate_count: properties.length,
        eligible_count: candidates.length,
        excluded_count: exclusions.length,
        results: candidates.map(candidate => ({
            property_id: candidate.property.id,
            rank: candidate.rank,
            eligibility_passed: true,
            raw_score: candidate.raw_score,
            display_score: candidate.property_suitability_score,
            criterion_scores: candidate.criterion_scores,
            fallback_flags: candidate.fallback_flags,
            property_input_snapshot: {
                property_id: candidate.property.id,
                landlord_id: candidate.property.landlord_id,
                status: {
                    property_active: candidate.property.property_active,
                    property_approved: candidate.property.property_approved,
                    landlord_verified: candidate.property.landlord_verified,
                    suspended: candidate.property.suspended,
                    long_term_residential_eligible: candidate.property.long_term_residential_eligible
                },
                documents: {
                    required_documents_complete: candidate.property.required_documents_complete,
                    required_documents_valid: candidate.property.required_documents_valid
                },
                available_units: candidate.property.available_units,
                latitude: candidate.property.latitude,
                longitude: candidate.property.longitude,
                monthly_rent: candidate.property.monthly_rent,
                property_type: candidate.property.property_type,
                maximum_occupants: candidate.property.maximum_occupants,
                amenities: candidate.property.amenities,
                policies: candidate.property.policies,
                ratings: candidate.property.ratings,
                operations: candidate.property.operations,
                last_verified_at: candidate.property.last_verified_at
            },
            explanation_snapshot: {
                criterion_breakdown: candidate.criterion_breakdown,
                explanations: candidate.explanations
            }
        })),
        exclusions
    };

    return { recommendations: candidates, exclusions, snapshot };
}

module.exports = {
    CONSTANTS,
    CRITERIA,
    RecommendationValidationError,
    normalizeTenantProfile,
    validateTenantProfile,
    determineActiveCriteria,
    normalizeCriterionWeights,
    haversineDistanceKm,
    computeLocationSuitability,
    computeTenantPreferenceMatch,
    computeAmenityMatch,
    computeRatingPrior,
    computeAuthenticatedRatingScore,
    computeReliabilityPriors,
    computeRentalOperationsReliability,
    evaluateEligibility,
    computeSuitabilityScore,
    compareCandidates,
    recommendProperties,
    roundForDisplay
};
