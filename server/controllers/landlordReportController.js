const landlordReportModel = require('../models/landlordReportModel');
const userModel          = require('../models/userModel');
const propertyModel      = require('../models/propertyModel');
const notificationModel  = require('../models/notificationModel');
const responseHelper     = require('../utils/responseHelper');
const auditLogModel  = require('../models/auditLogModel');
const storageHelper  = require('../utils/storageHelper');
const cache          = require('../utils/cacheHelper');

// Cache TTLs (seconds)
const TTL = {
    reportsList:  60,  // Reports-against-me list  – 1 min
    reportDetail: 90   // Single report detail      – 1.5 min
};

const ALLOWED_CATEGORIES = [
    'maintenance_neglect',
    'illegal_eviction',
    'deposit_withholding',
    'harassment',
    'lease_violation',
    'unauthorized_entry',
    'overcharging',
    'discrimination',
    'threats_abuse',
    'other'
];

const ALLOWED_SEVERITIES = ['minor', 'moderate', 'major', 'critical'];

/**
 * Upload multiple base64 files to Supabase Storage in 'landlord-report-evidence' bucket.
 */
async function uploadEvidenceFiles(filesArray, tenantId) {
    const uploaded = [];
    for (const f of filesArray) {
        if (!f.file_data || !f.file_name) continue;

        let base64String = f.file_data;
        let mimeType     = f.file_type || 'image/jpeg';

        if (typeof base64String === 'string' && base64String.includes(';base64,')) {
            const parts = base64String.split(';base64,');
            const match = parts[0].match(/:(.*?);/);
            if (match) mimeType = match[1];
            base64String = parts[1];
        }

        const buffer = Buffer.from(base64String, 'base64');
        const extMatch = f.file_name.match(/\.([0-9a-z]+)$/i);
        const ext = extMatch ? extMatch[1].toLowerCase() : 'bin';
        const uniquePath = `landlord_reports/${tenantId}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;

        const uploadResult = await storageHelper.uploadFile(
            'landlord-report-evidence',
            uniquePath,
            buffer,
            mimeType
        );

        uploaded.push({
            file_name: f.file_name,
            file_url:  uploadResult.publicUrl || uploadResult.signedUrl,
            file_path: uploadResult.path,
            file_type: mimeType,
            file_size: f.file_size || buffer.length
        });
    }
    return uploaded;
}

const landlordReportController = {

    // ─── Tenant Endpoints ──────────────────────────────────────────────────────

    /**
     * Submit a report against a landlord (Tenant -> Landlord).
     * POST /api/landlord-reports
     */
    async submitLandlordReport(req, res) {
        try {
            const tenantId = req.user.id;
            const {
                lease_id,
                report_category,
                incident_date,
                incident_description,
                severity,
                files
            } = req.body;

            if (!lease_id || !report_category || !incident_date || !incident_description || !severity) {
                return responseHelper.error(res, 'Missing required fields (lease_id, report_category, incident_date, incident_description, severity).');
            }

            if (!ALLOWED_CATEGORIES.includes(report_category)) {
                return responseHelper.error(res, `Invalid report_category. Allowed: ${ALLOWED_CATEGORIES.join(', ')}`);
            }

            if (!ALLOWED_SEVERITIES.includes(severity)) {
                return responseHelper.error(res, `Invalid severity. Allowed: ${ALLOWED_SEVERITIES.join(', ')}`);
            }

            const lease = await landlordReportModel.getTenantLeaseSummary(lease_id, tenantId);
            if (!lease) {
                return responseHelper.error(res, 'Lease record not found or you are not the tenant associated with this lease.');
            }

            if (!files || !Array.isArray(files) || files.length === 0) {
                if (report_category !== 'other') {
                    return responseHelper.error(res, 'At least one evidence file is required to submit a report against a landlord.');
                }
                if (incident_description.trim().length < 50) {
                    return responseHelper.error(res, 'For reports without evidence, the incident description must be at least 50 characters long.');
                }
            }

            let uploadedFiles = [];
            if (files && files.length > 0) {
                try {
                    uploadedFiles = await uploadEvidenceFiles(files, tenantId);
                } catch (uploadErr) {
                    return responseHelper.error(res, uploadErr.message || 'Evidence upload failed.');
                }
            }

            const report = await landlordReportModel.createLandlordReport({
                tenant_id:            tenantId,
                landlord_id:          lease.landlord_id,
                lease_id:             lease_id,
                property_id:          lease.property_id,
                report_category,
                incident_date,
                incident_description,
                severity
            });

            if (uploadedFiles.length > 0) {
                await landlordReportModel.addEvidence(report.id, uploadedFiles);
            }

            await auditLogModel.log(
                tenantId,
                'SUBMIT_LANDLORD_REPORT',
                `Tenant filed report ${report.id} (Category: ${report_category}, Severity: ${severity}) against landlord ${lease.landlord_id}`
            );

            await notificationModel.createForRole('admin', {
                type: 'report_submitted',
                title: 'Landlord report awaiting review',
                message: `A ${severity} severity landlord report was submitted and added to the review queue.`,
                reference_id: report.id
            });

            // Invalidate landlord's reports cache so newly filed case appears
            cache.invalidateLandlord(lease.landlord_id, 'reports');

            return responseHelper.success(res, 'Landlord report submitted successfully. It is now pending admin review.', report, 201);

        } catch (error) {
            console.error('submitLandlordReport error:', error);
            return responseHelper.error(res, 'Failed to submit landlord report.', error, 500);
        }
    },

    async getTenantFiledLandlordReports(req, res) {
        try {
            const tenantId = req.user.id;
            const reports  = await landlordReportModel.findReportsByTenantId(tenantId);
            return responseHelper.success(res, 'Landlord reports retrieved.', reports);
        } catch (error) {
            console.error('getTenantFiledLandlordReports error:', error);
            return responseHelper.error(res, 'Failed to retrieve landlord reports.', error, 500);
        }
    },

    async getTenantFiledReportDetail(req, res) {
        try {
            const tenantId = req.user.id;
            const reportId = req.params.id;

            const report = await landlordReportModel.findLandlordReportById(reportId);
            if (!report) {
                return responseHelper.error(res, 'Report not found.', null, 404);
            }

            if (String(report.tenant_id).toLowerCase() !== String(tenantId).toLowerCase()) {
                return responseHelper.error(res, 'Access denied. You can only view your own filed reports.', null, 403);
            }

            const evidence = await landlordReportModel.findEvidenceByReportId(reportId);

            return responseHelper.success(res, 'Report detail retrieved.', {
                ...report,
                evidence
            });
        } catch (error) {
            console.error('getTenantFiledReportDetail error:', error);
            return responseHelper.error(res, 'Failed to retrieve report detail.', error, 500);
        }
    },

    async submitAdditionalEvidence(req, res) {
        try {
            const tenantId  = req.user.id;
            const reportId  = req.params.id;
            const { files } = req.body;

            if (!files || !Array.isArray(files) || files.length === 0) {
                return responseHelper.error(res, 'At least one file is required for additional evidence.');
            }

            const uploadedFiles = await uploadEvidenceFiles(files, tenantId);
            const result = await landlordReportModel.addAdditionalEvidence(reportId, tenantId, uploadedFiles);

            if (result.error) {
                return responseHelper.error(res, result.error, null, 400);
            }

            await auditLogModel.log(
                tenantId,
                'SUBMIT_ADDITIONAL_LANDLORD_REPORT_EVIDENCE',
                `Tenant submitted additional evidence for landlord report ${reportId}`
            );

            return responseHelper.success(res, 'Additional evidence submitted. Report status reset to pending admin review.', result.data);

        } catch (error) {
            console.error('submitAdditionalEvidence error:', error);
            return responseHelper.error(res, 'Failed to submit additional evidence.', error, 500);
        }
    },

    // ─── Landlord Endpoints ────────────────────────────────────────────────────

    async getReportsAgainstMe(req, res) {
        try {
            const landlordId = req.user.id;
            const cacheKey   = cache.landlordKey(landlordId, 'reports');

            const cached = cache.get(cacheKey);
            if (cached) {
                return responseHelper.success(res, 'Reports against landlord retrieved.', cached);
            }

            const reports = await landlordReportModel.findReportsByLandlordId(landlordId);
            cache.set(cacheKey, reports, TTL.reportsList);
            return responseHelper.success(res, 'Reports against landlord retrieved.', reports);
        } catch (error) {
            console.error('getReportsAgainstMe error:', error);
            return responseHelper.error(res, 'Failed to retrieve reports against landlord.', error, 500);
        }
    },

    async getLandlordReportDetailForLandlord(req, res) {
        try {
            const landlordId = req.user.id;
            const reportId   = req.params.id;
            const cacheKey   = cache.landlordKey(landlordId, 'reports', reportId);

            const cached = cache.get(cacheKey);
            if (cached) {
                return responseHelper.success(res, 'Landlord report details retrieved.', cached);
            }

            const report = await landlordReportModel.findLandlordReportById(reportId);
            if (!report) {
                return responseHelper.error(res, 'Landlord report not found.', null, 404);
            }

            if (report.landlord_id !== landlordId) {
                return responseHelper.error(res, 'Access denied. You are not the reported landlord.', null, 403);
            }

            let evidence = [];
            if (report.status !== 'pending_admin_review') {
                evidence = await landlordReportModel.findEvidenceByReportId(reportId);
            }

            const payload = { ...report, evidence };
            cache.set(cacheKey, payload, TTL.reportDetail);
            return responseHelper.success(res, 'Landlord report details retrieved.', payload);
        } catch (error) {
            console.error('getLandlordReportDetailForLandlord error:', error);
            return responseHelper.error(res, 'Failed to retrieve report detail.', error, 500);
        }
    },

    async submitLandlordExplanation(req, res) {
        try {
            const landlordId      = req.user.id;
            const reportId        = req.params.id;
            const { explanation } = req.body;

            if (!explanation || explanation.trim().length < 10) {
                return responseHelper.error(res, 'Explanation must be at least 10 characters long.');
            }

            const result = await landlordReportModel.submitLandlordExplanation(reportId, landlordId, explanation.trim());
            if (result.error) {
                return responseHelper.error(res, result.error, null, 400);
            }

            // Bust the list and the specific report detail from cache
            cache.invalidateLandlord(landlordId, 'reports');

            await auditLogModel.log(
                landlordId,
                'SUBMIT_LANDLORD_REPORT_EXPLANATION',
                `Landlord submitted explanation for report ${reportId}`
            );

            return responseHelper.success(res, 'Explanation submitted successfully.', result.data);
        } catch (error) {
            console.error('submitLandlordExplanation error:', error);
            return responseHelper.error(res, 'Failed to submit explanation.', error, 500);
        }
    },

    // ─── Admin Endpoints ───────────────────────────────────────────────────────

    async getAllLandlordReports(req, res) {
        try {
            const reports = await landlordReportModel.findAllLandlordReports();
            return responseHelper.success(res, 'All landlord reports retrieved.', reports);
        } catch (error) {
            console.error('getAllLandlordReports error:', error);
            return responseHelper.error(res, 'Failed to retrieve landlord reports.', error, 500);
        }
    },

    async getLandlordReportDetailForAdmin(req, res) {
        try {
            const reportId = req.params.id;
            const report   = await landlordReportModel.findLandlordReportById(reportId);

            if (!report) {
                return responseHelper.error(res, 'Landlord report not found.', null, 404);
            }

            const evidence = await landlordReportModel.findEvidenceByReportId(reportId);
            const history  = await landlordReportModel.getPreviousReportsAgainstLandlord(report.landlord_id, reportId);

            return responseHelper.success(res, 'Landlord report detail retrieved.', {
                ...report,
                evidence,
                previous_reports: history
            });
        } catch (error) {
            console.error('getLandlordReportDetailForAdmin error:', error);
            return responseHelper.error(res, 'Failed to retrieve report detail.', error, 500);
        }
    },

    async processAdminDecision(req, res) {
        try {
            const adminId  = req.user.id;
            const reportId = req.params.id;
            const { status, severity, action, admin_remarks, suspension_days } = req.body;

            const report = await landlordReportModel.findLandlordReportById(reportId);
            if (!report) {
                return responseHelper.error(res, 'Landlord report not found.', null, 404);
            }

            let finalStatus = status || report.status;
            let finalSeverity = severity || report.severity;
            let auditAction = 'UPDATE_LANDLORD_REPORT';
            let successMessage = 'Report status updated.';

            if (action === 'triage') {
                let targetStatus = status || 'pending_admin_review';
                if (targetStatus === 'in_review') targetStatus = 'pending_admin_review';
                if (targetStatus === 'dismissed') targetStatus = 'rejected';
                finalStatus = targetStatus;
                finalSeverity = severity || report.severity;
                auditAction = 'TRIAGE_LANDLORD_REPORT';
                successMessage = `Report triage updated to stage "${finalStatus}" and priority "${finalSeverity}".`;
            } else if (action === 'dismiss' || status === 'dismissed' || status === 'rejected') {
                finalStatus = 'rejected';
                auditAction = 'DISMISS_LANDLORD_REPORT';
                successMessage = 'Report has been dismissed.';
            } else if (action === 'needs_more_evidence' || status === 'needs_more_evidence') {
                finalStatus = 'needs_more_evidence';
                auditAction = 'REQUEST_MORE_EVIDENCE_LANDLORD_REPORT';
                successMessage = 'Additional evidence requested from tenant.';
            } else if (action === 'warning') {
                finalStatus = 'approved';
                auditAction = 'ISSUE_WARNING_LANDLORD';
                successMessage = `Formal warning issued to landlord ${report.landlord?.full_name || report.landlord_id}. This warning is recorded on their account.`;
            } else if (action === 'suspend') {
                finalStatus = 'approved';
                auditAction = 'SUSPEND_LANDLORD_ACCOUNT';
                await userModel.updateSuspension(report.landlord_id, parseInt(suspension_days) || 7);
                successMessage = `Landlord account suspended for ${suspension_days || 7} days. Account will be automatically restored after the suspension period.`;
            } else if (action === 'ban') {
                finalStatus = 'approved';
                auditAction = 'BAN_LANDLORD_ACCOUNT';
                await userModel.updateStatus(report.landlord_id, 'disabled');
                // Deactivate all properties owned by this landlord
                const deactivated = await propertyModel.deactivateByLandlordId(report.landlord_id);
                successMessage = `Landlord account permanently banned. ${deactivated.length} property listing(s) have been deactivated.`;
            } else if (status === 'approved') {
                finalStatus = 'approved';
                auditAction = 'APPROVE_LANDLORD_REPORT';
                successMessage = 'Report approved and resolved.';
            }

            let targetAdminId = adminId;
            if (action === 'triage') {
                if (status === 'in_review') targetAdminId = adminId;
                else if (status === 'pending_admin_review') targetAdminId = null;
            }

            const updatedReport = await landlordReportModel.updateLandlordReportStatus(reportId, {
                status: finalStatus,
                severity: finalSeverity,
                admin_remarks: admin_remarks ? admin_remarks.trim() : null,
                admin_id:      targetAdminId
            });

            await auditLogModel.log(
                adminId,
                auditAction,
                `Admin set landlord report ${reportId} status="${finalStatus}", severity="${finalSeverity}", action="${action || 'status_change'}". Remarks: ${admin_remarks || 'N/A'}`
            );

            // Dispatch real-time notifications to affected landlord and reporter tenant
            if (action === 'warning') {
                await notificationModel.create({
                    user_id: report.landlord_id,
                    type: 'admin_warning',
                    title: 'Official Platform Warning Notice',
                    message: `The Admin investigated a tenant report and issued a formal TOS warning notice against your account. Admin Findings: "${admin_remarks || 'Policy breach'}"`,
                    reference_id: reportId
                });
                if (report.tenant_id) {
                    await notificationModel.create({
                        user_id: report.tenant_id,
                        type: 'report_resolved',
                        title: 'Disciplinary Action Enforced',
                        message: `Your filed report #${reportId.slice(0, 8)} was investigated and a formal warning has been issued to the landlord.`,
                        reference_id: reportId
                    });
                }
            } else if (action === 'suspend') {
                await notificationModel.create({
                    user_id: report.landlord_id,
                    type: 'admin_suspension',
                    title: 'Temporary Account Suspension Notice',
                    message: `Your account has been temporarily suspended for ${suspension_days || 7} days due to verified TOS policy non-compliance. Admin Findings: "${admin_remarks || 'Policy violation'}"`,
                    reference_id: reportId
                });
                if (report.tenant_id) {
                    await notificationModel.create({
                        user_id: report.tenant_id,
                        type: 'report_resolved',
                        title: 'Disciplinary Action Enforced',
                        message: `Your filed report #${reportId.slice(0, 8)} was investigated and account suspension has been enforced against the landlord.`,
                        reference_id: reportId
                    });
                }
            } else if (action === 'dismiss' || finalStatus === 'rejected') {
                if (report.tenant_id) {
                    await notificationModel.create({
                        user_id: report.tenant_id,
                        type: 'report_dismissed',
                        title: 'Report Investigation Closed (Dismissed)',
                        message: `Your filed report #${reportId.slice(0, 8)} was reviewed and dismissed by admin (insufficient evidence or no policy breach). Admin Remarks: "${admin_remarks || 'None'}"`,
                        reference_id: reportId
                    });
                }
            }

            return responseHelper.success(res, successMessage, updatedReport);
        } catch (error) {
            console.error('processAdminDecision error:', error);
            return responseHelper.error(res, 'Failed to update landlord report status.', error, 500);
        }
    }
};

module.exports = landlordReportController;
