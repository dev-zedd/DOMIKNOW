const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('../server/services/propertyRecommendationService');

const baseTenant = (overrides = {}) => ({
    tenant_id: 'tenant-1',
    reference_location: { latitude: 14.4172, longitude: 121.4475 },
    distance: { ideal_distance_km: 1, maximum_distance_km: 5, maximum_distance_is_required: false },
    budget: { comfortable_monthly_budget: 3500, hard_maximum_monthly_budget: 5000 },
    preferred_property_types: { values: ['apartment'], required: false },
    occupant_count: 1,
    desired_amenities: ['WiFi', 'Parking'],
    required_amenities: [],
    soft_policy_preferences: [],
    required_policy_preferences: [],
    criterion_importance: {
        tenant_preference_match: 5,
        location_suitability: 5,
        amenity_match: 4,
        authenticated_rating: 3,
        operations_reliability: 3
    },
    ...overrides
});

const baseProperty = (overrides = {}) => ({
    id: 'property-a',
    landlord_id: 'landlord-a',
    property_active: true,
    property_approved: true,
    landlord_verified: true,
    suspended: false,
    long_term_residential_eligible: true,
    required_documents_complete: true,
    required_documents_valid: true,
    available_units: 2,
    latitude: 14.4172,
    longitude: 121.4475,
    monthly_rent: 3500,
    property_type: 'apartment',
    maximum_occupants: 2,
    amenities: ['WiFi', 'Parking'],
    policies: {},
    ratings: { valid_authenticated_review_count: 0, valid_authenticated_star_sum: 0 },
    operations: {
        valid_maintenance_request_count: 0,
        completed_maintenance_request_count: 0,
        timely_completed_maintenance_request_count: 0,
        verified_issue_count: 0,
        resolved_verified_issue_count: 0
    },
    last_verified_at: '2026-08-01T00:00:00.000Z',
    ...overrides
});

const eligibilityReason = (property, tenant = baseTenant()) => {
    const profile = service.normalizeTenantProfile(tenant);
    const active = service.determineActiveCriteria(profile);
    return service.evaluateEligibility(profile, property, active).reason_codes;
};

test('REC-001 unverified landlord is excluded', () => {
    assert.ok(eligibilityReason(baseProperty({ landlord_verified: false })).includes('LANDLORD_NOT_VERIFIED'));
});

test('REC-002 unapproved property is excluded', () => {
    assert.ok(eligibilityReason(baseProperty({ property_approved: false })).includes('PROPERTY_NOT_APPROVED'));
});

test('REC-003 suspended property is excluded', () => {
    assert.ok(eligibilityReason(baseProperty({ suspended: true })).includes('PROPERTY_SUSPENDED'));
});

test('REC-004 property without an available unit is excluded', () => {
    assert.ok(eligibilityReason(baseProperty({ available_units: 0 })).includes('NO_AVAILABLE_UNITS'));
});

test('REC-005 occupancy above capacity is excluded', () => {
    assert.ok(eligibilityReason(baseProperty({ maximum_occupants: 1 }), baseTenant({ occupant_count: 2 })).includes('OCCUPANCY_CAPACITY_NOT_MET'));
});

test('REC-006 missing required amenity is excluded', () => {
    const tenant = baseTenant({ required_amenities: ['CCTV'] });
    assert.ok(eligibilityReason(baseProperty(), tenant).includes('REQUIRED_AMENITY_NOT_MET'));
});

test('REC-007 hard budget excess is excluded', () => {
    assert.ok(eligibilityReason(baseProperty({ monthly_rent: 5100 })).includes('HARD_BUDGET_LIMIT_EXCEEDED'));
});

test('REC-008 mandatory maximum distance excess is excluded', () => {
    const tenant = baseTenant({
        distance: { ideal_distance_km: 0, maximum_distance_km: 1, maximum_distance_is_required: true }
    });
    const property = baseProperty({ latitude: 14.47, longitude: 121.4475 });
    assert.ok(eligibilityReason(property, tenant).includes('MAXIMUM_DISTANCE_EXCEEDED'));
});

test('mandatory maximum distance remains an eligibility gate when C2 importance is zero', () => {
    const tenant = baseTenant({
        distance: { ideal_distance_km: 0, maximum_distance_km: 1, maximum_distance_is_required: true },
        criterion_importance: {
            tenant_preference_match: 5,
            location_suitability: 0,
            amenity_match: 4,
            authenticated_rating: 3,
            operations_reliability: 3
        }
    });
    const property = baseProperty({ latitude: 14.47, longitude: 121.4475 });
    assert.ok(eligibilityReason(property, tenant).includes('MAXIMUM_DISTANCE_EXCEEDED'));
});

