const reportModel = require('../models/reportModel');
const tenantReportModel = require('../models/tenantReportModel');
const landlordReportModel = require('../models/landlordReportModel');
const reportMessageModel = require('../models/reportMessageModel');
const notificationModel = require('../models/notificationModel');
const auditLogModel = require('../models/auditLogModel');
const responseHelper = require('../utils/responseHelper');
const supabase = require('../config/supabaseClient');
const { uploadFile, getSignedUrl, isStorageObjectNotFound } = require('../utils/storageHelper');

const reportController = {
    // ----------------- Reports -----------------
    async submitReport(req, res) {
        try {
            const { 
                reported_user_id, property_id, report_type, 
                report_title, report_description, 
                base64_content, file_name, mime_type, file_size 
            } = req.body;
            
            const reporterId = req.user.id;

            if (!reported_user_id || !report_type || !report_title || !report_description) {
                return responseHelper.error(res, 'Reported user, report type, title, and description are required.');
            }

            let attachmentUrl = null;
            let attachmentPath = null;

            // Upload attachment if provided
            if (base64_content && file_name && mime_type && file_size) {
                const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
                if (!allowedMimeTypes.includes(mime_type)) {
                    return responseHelper.error(res, 'Invalid format. Allowed formats: PDF, JPG, JPEG, PNG, WEBP.');
                }
                if (parseInt(file_size) > 10 * 1024 * 1024) {
                    return responseHelper.error(res, 'File size exceeds 10MB limit.');
                }

                const uniqueName = `${Date.now()}-${file_name}`;
                const storagePath = `reports/${reporterId}/${uniqueName}`;
                const uploadResult = await uploadFile('report-attachments', storagePath, base64_content, mime_type);
                attachmentUrl = uploadResult.url;
                attachmentPath = uploadResult.path;
            }

            const report = await reportModel.createReport({
                reporter_id: reporterId,
                reported_user_id,
                property_id: property_id || null,
                report_type,
                report_title,
                report_description,
                attachment_url: attachmentUrl,
                attachment_path: attachmentPath,
                status: 'pending'
            });

            await auditLogModel.log(reporterId, 'SUBMIT_REPORT', `User submitted report ${report.id} regarding user ${reported_user_id}`);
            await notificationModel.createForRole('admin', {
                type: 'report_submitted',
                title: 'New report awaiting review',
                message: `${report_title} was submitted and added to the report queue.`,
                reference_id: report.id
            });

            return responseHelper.success(res, 'Report submitted successfully.', report, 201);

        } catch (error) {
            console.error('Submit report error:', error);
            return responseHelper.error(res, 'Failed to submit report.', error, 500);
        }
    },

    async getMyReports(req, res) {
        try {
            const list = await reportModel.findReportsByReporterId(req.user.id);
            for (const report of list) {
                if (report.attachment_path) {
                    try {
                        report.attachment_url = await getSignedUrl('report-attachments', report.attachment_path);
                    } catch (err) {
                        if (!isStorageObjectNotFound(err)) console.error('Error generating signed URL for report:', err);
                    }
                }
            }
            return responseHelper.success(res, 'My reports retrieved successfully.', list);
        } catch (error) {
            console.error('Get my reports error:', error);
            return responseHelper.error(res, 'Failed to retrieve reports.', error, 500);
        }
    },

    async getAdminReports(req, res) {
        try {
            const list = await reportModel.findAllReports();
            for (const report of list) {
                if (report.attachment_path) {
                    try {
                        report.attachment_url = await getSignedUrl('report-attachments', report.attachment_path);
                    } catch (err) {
                        if (!isStorageObjectNotFound(err)) console.error('Error generating signed URL for admin report:', err);
                    }
                }
            }
            return responseHelper.success(res, 'All reports retrieved for admin.', list);
        } catch (error) {
            console.error('Get admin reports error:', error);
            return responseHelper.error(res, 'Failed to fetch reports list.', error, 500);
        }
    },

    async updateReportStatus(req, res) {
        try {
            const { id } = req.params;
            const { status, admin_remarks } = req.body;
            const adminId = req.user.id;

            const allowedStatuses = ['pending', 'under_review', 'resolved', 'dismissed'];
            if (!allowedStatuses.includes(status)) {
                return responseHelper.error(res, 'Invalid status. Allowed: pending, under_review, resolved, dismissed.');
            }

            const resolvedAt = (status === 'resolved' || status === 'dismissed') ? new Date() : null;

            const updated = await reportModel.updateReportStatus(id, {
                status,
                admin_remarks,
                resolved_at: resolvedAt
            });

            await auditLogModel.log(adminId, 'UPDATE_REPORT_STATUS', `Admin updated status of report ${id} to ${status}`);

            // Dispatch real-time notifications
            const currentReport = await reportModel.findReportById(id);
            if (currentReport) {
                if (status === 'resolved') {
                    if (currentReport.reporter_id) {
                        await notificationModel.create({
                            user_id: currentReport.reporter_id,
                            type: 'report_resolved',
                            title: 'Report Resolution Update',
                            message: `Your filed report "${currentReport.report_title}" has been reviewed and resolved by Admin. Admin Remarks: "${admin_remarks || 'Case resolved.'}"`,
                            reference_id: id
                        });
                    }
                    if (currentReport.reported_user_id) {
                        await notificationModel.create({
                            user_id: currentReport.reported_user_id,
                            type: 'admin_warning',
                            title: 'Official Admin Governance Notice',
                            message: `The Admin investigated a report concerning your account and enforced policy compliance. Admin Remarks: "${admin_remarks || 'Please adhere to platform policies.'}"`,
                            reference_id: id
                        });
                    }
                } else if (status === 'dismissed') {
                    if (currentReport.reporter_id) {
                        await notificationModel.create({
                            user_id: currentReport.reporter_id,
                            type: 'report_dismissed',
                            title: 'Report Investigation Closed (Dismissed)',
                            message: `Your filed report "${currentReport.report_title}" was reviewed and dismissed by Admin. Remarks: "${admin_remarks || 'No policy violation found.'}"`,
                            reference_id: id
                        });
                    }
                }
            }

            return responseHelper.success(res, `Report status updated to ${status}.`, updated);

        } catch (error) {
            console.error('Update report status error:', error);
            return responseHelper.error(res, 'Failed to update report status.', error, 500);
        }
    },

    // ----------------- Disputes -----------------
    async submitDispute(req, res) {
        try {
            const { 
                respondent_id, property_id, lease_id, dispute_type, 
                dispute_title, dispute_description, 
                base64_content, file_name, mime_type, file_size 
            } = req.body;
            
            const complainantId = req.user.id;

            if (!respondent_id || !property_id || !lease_id || !dispute_type || !dispute_title || !dispute_description) {
                return responseHelper.error(res, 'Respondent, property, lease, dispute type, title, and description are required.');
            }

            // Verify complainant is connected to lease or property
            const connection = await reportModel.checkUserLeaseConnection(complainantId, lease_id, property_id);
            if (!connection) {
                return responseHelper.error(res, 'You are not connected to this lease or property, or the lease is not valid.');
            }

            let attachmentUrl = null;
            let attachmentPath = null;

            // Upload attachment if provided
            if (base64_content && file_name && mime_type && file_size) {
                const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
                if (!allowedMimeTypes.includes(mime_type)) {
                    return responseHelper.error(res, 'Invalid format. Allowed formats: PDF, JPG, JPEG, PNG, WEBP.');
                }
                if (parseInt(file_size) > 10 * 1024 * 1024) {
                    return responseHelper.error(res, 'File size exceeds 10MB limit.');
                }

                const uniqueName = `${Date.now()}-${file_name}`;
                const storagePath = `disputes/${complainantId}/${uniqueName}`;
                const uploadResult = await uploadFile('dispute-attachments', storagePath, base64_content, mime_type);
                attachmentUrl = uploadResult.url;
                attachmentPath = uploadResult.path;
            }

            const dispute = await reportModel.createDispute({
                complainant_id: complainantId,
                respondent_id,
                property_id,
                lease_id,
                dispute_type,
                dispute_title,
                dispute_description,
                attachment_url: attachmentUrl,
                attachment_path: attachmentPath,
                status: 'pending'
            });

            await auditLogModel.log(complainantId, 'SUBMIT_DISPUTE', `User submitted dispute ${dispute.id} against ${respondent_id}`);
            await notificationModel.createForRole('admin', {
                type: 'report_submitted',
                title: 'New dispute awaiting review',
                message: `${dispute_title} was submitted and added to the case queue.`,
                reference_id: dispute.id
            });

            return responseHelper.success(res, 'Dispute submitted successfully.', dispute, 201);

        } catch (error) {
            console.error('Submit dispute error:', error);
            return responseHelper.error(res, 'Failed to submit dispute.', error, 500);
        }
    },

    async getMyDisputes(req, res) {
        try {
            const list = await reportModel.findDisputesByUserId(req.user.id);
            for (const dispute of list) {
                if (dispute.attachment_path) {
                    try {
                        dispute.attachment_url = await getSignedUrl('dispute-attachments', dispute.attachment_path);
                    } catch (err) {
                        if (!isStorageObjectNotFound(err)) console.error('Error generating signed URL for dispute:', err);
                    }
                }
            }
            return responseHelper.success(res, 'My disputes retrieved successfully.', list);
        } catch (error) {
            console.error('Get my disputes error:', error);
            return responseHelper.error(res, 'Failed to retrieve disputes.', error, 500);
        }
    },

    async getAdminDisputes(req, res) {
        try {
            const list = await reportModel.findAllDisputes();
            for (const dispute of list) {
                if (dispute.attachment_path) {
                    try {
                        dispute.attachment_url = await getSignedUrl('dispute-attachments', dispute.attachment_path);
                    } catch (err) {
                        if (!isStorageObjectNotFound(err)) console.error('Error generating signed URL for admin dispute:', err);
                    }
                }
            }
            return responseHelper.success(res, 'All disputes retrieved for admin.', list);
        } catch (error) {
            console.error('Get admin disputes error:', error);
            return responseHelper.error(res, 'Failed to fetch disputes list.', error, 500);
        }
    },

    async updateDisputeStatus(req, res) {
        try {
            const { id } = req.params;
            const { status, resolution_notes } = req.body;
            const adminId = req.user.id;

            const allowedStatuses = ['pending', 'under_review', 'resolved', 'dismissed'];
            if (!allowedStatuses.includes(status)) {
                return responseHelper.error(res, 'Invalid status. Allowed: pending, under_review, resolved, dismissed.');
            }

            const resolvedAt = (status === 'resolved' || status === 'dismissed') ? new Date() : null;

            const updated = await reportModel.updateDisputeStatus(id, {
                status,
                resolution_notes,
                resolved_at: resolvedAt
            });

            await auditLogModel.log(adminId, 'UPDATE_DISPUTE_STATUS', `Admin updated status of dispute ${id} to ${status}`);

            return responseHelper.success(res, `Dispute status updated to ${status}.`, updated);

        } catch (error) {
            console.error('Update dispute status error:', error);
            return responseHelper.error(res, 'Failed to update dispute status.', error, 500);
        }
    },

    // ----------------- Policy Violations -----------------
    async submitPolicyViolation(req, res) {
        try {
            const { 
                violator_id, property_id, lease_id, violation_type, 
                violation_description, 
                base64_content, file_name, mime_type, file_size 
            } = req.body;
            
            const reporterId = req.user.id;

            if (!violator_id || !property_id || !lease_id || !violation_type || !violation_description) {
                return responseHelper.error(res, 'Violator, property, lease, violation type, and description are required.');
            }

            // Verify reporter is connected to lease or property
            const connection = await reportModel.checkUserLeaseConnection(reporterId, lease_id, property_id);
            if (!connection) {
                return responseHelper.error(res, 'You are not connected to this lease or property, or the lease is not valid.');
            }

            let evidenceUrl = null;
            let evidencePath = null;

            // Upload evidence if provided
            if (base64_content && file_name && mime_type && file_size) {
                const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
                if (!allowedMimeTypes.includes(mime_type)) {
                    return responseHelper.error(res, 'Invalid format. Allowed formats: PDF, JPG, JPEG, PNG, WEBP.');
                }
                if (parseInt(file_size) > 10 * 1024 * 1024) {
                    return responseHelper.error(res, 'File size exceeds 10MB limit.');
                }

                const uniqueName = `${Date.now()}-${file_name}`;
                const storagePath = `violations/${reporterId}/${uniqueName}`;
                const uploadResult = await uploadFile('violation-evidence', storagePath, base64_content, mime_type);
                evidenceUrl = uploadResult.url;
                evidencePath = uploadResult.path;
            }

            const violation = await reportModel.createPolicyViolation({
                reported_by: reporterId,
                violator_id,
                property_id,
                lease_id,
                violation_type,
                violation_description,
                evidence_url: evidenceUrl,
                evidence_path: evidencePath,
                status: 'pending'
            });

            await auditLogModel.log(reporterId, 'SUBMIT_POLICY_VIOLATION', `User submitted policy violation ${violation.id} against ${violator_id}`);
            await notificationModel.createForRole('admin', {
                type: 'report_submitted',
                title: 'Policy violation awaiting review',
                message: `A ${violation_type.replace(/_/g, ' ')} case was submitted and added to the review queue.`,
                reference_id: violation.id
            });

            return responseHelper.success(res, 'Policy violation submitted successfully.', violation, 201);

        } catch (error) {
            console.error('Submit policy violation error:', error);
            return responseHelper.error(res, 'Failed to submit policy violation.', error, 500);
        }
    },

    async getMyPolicyViolations(req, res) {
        try {
            const list = await reportModel.findPolicyViolationsByUserId(req.user.id);
            for (const violation of list) {
                if (violation.evidence_path) {
                    try {
                        violation.evidence_url = await getSignedUrl('violation-evidence', violation.evidence_path);
                    } catch (err) {
                        if (!isStorageObjectNotFound(err)) console.error('Error generating signed URL for violation:', err);
                    }
                }
            }
            return responseHelper.success(res, 'My policy violations retrieved successfully.', list);
        } catch (error) {
            console.error('Get my violations error:', error);
            return responseHelper.error(res, 'Failed to retrieve policy violations.', error, 500);
        }
    },

    async getAdminPolicyViolations(req, res) {
        try {
            const list = await reportModel.findAllPolicyViolations();
            for (const violation of list) {
                if (violation.evidence_path) {
                    try {
                        violation.evidence_url = await getSignedUrl('violation-evidence', violation.evidence_path);
                    } catch (err) {
                        if (!isStorageObjectNotFound(err)) console.error('Error generating signed URL for admin violation:', err);
                    }
                }
            }
            return responseHelper.success(res, 'All policy violations retrieved for admin.', list);
        } catch (error) {
            console.error('Get admin violations error:', error);
            return responseHelper.error(res, 'Failed to fetch policy violations list.', error, 500);
        }
    },

    async updatePolicyViolationStatus(req, res) {
        try {
            const { id } = req.params;
            const { status, action_taken } = req.body;
            const adminId = req.user.id;

            const allowedStatuses = ['pending', 'under_review', 'resolved', 'dismissed'];
            if (!allowedStatuses.includes(status)) {
                return responseHelper.error(res, 'Invalid status. Allowed: pending, under_review, resolved, dismissed.');
            }

            const resolvedAt = (status === 'resolved' || status === 'dismissed') ? new Date() : null;

            const updated = await reportModel.updatePolicyViolationStatus(id, {
                status,
                action_taken,
                resolved_at: resolvedAt
            });

            await auditLogModel.log(adminId, 'UPDATE_POLICY_VIOLATION_STATUS', `Admin updated status of policy violation ${id} to ${status}`);

            return responseHelper.success(res, `Policy violation status updated to ${status}.`, updated);

        } catch (error) {
            console.error('Update policy violation error:', error);
            return responseHelper.error(res, 'Failed to update policy violation status.', error, 500);
        }
    },

    // ----------------- Report Investigation Messages -----------------
    async getInvestigationMessages(req, res) {
        try {
            const { type, id } = req.params;
            const targetThread = req.query?.thread || 'reporter';
            const userId = req.user.id;
            const userRole = req.user.role;

            let reportRow = null;
            let reporterId = null;
            let targetUserId = null;

            if (type === 'tenant_report') {
                reportRow = await tenantReportModel.findTenantReportById(id);
                if (reportRow) {
                    reporterId = reportRow.landlord_id;
                    targetUserId = reportRow.tenant_id;
                }
            } else if (type === 'landlord_report') {
                reportRow = await landlordReportModel.findLandlordReportById(id);
                if (reportRow) {
                    reporterId = reportRow.tenant_id;
                    targetUserId = reportRow.landlord_id;
                }
            }

            // Determine active thread filter for user
            let activeThreadFilter = targetThread;
            if (userRole !== 'admin') {
                if (userId === reporterId) {
                    activeThreadFilter = 'reporter';
                } else if (userId === targetUserId) {
                    activeThreadFilter = 'target';
                } else {
                    return responseHelper.success(res, 'Investigation messages retrieved.', []);
                }
            }

            const allMessages = await reportMessageModel.getMessagesByReportId(type, id);

            // Confidentiality Filter: Only messages matching activeThreadFilter or 'all'
            const filtered = allMessages.filter(m => 
                m.recipient_role === activeThreadFilter || m.recipient_role === 'all'
            );

            for (const m of filtered) {
                if (m.attachment_path) {
                    try {
                        m.attachment_url = await getSignedUrl('report-attachments', m.attachment_path);
                    } catch (err) {
                        if (!isStorageObjectNotFound(err)) console.error('Error generating signed URL for message attachment:', err);
                    }
                }
            }

            return responseHelper.success(res, 'Investigation messages retrieved.', filtered);
        } catch (error) {
            console.error('getInvestigationMessages error:', error);
            return responseHelper.error(res, 'Failed to fetch investigation messages.', error, 500);
        }
    },

    async postInvestigationMessage(req, res) {
        try {
            const { type, id } = req.params;
            const { message_text, recipient_role, base64_content, file_name, mime_type } = req.body;
            const userId = req.user.id;
            const userRole = req.user.role;

            // Allow image-only messages (no text required if attachment present)
            const hasText = message_text && message_text.trim().length > 0;
            const hasAttachment = base64_content && file_name && mime_type;
            if (!hasText && !hasAttachment) {
                return responseHelper.error(res, 'Message cannot be empty. Please type a message or attach an image.');
            }

            let reportRow = null;
            let reporterId = null;
            let targetUserId = null;

            if (type === 'tenant_report') {
                reportRow = await tenantReportModel.findTenantReportById(id);
                if (reportRow) {
                    reporterId = reportRow.landlord_id;
                    targetUserId = reportRow.tenant_id;
                }
            } else if (type === 'landlord_report') {
                reportRow = await landlordReportModel.findLandlordReportById(id);
                if (reportRow) {
                    reporterId = reportRow.tenant_id;
                    targetUserId = reportRow.landlord_id;
                }
            }

            // Determine recipient_role automatically if user is not admin
            let finalRecipientRole = recipient_role || 'reporter';
            if (userRole !== 'admin') {
                if (userId === reporterId) {
                    finalRecipientRole = 'reporter';
                } else if (userId === targetUserId) {
                    finalRecipientRole = 'target';
                } else {
                    return responseHelper.error(res, 'Unauthorized to post message to this report thread.', null, 403);
                }
            }

            let attachmentUrl = null;
            let attachmentPath = null;

            if (base64_content && file_name && mime_type) {
                const uniqueName = `${Date.now()}-${file_name}`;
                const storagePath = `report-inquiries/${userId}/${uniqueName}`;
                const uploadResult = await uploadFile('report-attachments', storagePath, base64_content, mime_type);
                attachmentUrl = uploadResult.url;
                attachmentPath = uploadResult.path;
            }

            const message = await reportMessageModel.addMessage({
                report_type: type,
                report_id: id,
                sender_id: userId,
                sender_role: userRole,
                recipient_role: finalRecipientRole,
                message_text: hasText ? message_text.trim() : '',
                attachment_url: attachmentUrl,
                attachment_path: attachmentPath
            });

            await auditLogModel.log(userId, 'POST_REPORT_INVESTIGATION_MESSAGE', `User ${userId} (${userRole}) sent message on ${type} #${id}`);

            return responseHelper.success(res, 'Investigation message posted successfully.', message, 201);
        } catch (error) {
            console.error('postInvestigationMessage error:', error);
            return responseHelper.error(res, 'Failed to post investigation message.', error, 500);
        }
    },

    // ----------------- Real-Time Typing Indicator -----------------
    postTypingState(req, res) {
        const { type, id } = req.params;
        const { is_typing, thread } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;
        const userName = req.user.full_name || (userRole === 'admin' ? 'System Admin' : userRole);

        const threadKey = thread || 'reporter';
        const key = `${type}_${id}_${threadKey}_${userId}`;
        if (is_typing) {
            typingStateStore.set(key, {
                type, id, thread: threadKey, userId, userRole, userName,
                expiresAt: Date.now() + 3500
            });
        } else {
            typingStateStore.delete(key);
        }
        return responseHelper.success(res, 'Typing state updated.');
    },

    getTypingState(req, res) {
        const { type, id } = req.params;
        const targetThread = req.query?.thread || 'reporter';
        const userId = req.user.id;
        const typers = getActiveTypers(type, id, targetThread, userId);
        return responseHelper.success(res, 'Active typers retrieved.', typers);
    }
};

// In-memory store for typing states: key = `${type}_${id}_${thread}_${userId}`
const typingStateStore = new Map();

function getActiveTypers(type, id, targetThread, currentUserId) {
    const now = Date.now();
    const active = [];
    for (const [key, info] of typingStateStore.entries()) {
        if (info.expiresAt < now) {
            typingStateStore.delete(key);
        } else if (info.type === type && info.id === id && info.thread === targetThread && info.userId !== currentUserId) {
            active.push(info);
        }
    }
    return active;
}

module.exports = reportController;
