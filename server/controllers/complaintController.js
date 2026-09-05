const complaintModel = require('../models/complaintModel');
const auditLogModel = require('../models/auditLogModel');
const notificationModel = require('../models/notificationModel');
const responseHelper = require('../utils/responseHelper');
const { uploadFile } = require('../utils/storageHelper');
const cache = require('../utils/cacheHelper');

const TTL = { complaints: 90 }; // Landlord complaints – 1.5 min

const VALID_STATUSES = ['submitted', 'under_review', 'in_progress', 'resolved', 'closed', 'rejected'];
const VALID_CATEGORIES = ['billing_concern', 'landlord_concern', 'safety_concern', 'policy_violation', 'utility_concern', 'noise_complaint', 'other'];

const complaintController = {
    // ── TENANT: Submit complaint ───────────────────────────────────────────
    async submitComplaint(req, res) {
        try {
            const {
                lease_id, category, subject, description,
                base64_content, file_name, mime_type, file_size
            } = req.body;
            const tenantId = req.user.id;

            if (!lease_id || !category || !subject || !description) {
                return responseHelper.error(res, 'Lease, category, subject, and description are required.');
            }
            if (!VALID_CATEGORIES.includes(category)) {
                return responseHelper.error(res, `Invalid category. Allowed: ${VALID_CATEGORIES.join(', ')}`);
            }
            if (subject.trim().length < 5) {
                return responseHelper.error(res, 'Subject must be at least 5 characters.');
            }
            if (description.trim().length < 20) {
                return responseHelper.error(res, 'Description must be at least 20 characters.');
            }

            // Verify lease
            const lease = await complaintModel.findActiveLease(tenantId, lease_id);
            if (!lease) {
                return responseHelper.error(res, 'You must have an active or ended lease to file a complaint.');
            }

            // Handle optional attachment
            let attachmentUrl = null;
            let attachmentPath = null;
            if (base64_content && file_name && mime_type) {
                const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4', 'video/quicktime'];
                if (!allowed.includes(mime_type)) {
                    return responseHelper.error(res, 'Invalid file type. Allowed: JPG, PNG, WEBP, PDF, MP4, MOV.');
                }
                if (parseInt(file_size) > 20 * 1024 * 1024) {
                    return responseHelper.error(res, 'File size exceeds 20MB limit.');
                }
                const uniqueName = `${Date.now()}-${file_name}`;
                const storagePath = `complaints/${tenantId}/${uniqueName}`;
                const uploadResult = await uploadFile('complaint-attachments', storagePath, base64_content, mime_type);
                attachmentUrl = uploadResult.url;
                attachmentPath = uploadResult.path;
            }

            const complaintNumber = await complaintModel.generateComplaintNumber();

            const complaint = await complaintModel.createComplaint({
                complaint_number: complaintNumber,
                lease_id,
                tenant_id: tenantId,
                landlord_id: lease.landlord_id,
                property_id: lease.property_id,
                category,
                subject: subject.trim(),
                description: description.trim(),
                attachment_url: attachmentUrl,
                attachment_path: attachmentPath,
                status: 'submitted'
            });

            // Log initial status
            await complaintModel.createStatusLog({
                complaint_id: complaint.id,
                updated_by: tenantId,
                previous_status: 'new',
                new_status: 'submitted',
                remarks: 'Complaint submitted by tenant.'
            });

            await auditLogModel.log(tenantId, 'SUBMIT_COMPLAINT', `Tenant submitted complaint ${complaint.id} (${complaintNumber})`);

            await Promise.all([
                notificationModel.create({
                    user_id: tenantId,
                    type: 'complaint_submitted',
                    title: 'Complaint submitted',
                    message: `Complaint ${complaintNumber} was submitted and is ready for review.`,
                    reference_id: complaint.id
                }),
                notificationModel.create({
                    user_id: lease.landlord_id,
                    type: 'complaint_received',
                    title: 'New tenant complaint',
                    message: `Complaint ${complaintNumber} requires your review: ${subject.trim()}`,
                    reference_id: complaint.id
                })
            ]);
            // Invalidate landlord's complaints cache so new complaint appears
            cache.invalidateLandlord(lease.landlord_id, 'complaints');

            return responseHelper.success(res, 'Complaint submitted successfully. The landlord will be notified.', complaint, 201);

        } catch (error) {
            console.error('Submit complaint error:', error);
            return responseHelper.error(res, 'Failed to submit complaint.', error, 500);
        }
    },

    // ── TENANT: Get my complaints ──────────────────────────────────────────
    async getMyComplaints(req, res) {
        try {
            const list = await complaintModel.findByTenantId(req.user.id);
            return responseHelper.success(res, 'Your complaints retrieved.', list);
        } catch (error) {
            console.error('Get my complaints error:', error);
            return responseHelper.error(res, 'Failed to fetch complaints.', error, 500);
        }
    },

    // ── TENANT: Get complaint details ──────────────────────────────────────
    async getComplaintById(req, res) {
        try {
            const { id } = req.params;
            const complaint = await complaintModel.findById(id);
            if (!complaint) return responseHelper.error(res, 'Complaint not found.', null, 404);

            const userId = req.user.id;
            const userRole = req.user.role;

            // Access: tenant must own it; landlord must be the recipient
            if (userRole === 'tenant' && complaint.tenant_id !== userId) {
                return responseHelper.error(res, 'Access denied.', null, 403);
            }
            if (userRole === 'landlord' && complaint.landlord_id !== userId) {
                return responseHelper.error(res, 'Access denied.', null, 403);
            }

            const logs = await complaintModel.getStatusLogs(id);
            return responseHelper.success(res, 'Complaint details retrieved.', { ...complaint, status_logs: logs });
        } catch (error) {
            console.error('Get complaint by ID error:', error);
            return responseHelper.error(res, 'Failed to fetch complaint details.', error, 500);
        }
    },

    // ── LANDLORD: Get received complaints ─────────────────────────────────
    async getLandlordComplaints(req, res) {
        try {
            const landlordId = req.user.id;
            const { status } = req.query;
            const validStatus = status && VALID_STATUSES.includes(status) ? status : null;
            const cacheKey = cache.landlordKey(landlordId, 'complaints', validStatus || 'all');

            const cached = cache.get(cacheKey);
            if (cached) {
                return responseHelper.success(res, 'Complaints received retrieved.', cached);
            }

            const list = await complaintModel.findByLandlordId(landlordId, validStatus);
            cache.set(cacheKey, list, TTL.complaints);
            return responseHelper.success(res, 'Complaints received retrieved.', list);
        } catch (error) {
            console.error('Get landlord complaints error:', error);
            return responseHelper.error(res, 'Failed to fetch complaints.', error, 500);
        }
    },

    // ── LANDLORD: Update complaint status ─────────────────────────────────
    async updateComplaintStatus(req, res) {
        try {
            const { id } = req.params;
            const { status, resolution_notes, rejection_reason } = req.body;
            const landlordId = req.user.id;

            if (!status || !VALID_STATUSES.includes(status)) {
                return responseHelper.error(res, `Invalid status. Allowed: ${VALID_STATUSES.join(', ')}`);
            }

            const complaint = await complaintModel.findById(id);
            if (!complaint) return responseHelper.error(res, 'Complaint not found.', null, 404);
            if (complaint.landlord_id !== landlordId) return responseHelper.error(res, 'Access denied.', null, 403);

            // Validate rejection reason
            if (status === 'rejected' && (!rejection_reason || rejection_reason.trim().length < 5)) {
                return responseHelper.error(res, 'A rejection reason is required when rejecting a complaint.');
            }

            // Validate resolution notes for resolved/closed
            if ((status === 'resolved' || status === 'closed') && (!resolution_notes || resolution_notes.trim().length < 10)) {
                return responseHelper.error(res, 'Resolution notes are required when marking a complaint as resolved or closed.');
            }

            const previousStatus = complaint.status;

            const updateData = { status };
            if (resolution_notes) updateData.resolution_notes = resolution_notes.trim();
            if (rejection_reason) updateData.rejection_reason = rejection_reason.trim();
            if (status === 'resolved') updateData.resolved_at = new Date().toISOString();
            if (status === 'closed') updateData.closed_at = new Date().toISOString();

            const updated = await complaintModel.updateStatus(id, updateData);

            // Log the status change
            await complaintModel.createStatusLog({
                complaint_id: id,
                updated_by: landlordId,
                previous_status: previousStatus,
                new_status: status,
                remarks: rejection_reason || resolution_notes || `Status updated to ${status}.`
            });

            await auditLogModel.log(landlordId, 'UPDATE_COMPLAINT_STATUS', `Landlord updated complaint ${id} from ${previousStatus} to ${status}`);

            await notificationModel.create({
                user_id: complaint.tenant_id,
                type: 'complaint_status_update',
                title: 'Complaint status updated',
                message: `Complaint ${complaint.complaint_number || id} is now ${status.replaceAll('_', ' ')}.`,
                reference_id: id
            });
            // Invalidate landlord's complaints cache
            cache.invalidateLandlord(landlordId, 'complaints');

            return responseHelper.success(res, `Complaint status updated to "${status}".`, updated);

        } catch (error) {
            console.error('Update complaint status error:', error);
            return responseHelper.error(res, 'Failed to update complaint status.', error, 500);
        }
    }
};

module.exports = complaintController;
