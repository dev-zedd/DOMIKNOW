const propertyModel = require('../models/propertyModel');
const recommendationModel = require('../models/recommendationModel');
const auditLogModel = require('../models/auditLogModel');
const responseHelper = require('../utils/responseHelper');
const {
    CONSTANTS: RECOMMENDATION_CONSTANTS,
    RecommendationValidationError,
    recommendProperties
} = require('../services/propertyRecommendationService');

const queryList = value => {
    const values = Array.isArray(value) ? value : String(value || '').split(',');
    return [...new Set(values.map(item => String(item).trim()).filter(Boolean))];
};

const queryBoolean = (value, fallback = false) => {
    if (value === undefined || value === null || value === '') return fallback;
    return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
};

const queryNumber = (value, name, fallback = null) => {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw new RecommendationValidationError(
            'INVALID_TENANT_RECOMMENDATION_PROFILE',
            `${name} must be a valid number.`
        );
    }
    return parsed;
};

const queryImportance = (query, code, name, fallback = 3) =>
    queryNumber(query[`importance_${code.toLowerCase()}`] ?? query[`weight_${name}`], `${code} importance`, fallback);

const queryPreferenceObjects = (value, fieldName) => {
    if (!value) return [];
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        if (!Array.isArray(parsed)) throw new Error('not an array');
        return parsed;
    } catch (error) {
        throw new RecommendationValidationError(
            'INVALID_TENANT_RECOMMENDATION_PROFILE',
            `${fieldName} must be a valid JSON array.`
        );
    }
};

function buildTenantRecommendationProfile(req) {
    const selectedAmenities = queryList(req.query.desired_amenities ?? req.query.amenities);
    const amenitiesRequired = queryBoolean(req.query.amenities_required);
    const explicitRequiredAmenities = queryList(req.query.required_amenities);
    const preferredTypes = queryList(
        req.query.preferred_property_types
        ?? req.query.preferred_property_type
        ?? req.query.property_type
    );

    return {
        tenant_id: req.user.id,
        reference_location: {
            latitude: queryNumber(req.query.reference_latitude ?? req.query.latitude, 'Reference latitude'),
            longitude: queryNumber(req.query.reference_longitude ?? req.query.longitude, 'Reference longitude')
        },
        distance: {
            ideal_distance_km: queryNumber(req.query.ideal_distance_km, 'Ideal distance'),
            maximum_distance_km: queryNumber(req.query.maximum_distance_km, 'Maximum distance'),
            maximum_distance_is_required: queryBoolean(req.query.maximum_distance_is_required)
        },
        budget: {
            comfortable_monthly_budget: queryNumber(req.query.comfortable_monthly_budget, 'Comfortable monthly budget'),
            hard_maximum_monthly_budget: queryNumber(
                req.query.hard_maximum_monthly_budget ?? req.query.max_budget ?? req.query.max_price,
                'Hard maximum monthly budget'
            )
        },
        preferred_property_types: {
            values: preferredTypes,
            required: queryBoolean(req.query.property_type_required)
        },
        occupant_count: queryNumber(req.query.occupant_count, 'Occupant count', 1),
        desired_amenities: amenitiesRequired ? [] : selectedAmenities,
        required_amenities: [...new Set([
            ...explicitRequiredAmenities,
            ...(amenitiesRequired ? selectedAmenities : [])
        ])],
        soft_policy_preferences: queryPreferenceObjects(req.query.soft_policy_preferences, 'Soft policy preferences'),
        required_policy_preferences: queryPreferenceObjects(req.query.required_policy_preferences, 'Required policy preferences'),
        criterion_importance: {
            tenant_preference_match: queryImportance(req.query, 'C1', 'preference'),
            location_suitability: queryImportance(req.query, 'C2', 'location'),
            amenity_match: queryImportance(req.query, 'C3', 'amenities'),
            authenticated_rating: queryImportance(req.query, 'C4', 'rating'),
            operations_reliability: queryImportance(req.query, 'C5', 'reliability')
        }
    };
}

