const tenantAppModel = require('../models/tenantAppModel');
const propertyModel = require('../models/propertyModel');
const auditLogModel = require('../models/auditLogModel');
const notificationModel = require('../models/notificationModel');
const responseHelper = require('../utils/responseHelper');
const supabase = require('../config/supabaseClient');
const { uploadFile, getSignedUrl, isStorageObjectNotFound } = require('../utils/storageHelper');
const cache = require('../utils/cacheHelper');

const tenantAppController = {
    async createApplication(req, res) {
        try {
            const { property_id, reservation_id, desired_move_in_date, application_message, unit_id, bed_id } = req.body;
            const tenantId = req.user.id;

            // 1. Validate inputs
            if (!property_id || !desired_move_in_date) {
                return responseHelper.error(res, 'Property ID and desired Move-in Date are required.');
            }

            // 2. Check property exists and is approved
            const property = await propertyModel.findById(property_id);
            if (!property) {
                return responseHelper.error(res, 'Property does not exist.', null, 404);
            }

            if (property.status !== 'approved') {
                return responseHelper.error(res, 'Property is not approved for rental applications.');
            }

            // 3. Validate unit and bed if provided
            if (unit_id) {
                const unitModel = require('../models/unitModel');
                const unit = await unitModel.findById(unit_id);
                if (!unit || unit.property_id !== property_id) {
                    return responseHelper.error(res, 'Selected room/unit does not exist for this property.', null, 404);
                }

                if (unit.rental_style === 'per_bed') {
                    if (!bed_id) {
                        return responseHelper.error(res, 'Please select a specific bed space to apply for this unit.');
                    }

                    const bed = unit.beds ? unit.beds.find(b => b.id === bed_id) : null;
                    if (!bed) {
                        return responseHelper.error(res, 'Selected bed space does not exist in this unit.', null, 404);
                    }

                    if (bed.status !== 'available') {
                        return responseHelper.error(res, 'The selected bed space is not available.');
                    }

                    // Check duplicate pending application for the same bed
                    const { data: dupBed } = await supabase
                        .from('tenant_applications')
                        .select('id')
                        .eq('tenant_id', tenantId)
                        .eq('unit_id', unit_id)
                        .eq('bed_id', bed_id)
                        .eq('status', 'pending')
                        .maybeSingle();

                    if (dupBed) {
                        return responseHelper.error(res, 'You already have a pending application for this specific bed space.');
                    }
                } else {
                    // whole_room
                    if (unit.status !== 'available') {
                        return responseHelper.error(res, 'The selected room/unit is not available.');
                    }

                    // Check duplicate pending application for the same room
                    const { data: dupUnit } = await supabase
                        .from('tenant_applications')
                        .select('id')
                        .eq('tenant_id', tenantId)
                        .eq('unit_id', unit_id)
                        .eq('status', 'pending')
                        .maybeSingle();

                    if (dupUnit) {
                        return responseHelper.error(res, 'You already have a pending application for this room/unit.');
                    }
                }
            } else {
                // If no unit is specified (generic application to property)
                const existingPending = await tenantAppModel.findDuplicateApplication(tenantId, property_id);
                if (existingPending) {
                    return responseHelper.error(res, 'You already have a pending rental application for this property.');
                }
            }

            // 4. Create application
            const newApp = await tenantAppModel.createApplication({
                tenant_id: tenantId,
                property_id,
                unit_id: unit_id || null,
                bed_id: bed_id || null,
                landlord_id: property.landlord_id || null,
                reservation_id: reservation_id || null,
                desired_move_in_date,
                application_message,
                status: 'pending'
            });

            // 5. Log audit
            await auditLogModel.log(tenantId, 'SUBMIT_RENTAL_APPLICATION', `Tenant submitted rental application for property ${property_id}`);

            await Promise.all([
                notificationModel.create({
                    user_id: tenantId,
                    type: 'application_submitted',
                    title: 'Application submitted',
                    message: `Your application for ${property.property_name || 'the selected property'} was submitted successfully.`,
                    reference_id: newApp.id
                }),
                property.landlord_id ? notificationModel.create({
                    user_id: property.landlord_id,
                    type: 'new_application',
                    title: 'New rental application',
                    message: `A tenant submitted an application for ${property.property_name || 'one of your properties'}.`,
                    reference_id: newApp.id
                }) : Promise.resolve(null)
            ]);

            // Invalidate landlord's applications cache so new applicant appears immediately
            if (property.landlord_id) {
                cache.invalidateLandlord(property.landlord_id, 'applications');
            }

            return responseHelper.success(res, 'Rental application submitted successfully. Please upload required documents.', newApp, 201);

        } catch (error) {
            console.error('Create tenant application error:', error);
            return responseHelper.error(res, 'Failed to submit rental application', error, 500);
        }
    },

    async uploadDocument(req, res) {
        try {
            const { id } = req.params; // Application ID
            const { file_name, file_url, file_path, mime_type, file_size, document_type, base64_content } = req.body;
            const tenantId = req.user.id;

            // Verify ownership
            const application = await tenantAppModel.findApplicationDetails(id, tenantId);
            if (!application) {
                return responseHelper.error(res, 'Application not found or access denied.', null, 404);
            }

            // Validate file type
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
            if (!allowedTypes.includes(mime_type)) {
                return responseHelper.error(res, 'Invalid document format. Allowed formats: PDF, JPG, JPEG, PNG.');
            }

            // Validate size (limit 10MB)
            if (parseInt(file_size) > 10 * 1024 * 1024) {
                return responseHelper.error(res, 'Document size exceeds maximum limit of 10MB.');
            }

            let finalUrl = file_url;
            let finalPath = file_path;

            // Upload base64 if provided
            if (base64_content) {
                const uniqueName = `${Date.now()}-${file_name}`;
                const storagePath = `applications/${id}/${uniqueName}`;
                const uploadResult = await uploadFile('tenant-application-documents', storagePath, base64_content, mime_type);
                finalUrl = uploadResult.url;
                finalPath = uploadResult.path;
            }

            const docRecord = await tenantAppModel.saveApplicationDocument({
                application_id: id,
                tenant_id: tenantId,
                document_type,
                file_name,
                file_url: finalUrl,
                file_path: finalPath,
                mime_type,
                file_size: parseInt(file_size)
            });

            await auditLogModel.log(tenantId, 'UPLOAD_APPLICATION_DOCUMENT', `Tenant uploaded document (${document_type}) for application ${id}`);

            // Invalidate landlord's cached application detail so newly uploaded document appears
            if (application.landlord_id) {
                cache.del(cache.landlordKey(application.landlord_id, 'applications', id));
                cache.invalidateLandlord(application.landlord_id, 'applications');
            }

            return responseHelper.success(res, 'Application document uploaded successfully', docRecord);

        } catch (error) {
            console.error('Upload application document error:', error);
            return responseHelper.error(res, 'Failed to upload document', error, 500);
        }
    },

    async getMyApplications(req, res) {
        try {
            const list = await tenantAppModel.findByTenantId(req.user.id);
            return responseHelper.success(res, 'Your applications retrieved successfully', list);
        } catch (error) {
            console.error('Get tenant applications error:', error);
            return responseHelper.error(res, 'Failed to fetch your applications', error, 500);
        }
    },

    async getApplicationById(req, res) {
        try {
            const { id } = req.params;
            const details = await tenantAppModel.findApplicationDetails(id, req.user.id);

            if (!details) {
                return responseHelper.error(res, 'Application not found or access denied.', null, 404);
            }

            // Generate fresh signed URLs for documents
            if (details.documents && details.documents.length > 0) {
                for (const doc of details.documents) {
                    if (doc.file_path) {
                        try {
                            doc.file_url = await getSignedUrl('tenant-application-documents', doc.file_path);
                        } catch (err) {
                            if (isStorageObjectNotFound(err)) {
                                doc.file_url = null;
                                doc.file_unavailable = true;
                            } else {
                                console.error('Error generating signed URL for tenant doc:', err);
                            }
                        }
                    }
                }
            }

            return responseHelper.success(res, 'Application details retrieved', details);
        } catch (error) {
            console.error('Get tenant application by id error:', error);
            return responseHelper.error(res, 'Failed to fetch application details', error, 500);
        }
    }
};

module.exports = tenantAppController;