test('mandatory maximum distance without a reference location is rejected', () => {
    const tenant = baseTenant({
        reference_location: { latitude: null, longitude: null },
        distance: { ideal_distance_km: 0, maximum_distance_km: 1, maximum_distance_is_required: true }
    });
    assert.throws(
        () => service.recommendProperties(tenant, [baseProperty()]),
        error => error.code === 'INVALID_TENANT_RECOMMENDATION_PROFILE'
    );
});

test('REC-009 Haversine known-coordinate distance is within tolerance', () => {
    const distance = service.haversineDistanceKm(0, 0, 0, 1);
    assert.ok(Math.abs(distance - 111.1950802335) < 0.000001);
});

test('REC-010 location inside ideal distance scores 100', () => {
    assert.equal(service.computeLocationSuitability(0.5, 1, 5), 100);
});

test('REC-011 location at maximum distance scores 0', () => {
    assert.equal(service.computeLocationSuitability(5, 1, 5), 0);
});

test('REC-012 mid-range location uses the canonical piecewise score', () => {
    assert.equal(service.computeLocationSuitability(1.8, 1, 5), 80);
});

test('REC-013 all desired amenities score 100', () => {
    assert.equal(service.computeAmenityMatch(['WiFi', 'Parking'], ['parking', 'Wi-Fi']).score, 100);
});

test('REC-014 no desired amenities makes C3 inactive', () => {
    const profile = service.normalizeTenantProfile(baseTenant({ desired_amenities: [] }));
    assert.equal(service.determineActiveCriteria(profile).includes('C3'), false);
});

test('REC-015 unrated property uses global rating prior', () => {
    const result = service.computeAuthenticatedRatingScore(null, 0, 4.2, 8);
    assert.equal(result.adjusted_rating, 4.2);
    assert.equal(result.prior_used, true);
});

test('REC-016 adjusted authenticated rating matches manual calculation', () => {
    const result = service.computeAuthenticatedRatingScore(4.6, 18, 4.2, 8);
    assert.ok(Math.abs(result.score - 86.9230769231) < 0.000001);
});

test('REC-017 empty platform ratings use C=3 and m=1', () => {
    assert.deepEqual(service.computeRatingPrior([baseProperty()]), { global_mean: 3, rating_count_prior: 1 });
});

test('platform rating mean uses all authenticated history while m uses active approved properties', () => {
    const prior = service.computeRatingPrior([
        baseProperty({
            id: 'active-rated',
            ratings: { valid_authenticated_review_count: 2, valid_authenticated_star_sum: 10 }
        }),
        baseProperty({
            id: 'historical-unapproved',
            property_active: false,
            property_approved: false,
            ratings: { valid_authenticated_review_count: 6, valid_authenticated_star_sum: 18 }
        })
    ]);
    assert.deepEqual(prior, { global_mean: 3.5, rating_count_prior: 2 });
});

test('REC-018 missing property operations use platform priors', () => {
    const result = service.computeRentalOperationsReliability(baseProperty().operations, {
        global_mcr: 0.8, global_tmr: 0.7, global_irr: 0.6
    });
    assert.equal(result.score, 70);
    assert.ok(Object.values(result.fallback_flags).every(Boolean));
});

test('REC-019 invalid fractional operational counts are rejected', () => {
    assert.throws(() => service.computeRentalOperationsReliability({
        valid_maintenance_request_count: 25,
        completed_maintenance_request_count: 23,
        timely_completed_maintenance_request_count: 18.4,
        verified_issue_count: 10,
        resolved_verified_issue_count: 9
    }, { global_mcr: 0.5, global_tmr: 0.5, global_irr: 0.5 }), error => error.code === 'INVALID_RECOMMENDATION_DATA');
});

test('REC-019b complete whole-number operations calculate equal component contribution', () => {
    const result = service.computeRentalOperationsReliability({
        valid_maintenance_request_count: 25,
        completed_maintenance_request_count: 23,
        timely_completed_maintenance_request_count: 20,
        verified_issue_count: 10,
        resolved_verified_issue_count: 9
    }, { global_mcr: 0.5, global_tmr: 0.5, global_irr: 0.5 });
    const expected = 100 * (((23 / 25) + (20 / 23) + (9 / 10)) / 3);
    assert.ok(Math.abs(result.score - expected) < 0.000001);
});

test('REC-020 normalized active weights total one', () => {
    const weights = service.normalizeCriterionWeights({ C1: 5, C2: 5, C3: 4, C4: 3, C5: 3 }, ['C1', 'C2', 'C3', 'C4', 'C5']);
    assert.ok(Math.abs(Object.values(weights).reduce((sum, value) => sum + value, 0) - 1) <= 1e-9);
});

