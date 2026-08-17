const screeningModel = require('../models/screeningModel');
const tenantAppModel = require('../models/tenantAppModel');
const auditLogModel = require('../models/auditLogModel');
const responseHelper = require('../utils/responseHelper');

const screeningController = {
    async createScreening(req, res) {
        try {
            const { 
                application_id, monthly_income, employment_status, 
                employment_details, previous_rental_history, rental_conduct_notes 
            } = req.body;
            
            const tenantId = req.user.id;

            // 1. Validate required fields
            if (!application_id || monthly_income === undefined || !employment_status) {
                return responseHelper.error(res, 'Application ID, monthly income, and employment status are required.');
            }

            // 2. Validate application status is approved
            // We can fetch details using tenantAppModel
            const applicationDetails = await tenantAppModel.findApplicationDetails(application_id, tenantId);
            if (!applicationDetails) {
                return responseHelper.error(res, 'Application not found or unauthorized access.', null, 404);
            }

            if (applicationDetails.status !== 'approved') {
                return responseHelper.error(res, 'Tenant screening can only be submitted for approved applications.');
            }

            // 3. Block duplicates
            const activeScreening = await screeningModel.findActiveScreening(tenantId, application_id);
            if (activeScreening) {
                return responseHelper.error(res, 'You already have a pending tenant screening request for this application.');
            }

            // 4. Save screening record
            const record = await screeningModel.createScreening({
                tenant_id: tenantId,
                application_id,
                property_id: applicationDetails.property_id,
                landlord_id: applicationDetails.landlord_id,
                monthly_income: parseFloat(monthly_income),
                employment_status,
                employment_details,
                previous_rental_history: previous_rental_history || null,
                rental_conduct_notes: rental_conduct_notes || null,
                status: 'pending'
            });

            // 5. Audit log
            await auditLogModel.log(tenantId, 'SUBMIT_SCREENING_INFO', `Tenant submitted screening info for application ${application_id}`);

            return responseHelper.success(res, 'Screening information successfully submitted.', record, 201);

        } catch (error) {
            console.error('Create screening error:', error);
            return responseHelper.error(res, 'Failed to submit screening details', error, 500);
        }
    },

    async getMyScreenings(req, res) {
        try {
            const list = await screeningModel.findByTenantId(req.user.id);
            return responseHelper.success(res, 'Your screening records retrieved successfully', list);
        } catch (error) {
            console.error('Get my screenings error:', error);
            return responseHelper.error(res, 'Failed to retrieve screening history', error, 500);
        }
    },

    async getLandlordScreenings(req, res) {
        try {
            const list = await screeningModel.findByLandlordId(req.user.id);
            return responseHelper.success(res, 'Landlord screenings queue retrieved successfully', list);
        } catch (error) {
            console.error('Get landlord screenings error:', error);
            return responseHelper.error(res, 'Failed to retrieve screenings registry', error, 500);
        }
    },

    async getScreeningDetails(req, res) {
        try {
            const { id } = req.params;
            const details = await screeningModel.findScreeningDetails(id, req.user.id);

            if (!details) {
                return responseHelper.error(res, 'Screening record not found or access denied.', null, 404);
            }

            return responseHelper.success(res, 'Screening details retrieved', details);
        } catch (error) {
            console.error('Get screening details error:', error);
            return responseHelper.error(res, 'Failed to retrieve details', error, 500);
        }
    },

    async calculateScreeningScore(req, res) {
        try {
            const { id } = req.params;
            const landlordId = req.user.id;

            // Fetch details to retrieve income and rent
            const details = await screeningModel.findScreeningDetails(id, landlordId);
            if (!details) {
                return responseHelper.error(res, 'Screening record not found or access denied.', null, 404);
            }

            return responseHelper.error(
                res,
                'Automated risk scoring is unavailable because this screening contains applicant-declared information, not verified rental-history evidence. Review the submitted documents manually.',
                null,
                422
            );

        } catch (error) {
            console.error('Calculate score error:', error);
            return responseHelper.error(res, 'Failed to compute screening score', error, 500);
        }
    }
};

module.exports = screeningController;
