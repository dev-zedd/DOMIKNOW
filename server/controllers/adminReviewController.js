const adminModel = require('../models/adminModel');
const auditLogModel = require('../models/auditLogModel');
const notificationModel = require('../models/notificationModel');
const responseHelper = require('../utils/responseHelper');
const { getSignedUrl, isStorageObjectNotFound } = require('../utils/storageHelper');

const adminReviewController = {
    async getPropertiesForReview(req, res) {
        try {
            const list = await adminModel.findPropertiesForReview();
            return responseHelper.success(res, 'Properties for review retrieved successfully', list);
        } catch (error) {
            console.error('Get properties for review error:', error);
            return responseHelper.error(res, 'Failed to fetch review properties queue', error, 500);
        }
    },

    async getPropertyReviewDetails(req, res) {
        try {
            const { id } = req.params;
            const details = await adminModel.findPropertyReviewDetails(id);

            if (!details) {
                return responseHelper.error(res, 'Property not found in review queue.', null, 404);
            }

            // Generate fresh signed URLs for property documents
            if (details.documents && details.documents.length > 0) {
                for (const doc of details.documents) {
                    if (doc.file_path) {
                        try {
                            doc.file_url = await getSignedUrl('property-documents', doc.file_path);
                        } catch (err) {
                            if (isStorageObjectNotFound(err)) {
                                // File was deleted from storage — mark as unavailable and continue silently
                                doc.file_url = null;
                                doc.file_unavailable = true;
                            } else {
                                console.warn(`Failed to refresh signed URL for document ${doc.id}:`, err.message);
                            }
                        }
                    }
                }
            }

            return responseHelper.success(res, 'Property review details retrieved', details);
        } catch (error) {
            console.error('Get property review details error:', error);
            return responseHelper.error(res, 'Failed to fetch property review details', error, 500);
        }
    },

    async approveProperty(req, res) {
        try {
            const { id } = req.params;
            const adminId = req.user.id;

            // 1. Fetch property review details (includes documents)
            const details = await adminModel.findPropertyReviewDetails(id);
            if (!details) {
                return responseHelper.error(res, 'Property not found in review queue.', null, 404);
            }

            // 2. Enforce minimum required property documents rule
            // Minimum: government_permit AND (ownership_proof OR authorization_letter)
            const docs = details.documents || [];
            const hasGovPermit = docs.some(d => d.document_type === 'government_permit' && d.status === 'submitted');
            const hasOwnershipProof = docs.some(d => d.document_type === 'ownership_proof' && d.status === 'submitted');
            const hasAuthLetter = docs.some(d => d.document_type === 'authorization_letter' && d.status === 'submitted');

            if (!hasGovPermit) {
                return responseHelper.error(res, 'Cannot approve property. A submitted Government Permit is required.');
            }

            if (!hasOwnershipProof && !hasAuthLetter) {
                return responseHelper.error(res, 'Cannot approve property. Either Proof of Ownership or an Authorization Letter is required.');
            }

            // 3. Approve property
            const approved = await adminModel.approveProperty(id, adminId);

            // Update associated documents status to accepted
            const supabase = require('../config/supabaseClient');
            await supabase
                .from('property_documents')
                .update({ status: 'accepted' })
                .eq('property_id', id);

            // 4. Log audit
            await auditLogModel.log(adminId, 'APPROVE_PROPERTY_REGISTRATION', `Admin approved property registration: ${details.property_name}`);
            await notificationModel.create({
                user_id: details.landlord_id,
                type: 'property_approved',
                title: 'Property approved',
                message: `${details.property_name} passed review and is now published in rental discovery.`,
                reference_id: id
            });

            return responseHelper.success(res, 'Property successfully approved and published to discovery catalog.', approved);

        } catch (error) {
            console.error('Approve property error:', error);
            return responseHelper.error(res, 'Failed to approve property registration', error, 500);
        }
    },

    async rejectProperty(req, res) {
        try {
            const { id } = req.params;
            const { rejection_reason } = req.body;
            const adminId = req.user.id;

            if (!rejection_reason) {
                return responseHelper.error(res, 'Rejection reason remarks are required.');
            }

            const details = await adminModel.findPropertyReviewDetails(id);
            if (!details) {
                return responseHelper.error(res, 'Property not found in review queue.', null, 404);
            }

            // Reject property
            const rejected = await adminModel.rejectProperty(id, adminId, rejection_reason);

            // Update documents status to rejected
            const supabase = require('../config/supabaseClient');
            await supabase
                .from('property_documents')
                .update({ status: 'rejected' })
                .eq('property_id', id);

            await auditLogModel.log(adminId, 'REJECT_PROPERTY_REGISTRATION', `Admin rejected property ${id}: ${rejection_reason}`);
            await notificationModel.create({
                user_id: details.landlord_id,
                type: 'property_rejected',
                title: 'Property submission needs changes',
                message: `${details.property_name} was returned after review. Reason: ${rejection_reason}`,
                reference_id: id
            });

            return responseHelper.success(res, 'Property successfully rejected and returned to landlord', rejected);

        } catch (error) {
            console.error('Reject property error:', error);
            return responseHelper.error(res, 'Failed to reject property registration', error, 500);
        }
    }
};

module.exports = adminReviewController;
