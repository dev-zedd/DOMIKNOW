const propertyModel = require('../models/propertyModel');
const auditLogModel = require('../models/auditLogModel');
const responseHelper = require('../utils/responseHelper');

const normalizeBarangay = value => {
    const normalized = String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\(poblacion\)/g, '')
        .replace(/^brgy\.?\s*/, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    return ({
        bagumayan: 'bagumbarangay',
        'i mendiola': 'mendiola'
    })[normalized] || normalized;
};

const propertyController = {
    async getAllProperties(req, res) {
        try {
            const { page = 1, limit = 20, sort = 'newest', ...filters } = req.query;
            
            // Convert pagination params to numbers
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);
            const offset = (pageNum - 1) * limitNum;

            const result = await propertyModel.findApproved({
                ...filters,
                limit: limitNum,
                offset: offset,
                sort: sort
            });

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

            if (!property) {
                return responseHelper.error(res, 'Property not found', null, 404);
            }

            // Only log if authenticated user views details
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
            // 5 Input Criteria from query params
            const preferred_location = req.query.preferred_location || req.query.preferred_barangay || '';
            const rawMinPrice = req.query.min_price;
            const rawMaxPrice = req.query.max_price ?? req.query.max_budget;
            const min_price = rawMinPrice !== undefined && rawMinPrice !== '' && Number.isFinite(Number(rawMinPrice)) && Number(rawMinPrice) >= 0
                ? Number(rawMinPrice)
                : null;
            const max_price = rawMaxPrice !== undefined && rawMaxPrice !== '' && Number.isFinite(Number(rawMaxPrice)) && Number(rawMaxPrice) >= 0
                ? Number(rawMaxPrice)
                : null;
            if ((rawMinPrice !== undefined && rawMinPrice !== '' && min_price === null)
                || (rawMaxPrice !== undefined && rawMaxPrice !== '' && max_price === null)) {
                return responseHelper.error(res, 'Budget values must be valid non-negative numbers.', null, 400);
            }
            if (min_price !== null && max_price !== null && min_price > max_price) {
                return responseHelper.error(res, 'Minimum budget cannot be greater than maximum budget.', null, 400);
            }
            const preferred_property_type = req.query.preferred_property_type || req.query.property_type || '';
            const tenant_preference = req.query.tenant_preference || req.query.tenant_type || '';
            
            let preferred_amenities = [];
            if (req.query.amenities) {
                preferred_amenities = Array.isArray(req.query.amenities) 
                    ? req.query.amenities 
                    : req.query.amenities.split(',').map(a => a.trim());
            }

            const activeCriteriaCount = [
                Boolean(preferred_location),
                min_price !== null || max_price !== null,
                Boolean(preferred_property_type),
                Boolean(tenant_preference),
                preferred_amenities.length > 0
            ].filter(Boolean).length;

            const candidates = await propertyModel.getRecommendationCandidates();
            if (candidates.length === 0) {
                return responseHelper.success(res, 'No properties available for recommendation', []);
            }

            // ── STAGE 1: STRICT ALL-INPUT CONSTRAINT FILTERING (AND LOGIC) ──
            // A property MUST possess 100% of all user-selected filter criteria to be included in results.
            const qualifiedCandidates = candidates.filter(prop => {
                const availableRents = Array.isArray(prop.available_rents)
                    ? prop.available_rents.filter(rent => Number.isFinite(Number(rent)) && Number(rent) > 0).map(Number)
                    : [];
                if (availableRents.length === 0) return false;

                // 1. Location Constraint Match
                if (preferred_location) {
                    const normPref = normalizeBarangay(preferred_location);
                    const normPropBrgy = normalizeBarangay(prop.barangay);
                    const normAddress = normalizeBarangay(prop.address);
                    const matchLocation = (normPropBrgy === normPref || normAddress.includes(normPref));
                    if (!matchLocation) return false;
                }

                // 2. Budget / Rental Price Range Constraint Match
                if (min_price !== null || max_price !== null) {
                    const hasRentInBudget = availableRents.some(rent =>
                        (min_price === null || rent >= min_price)
                        && (max_price === null || rent <= max_price)
                    );
                    if (!hasRentInBudget) return false;
                }

                // 3. Property Type Constraint Match
                if (preferred_property_type) {
                    if (prop.property_type !== preferred_property_type) return false;
                }

                if (tenant_preference && prop.tenant_type_suitability !== tenant_preference) return false;

                // 4. Amenities Constraint Match (MUST HAVE ALL SELECTED AMENITIES)
                if (preferred_amenities.length > 0) {
                    const propAmenities = (prop.amenities || []).map(a => a.toLowerCase());
                    const hasAllAmenities = preferred_amenities.every(pa => 
                        propAmenities.includes(pa.toLowerCase())
                    );
                    if (!hasAllAmenities) return false;
                }

                return true; // Passed 100% of specified filter inputs
            });

            if (qualifiedCandidates.length === 0) {
                return responseHelper.success(res, 'No properties match 100% of your active filter criteria', []);
            }

            // Stage 2: rank only from metrics that have supporting records.
            const recommended = qualifiedCandidates.map(prop => {
                let score = 0;
                let evidenceWeight = 0;
                let evidenceCount = 0;
                const reasons = [];

                const propertyRatingCount = Math.max(0, Number(prop.rating_count) || 0);
                const propertyRatingValue = Number(prop.average_rating);
                const propertyRating = propertyRatingCount > 0 && Number.isFinite(propertyRatingValue)
                    && propertyRatingValue >= 1 && propertyRatingValue <= 5 ? propertyRatingValue : null;

                const landlordRatingCount = Math.max(0, Number(prop.landlord?.landlord_rating_count) || 0);
                const landlordRatingValue = Number(prop.landlord?.landlord_average_rating);
                const landlordRating = landlordRatingCount > 0 && Number.isFinite(landlordRatingValue)
                    && landlordRatingValue >= 1 && landlordRatingValue <= 5 ? landlordRatingValue : null;

                const reliabilityCount = Math.max(0, Number(prop.recommendation_evidence?.landlord_reliability_count) || 0);
                const reliabilityValue = Number(prop.recommendation_evidence?.landlord_reliability);
                const rentalReliability = reliabilityCount > 0 && Number.isFinite(reliabilityValue)
                    && reliabilityValue >= 1 && reliabilityValue <= 5 ? reliabilityValue : null;

                const reviewedTrustCaseCount = Math.max(0, Number(prop.recommendation_evidence?.reviewed_trust_case_count) || 0);
                const trustScoreValue = Number(prop.landlord?.landlord_trust_score);
                const trustScore = reviewedTrustCaseCount > 0 && Number.isFinite(trustScoreValue)
                    && trustScoreValue >= 0 && trustScoreValue <= 100 ? trustScoreValue : null;

                // 1. Property Rating Score (30% Weight / Max 30 Pts)
                if (propertyRating !== null) {
                    score += (propertyRating / 5) * 30;
                    evidenceWeight += 30;
                    evidenceCount += propertyRatingCount;
                    reasons.push(`Property rating: ${propertyRating.toFixed(1)}/5 from ${propertyRatingCount} verified review${propertyRatingCount === 1 ? '' : 's'}`);
                }

                // 2. Landlord Trust Score (30% Weight / Max 30 Pts)
                if (trustScore !== null) {
                    score += (trustScore / 100) * 30;
                    evidenceWeight += 30;
                    evidenceCount += reviewedTrustCaseCount;
                    reasons.push(`Administrative trust score: ${trustScore}/100 after ${reviewedTrustCaseCount} reviewed case${reviewedTrustCaseCount === 1 ? '' : 's'}`);
                }

                // 3. Rental Reliability Index (20% Weight / Max 20 Pts)
                if (rentalReliability !== null) {
                    score += (rentalReliability / 5) * 20;
                    evidenceWeight += 20;
                    evidenceCount += reliabilityCount;
                    reasons.push(`Landlord reliability: ${rentalReliability.toFixed(1)}/5 from ${reliabilityCount} verified review${reliabilityCount === 1 ? '' : 's'}`);
                }

                // 4. Landlord Rating Score (20% Weight / Max 20 Pts)
                if (landlordRating !== null) {
                    score += (landlordRating / 5) * 20;
                    evidenceWeight += 20;
                    evidenceCount += landlordRatingCount;
                    reasons.push(`Landlord rating: ${landlordRating.toFixed(1)}/5 from ${landlordRatingCount} verified review${landlordRatingCount === 1 ? '' : 's'}`);
                }

                const qualityScore = Math.round(score * 10) / 10;

                return {
                    property: prop,
                    score: qualityScore,
                    match_percentage: activeCriteriaCount > 0 ? 100 : null,
                    active_criteria_count: activeCriteriaCount,
                    evidence_weight: evidenceWeight,
                    evidence_count: evidenceCount,
                    reasons,
                    output_criteria: {
                        property_location: `Brgy. ${prop.barangay}, Siniloan, Laguna`,
                        property_rating: propertyRating,
                        property_rating_count: propertyRatingCount,
                        trust_score: trustScore,
                        reviewed_trust_case_count: reviewedTrustCaseCount,
                        rental_reliability: rentalReliability,
                        reliability_count: reliabilityCount,
                        landlord_rating: landlordRating,
                        landlord_rating_count: landlordRatingCount
                    }
                };
            });

            recommended.sort((a, b) =>
                b.score - a.score
                || b.evidence_weight - a.evidence_weight
                || b.evidence_count - a.evidence_count
                || String(a.property.property_name || '').localeCompare(String(b.property.property_name || ''))
            );

            let previousScore = null;
            let currentRank = 0;
            const rankedList = recommended.map((item, index) => {
                if (item.evidence_weight === 0) return { rank: null, ...item };
                if (previousScore === null || item.score !== previousScore) currentRank = index + 1;
                previousScore = item.score;
                return { rank: currentRank, ...item };
            });

            return responseHelper.success(res, 'Ranked recommendations calculated successfully', rankedList);
        } catch (error) {
            console.error('Get recommended properties error:', error);
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
