const tenantReportModel = require('../models/tenantReportModel');
const userModel         = require('../models/userModel');
const auditLogModel     = require('../models/auditLogModel');
const notificationModel = require('../models/notificationModel');
const responseHelper    = require('../utils/responseHelper');
const { uploadFile, getSignedUrl, isStorageObjectNotFound } = require('../utils/storageHelper');

const BUCKET = 'tenant-report-evidence';

// Allowed MIME types for evidence (photos, PDFs, videos, documents)
const ALLOWED_MIME_TYPES = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm',
    'text/plain'
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB per file (video support)

// ─── Helper: Attach fresh signed URLs to a list of evidence records ──────────
async function attachEvidenceUrls(evidenceList) {
    for (const ev of evidenceList) {
        if (ev.file_path) {
            try {
                ev.file_url = await getSignedUrl(BUCKET, ev.file_path);
            } catch (err) {
                if (isStorageObjectNotFound(err)) {
                    ev.file_url = null;
                    ev.file_unavailable = true;
                } else {
                    console.error('Error refreshing signed URL for evidence:', err);
                }
            }
        }
    }
    return evidenceList;
}

// ─── Helper: Upload an array of base64 file objects ──────────────────────────
async function uploadEvidenceFiles(files, uploaderId) {
    const uploaded = [];
    for (const f of files) {
        const { base64_content, file_name, mime_type, file_size } = f;

        if (!ALLOWED_MIME_TYPES.includes(mime_type)) {
            throw new Error(`Unsupported file type: ${mime_type}. Allowed: images, PDFs, videos.`);
        }
        if (parseInt(file_size) > MAX_FILE_SIZE) {
            throw new Error(`File "${file_name}" exceeds the 50 MB size limit.`);
        }

        const uniqueName   = `${Date.now()}-${file_name}`;
        const storagePath  = `tenant-reports/${uploaderId}/${uniqueName}`;
        const uploadResult = await uploadFile(BUCKET, storagePath, base64_content, mime_type);

        uploaded.push({
            file_name: file_name,
            file_url:  uploadResult.url,
            file_path: uploadResult.path,
            file_type: mime_type,
            file_size: parseInt(file_size) || null
        });
    }
    return uploaded;
}

// =============================================================================
// LANDLORD ENDPOINTS
// =============================================================================