const propertyController = {
    async getAllProperties(req, res) {
        try {
            const { page = 1, limit = 20, sort = 'newest', ...filters } = req.query;
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);
            const offset = (pageNum - 1) * limitNum;
            const result = await propertyModel.findApproved({ ...filters, limit: limitNum, offset, sort });

            return responseHelper.success(res, 'Properties retrieved successfully', {
                properties: result.properties,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total: result.total,
                    totalPages: Math.ceil(result.total / limitNum)
                }
            });
        } catch (error) {
            console.error('Get properties error:', error);
            return responseHelper.error(res, 'Failed to fetch properties', error, 500);
        }
    },

    async getPropertyById(req, res) {
        try {
            const { id } = req.params;
            const property = await propertyModel.findById(id);
            if (!property) return responseHelper.error(res, 'Property not found', null, 404);
            if (req.user && req.user.role === 'tenant') {
                await auditLogModel.log(req.user.id, 'VIEW_PROPERTY_DETAILS', `Tenant viewed property: ${property.property_name}`);
            }
            return responseHelper.success(res, 'Property details retrieved successfully', property);
        } catch (error) {
            console.error('Get property by id error:', error);
            return responseHelper.error(res, 'Failed to fetch property details', error, 500);
        }
    },

    async getRecommended(req, res) {
        try {
            const tenantProfile = buildTenantRecommendationProfile(req);
            const candidates = await recommendationModel.getCanonicalCandidates();
            const result = recommendProperties(tenantProfile, candidates);

            let snapshotStorage = 'recommendation_tables';
            try {
                await recommendationModel.persistRun(result.snapshot);
            } catch (storageError) {
                console.warn(
                    '[recommendations] Dedicated snapshot persistence failed; using the audit snapshot fallback:',
                    storageError?.code || storageError?.message || storageError
                );
                await recommendationModel.persistRunFallback(result.snapshot);
                snapshotStorage = 'audit_log_fallback';
            }

            const exclusionSummary = result.exclusions.reduce((summary, exclusion) => {
                exclusion.reason_codes.forEach(code => { summary[code] = (summary[code] || 0) + 1; });
                return summary;
            }, {});

            return responseHelper.success(res, 'Property suitability recommendations calculated successfully', {
                formula_version: RECOMMENDATION_CONSTANTS.FORMULA_VERSION,
                recommendation_run_id: result.snapshot.run_id,
                generated_at: result.snapshot.generated_at,
                advisory_notice: 'Suitability scores support comparison and are not probabilities, guarantees, or automated rental decisions.',
                active_criteria: result.snapshot.active_criteria,
                normalized_weights: result.snapshot.normalized_weights,
                candidate_count: result.snapshot.candidate_count,
                eligible_count: result.snapshot.eligible_count,
                excluded_count: result.snapshot.excluded_count,
                exclusion_summary: exclusionSummary,
                snapshot_storage: snapshotStorage,
                recommendations: result.recommendations
            });
        } catch (error) {
            console.error('Get recommended properties error:', error);
            if (error instanceof RecommendationValidationError) {
                return responseHelper.error(res, error.message, { code: error.code, details: error.details }, 400);
            }
            return responseHelper.error(res, 'Failed to calculate ranked recommendations', error, 500);
        }
    },

    async compareProperties(req, res) {
        try {
            const { property_ids } = req.body;
            if (!property_ids || !Array.isArray(property_ids)) {
                return responseHelper.error(res, 'Property IDs array is required.');
            }
            if (property_ids.length < 2 || property_ids.length > 4) {
                return responseHelper.error(res, 'You can compare minimum 2 and maximum 4 properties.');
            }
            const comparisonData = await propertyModel.findComparisonList(property_ids);
            if (comparisonData.length === 0) {
                return responseHelper.error(res, 'No properties found for comparison', null, 404);
            }
            return responseHelper.success(res, 'Comparison data retrieved successfully', comparisonData);
        } catch (error) {
            console.error('Compare properties error:', error);
            return responseHelper.error(res, 'Failed to compare properties', error, 500);
        }
    }
};

module.exports = propertyController;