test('REC-021 all available criterion importance at zero is rejected', () => {
    const tenant = baseTenant({ criterion_importance: {
        tenant_preference_match: 0,
        location_suitability: 0,
        amenity_match: 0,
        authenticated_rating: 0,
        operations_reliability: 0
    } });
    assert.throws(() => service.recommendProperties(tenant, [baseProperty()]), error => error.code === 'NO_ACTIVE_RECOMMENDATION_CRITERIA');
});

test('REC-022 canonical WSM vector produces 84.6801282051', () => {
    const weights = { C1: 0.25, C2: 0.25, C3: 0.20, C4: 0.15, C5: 0.15 };
    const scores = { C1: 87.5, C2: 80, C3: 83.333333333333, C4: 86.923076923077, C5: 87.333333333333 };
    assert.ok(Math.abs(service.computeSuitabilityScore(scores, weights) - 84.680128205128) < 0.000001);
});

test('REC-023 ranking uses descending unrounded raw score', () => {
    const items = [{ raw_score: 80.0000001, criterion_scores: {}, property: { id: 'b' } }, { raw_score: 80, criterion_scores: {}, property: { id: 'a' } }];
    items.sort(service.compareCandidates);
    assert.equal(items[0].property.id, 'b');
});

test('REC-024 exact tie uses canonical criterion then property-id tie-breaks', () => {
    const items = [
        { raw_score: 80, criterion_scores: { C1: 70, C2: 90 }, property: { id: 'b', last_verified_at: '2026-01-01' } },
        { raw_score: 80, criterion_scores: { C1: 80, C2: 20 }, property: { id: 'z', last_verified_at: '2025-01-01' } }
    ];
    items.sort(service.compareCandidates);
    assert.equal(items[0].property.id, 'z');
});

test('REC-025 explanations are derived from active computed factors', () => {
    const result = service.recommendProperties(baseTenant(), [baseProperty()]);
    assert.equal(result.recommendations[0].explanations.length, 5);
    assert.ok(result.recommendations[0].explanations.every(value => typeof value === 'string' && value.length > 0));
});

test('REC-026 missing coordinates with active C2 excludes property', () => {
    const result = service.recommendProperties(baseTenant(), [baseProperty({ latitude: null })]);
    assert.ok(result.exclusions[0].reason_codes.includes('INCOMPLETE_RECOMMENDATION_DATA'));
});

test('REC-027 same snapshot input and priors reproduce score and rank', () => {
    const options = { now: '2026-08-24T00:00:00.000Z', run_id: 'fixed-run' };
    const one = service.recommendProperties(baseTenant(), [baseProperty()], options);
    const two = service.recommendProperties(baseTenant(), [baseProperty()], options);
    assert.deepEqual(one.snapshot, two.snapshot);
});

test('REC-028 display rounds to two decimals while raw score is preserved', () => {
    const result = service.recommendProperties(baseTenant(), [baseProperty()]);
    const item = result.recommendations[0];
    assert.equal(item.property_suitability_score, Number(item.raw_score.toFixed(2)));
    assert.equal(typeof item.raw_score, 'number');
});

test('hard maximum budget requires valid rent even when C1 importance is zero', () => {
    const tenant = baseTenant({
        budget: { comfortable_monthly_budget: null, hard_maximum_monthly_budget: 5000 },
        criterion_importance: {
            tenant_preference_match: 0,
            location_suitability: 5,
            amenity_match: 4,
            authenticated_rating: 3,
            operations_reliability: 3
        }
    });
    const result = service.recommendProperties(tenant, [baseProperty({ monthly_rent: null })]);
    assert.ok(result.exclusions[0].reason_codes.includes('INCOMPLETE_RECOMMENDATION_DATA'));
});

test('required property type is an eligibility gate and is not double-counted in C1', () => {
    const tenant = baseTenant({ preferred_property_types: { values: ['apartment'], required: true } });
    const result = service.recommendProperties(tenant, [baseProperty()]);
    assert.equal(Object.hasOwn(result.recommendations[0].evidence.preference.components, 'property_type_match'), false);
});

test('required policy mismatch is excluded', () => {
    const tenant = baseTenant({ required_policy_preferences: [{ key: 'pets', required_value: true }] });
    const result = service.recommendProperties(tenant, [baseProperty({ policies: { pets: false } })]);
    assert.ok(result.exclusions[0].reason_codes.includes('REQUIRED_POLICY_NOT_MET'));
});