const tenantReportController = {

    /**
     * POST /api/tenant-reports
     * Landlord files a report against a tenant.
     * Body: { lease_id, report_category, incident_date, incident_description, severity, files[] }
     */
    async submitTenantReport(req, res) {
        try {
            const landlordId = req.user.id;
            const {
                lease_id,
                report_category,
                incident_date,
                incident_description,
                severity,
                files // Array of { base64_content, file_name, mime_type, file_size }
            } = req.body;

            // ── Field validation
            if (!lease_id || !report_category || !incident_date || !incident_description || !severity) {
                return responseHelper.error(res, 'Lease, report category, incident date, description, and severity are required.');
            }

            const allowedCategories = [
                'non_payment','property_damage','house_rule_violation','noise_complaint',
                'illegal_activity','unauthorized_occupants','harassment',
                'unsanitary_behavior','utility_abuse','other'
            ];
            if (!allowedCategories.includes(report_category)) {
                return responseHelper.error(res, 'Invalid report category.');
            }

            const allowedSeverities = ['minor', 'moderate', 'major', 'critical'];
            if (!allowedSeverities.includes(severity)) {
                return responseHelper.error(res, 'Invalid severity. Allowed: minor, moderate, major, critical.');
            }

            // ── Verify landlord–tenant lease relationship
            const lease = await tenantReportModel.getLeaseSummary(lease_id, landlordId);
            if (!lease) {
                return responseHelper.error(res, 'You are not authorized to report this tenant. No matching lease found under your account.', null, 403);
            }

            // ── Evidence requirement: at least 1 file required
            //    Exception: "other" category may proceed with text-only if explicitly noted
            if (!files || !Array.isArray(files) || files.length === 0) {
                if (report_category !== 'other') {
                    return responseHelper.error(res, 'At least one evidence file is required to submit a report.');
                }
                // For "other" without files, description must be detailed (min 50 chars)
                if (incident_description.trim().length < 50) {
                    return responseHelper.error(res, 'For reports without evidence, the incident description must be at least 50 characters long.');
                }
            }

            // ── Upload evidence files
            let uploadedFiles = [];
            if (files && files.length > 0) {
                try {
                    uploadedFiles = await uploadEvidenceFiles(files, landlordId);
                } catch (uploadErr) {
                    return responseHelper.error(res, uploadErr.message || 'Evidence upload failed.');
                }
            }

            // ── Create the report
            const report = await tenantReportModel.createTenantReport({
                landlord_id:          landlordId,
                tenant_id:            lease.tenant_id,
                lease_id:             lease_id,
                property_id:          lease.property_id,
                report_category,
                incident_date,
                incident_description,
                severity
            });

            // ── Insert evidence records
            if (uploadedFiles.length > 0) {
                await tenantReportModel.addEvidence(report.id, uploadedFiles);
            }

            // ── Audit log
            await auditLogModel.log(
                landlordId,
                'SUBMIT_TENANT_REPORT',
                `Landlord filed tenant report ${report.id} (Category: ${report_category}, Severity: ${severity}) against tenant ${lease.tenant_id}`
            );

            await notificationModel.createForRole('admin', {
                type: 'report_submitted',
                title: 'Tenant report awaiting review',
                message: `A ${severity} severity tenant report was submitted and added to the review queue.`,
                reference_id: report.id
            });

            return responseHelper.success(res, 'Tenant report submitted successfully. It is now pending admin review.', report, 201);

        } catch (error) {
            console.error('submitTenantReport error:', error);
            return responseHelper.error(res, 'Failed to submit tenant report.', error, 500);
        }
    },

    /**
     * GET /api/tenant-reports/my-filed
     * Landlord views all reports they have filed.
     */
    async getLandlordTenantReports(req, res) {
        try {
            const reports = await tenantReportModel.findReportsByLandlordId(req.user.id);
            return responseHelper.success(res, 'Landlord tenant reports retrieved.', reports);
        } catch (error) {
            console.error('getLandlordTenantReports error:', error);
            return responseHelper.error(res, 'Failed to retrieve tenant reports.', error, 500);
        }
    },

    /**
     * GET /api/tenant-reports/:id/detail-landlord
     * Landlord views full detail of one report they filed.
     */
    async getTenantReportDetailForLandlord(req, res) {
        try {
            const landlordId = req.user.id;
            const { id } = req.params;

            const report = await tenantReportModel.findTenantReportById(id);
            if (!report || report.landlord_id !== landlordId) {
                return responseHelper.error(res, 'Report not found or access denied.', null, 404);
            }

            let evidence = await tenantReportModel.findEvidenceByReportId(id);
            evidence = await attachEvidenceUrls(evidence);

            return responseHelper.success(res, 'Report details retrieved.', { ...report, evidence });

        } catch (error) {
            console.error('getTenantReportDetailForLandlord error:', error);
            return responseHelper.error(res, 'Failed to get report details.', error, 500);
        }
    },

    /**
     * POST /api/tenant-reports/:id/additional-evidence
     * Landlord adds more evidence after admin requested it.
     */
    async addAdditionalEvidence(req, res) {
        try {
            const landlordId = req.user.id;
            const { id } = req.params;
            const { files } = req.body;

            if (!files || !Array.isArray(files) || files.length === 0) {
                return responseHelper.error(res, 'At least one evidence file is required.');
            }

            let uploadedFiles;
            try {
                uploadedFiles = await uploadEvidenceFiles(files, landlordId);
            } catch (uploadErr) {
                return responseHelper.error(res, uploadErr.message || 'Evidence upload failed.');
            }

            const result = await tenantReportModel.addAdditionalEvidence(id, landlordId, uploadedFiles);

            if (result.error) {
                return responseHelper.error(res, result.error, null, 400);
            }

            await auditLogModel.log(
                landlordId,
                'ADD_ADDITIONAL_EVIDENCE',
                `Landlord added ${uploadedFiles.length} additional evidence file(s) to tenant report ${id}. Status reset to pending_admin_review.`
            );

            return responseHelper.success(res, 'Additional evidence submitted. Report is now back under admin review.', result.data);

        } catch (error) {
            console.error('addAdditionalEvidence error:', error);
            return responseHelper.error(res, 'Failed to add additional evidence.', error, 500);
        }
    },

    // =============================================================================
    // TENANT ENDPOINTS
    // =============================================================================

    /**
     * GET /api/tenant-reports/against-me
     * Tenant views all reports filed against them.
     */
    async getMyReportsAgainstMe(req, res) {
        try {
            const reports = await tenantReportModel.findReportsByTenantId(req.user.id);
            return responseHelper.success(res, 'Reports against you retrieved.', reports);
        } catch (error) {
            console.error('getMyReportsAgainstMe error:', error);
            return responseHelper.error(res, 'Failed to retrieve reports against you.', error, 500);
        }
    },

    /**
     * GET /api/tenant-reports/:id/detail-tenant
     * Tenant views full detail of one report against them (evidence shown if approved/rejected).
     */
    async getTenantReportDetailForTenant(req, res) {
        try {
            const tenantId = req.user.id;
            const { id } = req.params;

            const report = await tenantReportModel.findTenantReportById(id);
            if (!report || report.tenant_id !== tenantId) {
                return responseHelper.error(res, 'Report not found or access denied.', null, 404);
            }

            // Only show evidence if report is no longer pending
            let evidence = [];
            if (report.status !== 'pending_admin_review') {
                evidence = await tenantReportModel.findEvidenceByReportId(id);
                evidence = await attachEvidenceUrls(evidence);
            }

            return responseHelper.success(res, 'Report details retrieved.', { ...report, evidence });

        } catch (error) {
            console.error('getTenantReportDetailForTenant error:', error);
            return responseHelper.error(res, 'Failed to get report details.', error, 500);
        }
    },

    /**
     * PUT /api/tenant-reports/:id/explain
     * Tenant submits their side of the story while report is still pending.
     */
    async submitExplanation(req, res) {
        try {
            const tenantId = req.user.id;
            const { id } = req.params;
            const { explanation } = req.body;

            if (!explanation || explanation.trim().length < 10) {
                return responseHelper.error(res, 'Explanation must be at least 10 characters.');
            }

            const result = await tenantReportModel.submitTenantExplanation(id, tenantId, explanation.trim());

            if (result.error) {
                return responseHelper.error(res, result.error, null, 400);
            }

            await auditLogModel.log(
                tenantId,
                'TENANT_SUBMIT_EXPLANATION',
                `Tenant submitted explanation for report ${id}`
            );

            return responseHelper.success(res, 'Your explanation has been submitted successfully.', result.data);

        } catch (error) {
            console.error('submitExplanation error:', error);
            return responseHelper.error(res, 'Failed to submit explanation.', error, 500);
        }
    },

    // =============================================================================
    // ADMIN ENDPOINTS
    // =============================================================================

    /**
     * GET /api/admin/tenant-reports
     * Admin views all tenant reports with optional filters.
     */
    async getAllTenantReports(req, res) {
        try {
            const reports = await tenantReportModel.findAllTenantReports();
            return responseHelper.success(res, 'All tenant reports retrieved.', reports);
        } catch (error) {
            console.error('getAllTenantReports error:', error);
            return responseHelper.error(res, 'Failed to retrieve tenant reports.', error, 500);
        }
    },

    /**
     * GET /api/admin/tenant-reports/:id
     * Admin views full detail of a single report (all parties + evidence + previous history).
     */
    async getTenantReportDetails(req, res) {
        try {
            const { id } = req.params;

            const report = await tenantReportModel.findTenantReportById(id);
            if (!report) {
                return responseHelper.error(res, 'Report not found.', null, 404);
            }

            // Fetch evidence with fresh signed URLs
            let evidence = await tenantReportModel.findEvidenceByReportId(id);
            evidence = await attachEvidenceUrls(evidence);

            // Fetch previous reports against this tenant (for context)
            const previousReports = await tenantReportModel.getPreviousReportsAgainstTenant(report.tenant_id, id);

            return responseHelper.success(res, 'Tenant report details retrieved.', {
                ...report,
                evidence,
                previous_reports: previousReports
            });

        } catch (error) {
            console.error('getTenantReportDetails error:', error);
            return responseHelper.error(res, 'Failed to get report details.', error, 500);
        }
    },

    /**
     * PUT /api/admin/tenant-reports/:id/decision
     * Admin processes triage or decision action (dismiss, warning, suspend, ban, needs_more_evidence, in_review).
     */
    async adminDecision(req, res) {
        try {
            const adminId = req.user.id;
            const { id } = req.params;
            const { status, severity, action, admin_remarks, suspension_days } = req.body;

            const report = await tenantReportModel.findTenantReportById(id);
            if (!report) {
                return responseHelper.error(res, 'Tenant report not found.', null, 404);
            }

            let finalStatus = status || report.status;
            let finalSeverity = severity || report.severity;
            let auditAction = 'UPDATE_TENANT_REPORT';
            let successMessage = 'Report status updated.';

            if (action === 'triage') {
                let targetStatus = status || 'pending_admin_review';
                if (targetStatus === 'in_review') targetStatus = 'pending_admin_review';
                if (targetStatus === 'dismissed') targetStatus = 'rejected';
                finalStatus = targetStatus;
                finalSeverity = severity || report.severity;
                auditAction = 'TRIAGE_TENANT_REPORT';
                successMessage = `Report triage updated to stage "${finalStatus}" and priority "${finalSeverity}".`;
            } else if (action === 'dismiss' || status === 'dismissed' || status === 'rejected') {
                finalStatus = 'rejected';
                auditAction = 'DISMISS_TENANT_REPORT';
                successMessage = 'Report has been dismissed.';
            } else if (action === 'needs_more_evidence' || status === 'needs_more_evidence') {
                finalStatus = 'needs_more_evidence';
                auditAction = 'REQUEST_MORE_EVIDENCE_TENANT_REPORT';
                successMessage = 'Additional evidence requested from landlord.';
            } else if (action === 'warning') {
                finalStatus = 'approved';
                auditAction = 'ISSUE_WARNING_TENANT';
                successMessage = `Formal warning issued to tenant ${report.tenant?.full_name || report.tenant_id}. This warning is recorded on their account.`;
            } else if (action === 'suspend') {
                finalStatus = 'approved';
                auditAction = 'SUSPEND_TENANT_ACCOUNT';
                await userModel.updateSuspension(report.tenant_id, parseInt(suspension_days) || 7);
                successMessage = `Tenant account suspended for ${suspension_days || 7} days. Account will be automatically restored after the suspension period.`;
            } else if (action === 'ban') {
                finalStatus = 'approved';
                auditAction = 'BAN_TENANT_ACCOUNT';
                await userModel.updateStatus(report.tenant_id, 'disabled');
                successMessage = 'Tenant account has been permanently banned from the platform.';
            } else if (status === 'approved') {
                finalStatus = 'approved';
                auditAction = 'APPROVE_TENANT_REPORT';
                successMessage = 'Report approved and resolved.';
            }

            let targetAdminId = adminId;
            if (action === 'triage') {
                if (status === 'in_review') targetAdminId = adminId;
                else if (status === 'pending_admin_review') targetAdminId = null;
            }

            // Update status in database
            const updated = await tenantReportModel.updateTenantReportStatus(id, {
                status: finalStatus,
                severity: finalSeverity,
                admin_remarks: admin_remarks?.trim() || null,
                admin_id: targetAdminId
            });

            await auditLogModel.log(
                adminId,
                auditAction,
                `Admin set tenant report ${id} status="${finalStatus}", severity="${finalSeverity}", action="${action || 'status_change'}". Remarks: ${admin_remarks || 'none'}`
            );

            // Dispatch real-time notifications to affected tenant and reporter landlord
            if (action === 'warning') {
                await notificationModel.create({
                    user_id: report.tenant_id,
                    type: 'admin_warning',
                    title: 'Official Platform Warning Notice',
                    message: `The Admin investigated a filed report and issued a formal TOS warning notice against your account. Admin Findings: "${admin_remarks || 'Policy violation'}"`,
                    reference_id: id
                });
                if (report.landlord_id) {
                    await notificationModel.create({
                        user_id: report.landlord_id,
                        type: 'report_resolved',
                        title: 'Disciplinary Action Enforced',
                        message: `Your filed report #${id.slice(0, 8)} was investigated and a formal warning has been issued to the tenant.`,
                        reference_id: id
                    });
                }
            } else if (action === 'suspend') {
                await notificationModel.create({
                    user_id: report.tenant_id,
                    type: 'admin_suspension',
                    title: 'Temporary Account Suspension Notice',
                    message: `Your account has been temporarily suspended for ${suspension_days || 7} days due to verified TOS policy non-compliance. Admin Findings: "${admin_remarks || 'Policy violation'}"`,
                    reference_id: id
                });
                if (report.landlord_id) {
                    await notificationModel.create({
                        user_id: report.landlord_id,
                        type: 'report_resolved',
                        title: 'Disciplinary Action Enforced',
                        message: `Your filed report #${id.slice(0, 8)} was investigated and account suspension has been enforced against the tenant.`,
                        reference_id: id
                    });
                }
            } else if (action === 'dismiss' || finalStatus === 'rejected') {
                if (report.landlord_id) {
                    await notificationModel.create({
                        user_id: report.landlord_id,
                        type: 'report_dismissed',
                        title: 'Report Investigation Closed (Dismissed)',
                        message: `Your filed report #${id.slice(0, 8)} was reviewed and dismissed by admin (insufficient evidence or no policy breach). Admin Remarks: "${admin_remarks || 'None'}"`,
                        reference_id: id
                    });
                }
            }

            return responseHelper.success(res, successMessage, updated);

        } catch (error) {
            console.error('adminDecision error:', error);
            return responseHelper.error(res, 'Failed to process admin decision.', error, 500);
        }
    }
};

module.exports = tenantReportController;
