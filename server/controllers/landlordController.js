const landlordModel = require('../models/landlordModel');
const auditLogModel = require('../models/auditLogModel');
const responseHelper = require('../utils/responseHelper');
const supabase = require('../config/supabaseClient');
const { uploadFile, getSignedUrl } = require('../utils/storageHelper');

const VALID_PROPERTY_TYPES = new Set(['apartment', 'boarding_house', 'bedspace']);
const VALID_TENANT_TYPES = new Set(['student', 'worker', 'family', 'general']);
const VALID_SINILOAN_BARANGAYS = new Set([
    'Acevida', 'Bagong Pag-Asa', 'Bagumbarangay', 'Buhay', 'Gen. Luna',
    'Halayhayin', 'Mendiola', 'Kapatalan', 'Laguio', 'Liyang', 'Llavac',
    'Pandeno', 'Magsaysay', 'Macatad', 'Mayatba', 'P. Burgos', 'G. Redor',
    'Salubungan', 'Wawa', 'J. Rizal'
]);
const BARANGAY_ALIASES = new Map([
    ['bagong pag-asa', 'Bagong Pag-Asa'],
    ['i. mendiola', 'Mendiola'],
    ['pandeño', 'Pandeno']
]);
const SINILOAN_CENTER = { latitude: 14.4172, longitude: 121.4475 };

function distanceFromSiniloanKm(latitude, longitude) {
    const toRadians = (value) => value * Math.PI / 180;
    const latitudeDelta = toRadians(latitude - SINILOAN_CENTER.latitude);
    const longitudeDelta = toRadians(longitude - SINILOAN_CENTER.longitude);
    const factor = Math.sin(latitudeDelta / 2) ** 2
        + Math.cos(toRadians(SINILOAN_CENTER.latitude))
        * Math.cos(toRadians(latitude))
        * Math.sin(longitudeDelta / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(factor), Math.sqrt(1 - factor));
}

function validatePropertyDetails(body) {
    const propertyName = String(body.property_name || '').trim();
    const propertyType = String(body.property_type || '').trim();
    const description = String(body.description || '').trim();
    const address = String(body.address || '').trim();
    const rawBarangay = String(body.barangay || '').trim();
    const barangay = BARANGAY_ALIASES.get(rawBarangay.toLowerCase())
        || Array.from(VALID_SINILOAN_BARANGAYS).find(name => name.toLowerCase() === rawBarangay.toLowerCase())
        || '';
    const tenantType = String(body.tenant_type_suitability || '').trim();
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const maxOccupants = Number(body.max_occupants);
    const totalFloors = Number(body.total_floors);
    const totalCapacity = body.total_capacity === '' || body.total_capacity === null || body.total_capacity === undefined
        ? null
        : Number(body.total_capacity);

    if (!propertyName || !description || !address) {
        return { error: 'Property name, description, and street address are required.' };
    }
    if (!VALID_PROPERTY_TYPES.has(propertyType)) {
        return { error: 'Select a valid property type.' };
    }
    if (!VALID_SINILOAN_BARANGAYS.has(barangay)) {
        return { error: 'Select a valid barangay in Siniloan.' };
    }
    if (!VALID_TENANT_TYPES.has(tenantType)) {
        return { error: 'Select a valid tenant suitability.' };
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
        || Math.abs(latitude) > 90 || Math.abs(longitude) > 180
        || distanceFromSiniloanKm(latitude, longitude) > 25) {
        return { error: 'Set a valid property location within the Siniloan service area.' };
    }
    if (!Number.isInteger(totalFloors) || totalFloors < 1 || totalFloors > 100) {
        return { error: 'Total floors must be a whole number from 1 to 100.' };
    }
    if (!Number.isInteger(maxOccupants) || maxOccupants < 1 || maxOccupants > 100) {
        return { error: 'Default maximum occupants per unit must be a whole number from 1 to 100.' };
    }
    if (totalCapacity !== null
        && (!Number.isInteger(totalCapacity) || totalCapacity < maxOccupants || totalCapacity > 10000)) {
        return { error: 'Total building capacity must be a whole number, at least the per-unit maximum, and no more than 10,000.' };
    }

    return {
        data: {
            property_name: propertyName,
            property_type: propertyType,
            description,
            address,
            barangay,
            municipality: 'Siniloan',
            province: 'Laguna',
            latitude,
            longitude,
            max_occupants: maxOccupants,
            tenant_type_suitability: tenantType,
            total_floors: totalFloors,
            total_capacity: totalCapacity
        }
    };
}

const landlordController = {
    async createProperty(req, res) {
        try {
            const { 
                property_name, property_type, description, address, barangay, 
                municipality, province, latitude, longitude, monthly_rent, 
                max_occupants, tenant_type_suitability, house_rules, amenities,
                total_floors, total_capacity
            } = req.body;

            const landlordId = req.user.id;

            // 1. Validate factual property criteria before persisting them.
            const validation = validatePropertyDetails(req.body);
            if (validation.error) return responseHelper.error(res, validation.error);

            // 2. Insert property
            const prop = await landlordModel.createProperty({
                landlord_id: landlordId,
                ...validation.data,
                monthly_rent: 0,
                house_rules,
                status: 'pending_review'
            });

            // Initialize property feedback summary record
            await supabase
                .from('property_feedback_summary')
                .upsert([
                    {
                        property_id: prop.id,
                        rating_average: 0.00,
                        total_feedback: 0
                    }
                ], {
                    onConflict: 'property_id'
                });

            // 3. Save amenities
            if (amenities && amenities.length > 0) {
                await landlordModel.saveAmenities(prop.id, amenities);
            }

            // 4. Log audit
            await auditLogModel.log(landlordId, 'SUBMIT_PROPERTY_REGISTRATION', `Landlord submitted property for review: ${validation.data.property_name}`);

            return responseHelper.success(res, 'Property submitted successfully for admin review.', prop, 201);

        } catch (error) {
            console.error('Create property error:', error);
            return responseHelper.error(res, 'Failed to submit property', error, 500);
        }
    },

    async getMyProperties(req, res) {
        try {
            const properties = await landlordModel.findByLandlordId(req.user.id);
            return responseHelper.success(res, 'Your properties retrieved successfully', properties);
        } catch (error) {
            console.error('Get my properties error:', error);
            return responseHelper.error(res, 'Failed to fetch your properties', error, 500);
        }
    },

    async getMyPropertyById(req, res) {
        try {
            const { id } = req.params;
            let property = await landlordModel.findPropertyById(id, req.user.id);

            if (!property && req.user) {
                property = await landlordModel.findPropertyById(id, null);
                if (property && property.landlord_id !== req.user.id && req.user.role !== 'admin') {
                    property = null;
                }
            }

            if (!property) {
                return responseHelper.error(res, 'Property not found or access denied.', null, 404);
            }

            // Generate fresh signed URLs for property documents
            if (property.documents && property.documents.length > 0) {
                for (const doc of property.documents) {
                    if (doc.file_path) {
                        try {
                            doc.file_url = await getSignedUrl('property-documents', doc.file_path);
                        } catch (err) {
                            console.warn('Signed URL refresh notice:', err.message || err);
                        }
                    }
                }
            }

            return responseHelper.success(res, 'Property details retrieved', property);
        } catch (error) {
            console.error('Get property by id error:', error);
            return responseHelper.error(res, 'Failed to fetch property profile', error.message || error, 500);
        }
    },

    async updateProperty(req, res) {
        try {
            const { id } = req.params;
            const landlordId = req.user.id;
            const { 
                property_name, property_type, description, address, barangay, 
                municipality, province, latitude, longitude, monthly_rent, 
                max_occupants, tenant_type_suitability, house_rules, amenities,
                total_floors, total_capacity
            } = req.body;

            const validation = validatePropertyDetails(req.body);
            if (validation.error) return responseHelper.error(res, validation.error);

            // Update details
            const updated = await landlordModel.updateProperty(id, landlordId, {
                ...validation.data,
                monthly_rent: Number.isFinite(Number(monthly_rent)) && Number(monthly_rent) >= 0
                    ? Number(monthly_rent)
                    : 0,
                house_rules,
                status: 'pending_review' // Re-submission resets status to pending_review
            });

            if (!updated) {
                return responseHelper.error(res, 'Property not found, access denied, or status cannot be updated.', null, 400);
            }

            // Sync amenities
            await landlordModel.deleteAmenities(id);
            if (amenities && amenities.length > 0) {
                await landlordModel.saveAmenities(id, amenities);
            }

            await auditLogModel.log(landlordId, 'UPDATE_PROPERTY_SUBMISSION', `Landlord updated property submission: ${validation.data.property_name}`);

            return responseHelper.success(res, 'Property updated successfully and returned to review queue', updated);

        } catch (error) {
            console.error('Update property error:', error);
            return responseHelper.error(res, 'Failed to update property details', error, 500);
        }
    },

    async uploadImage(req, res) {
        try {
            const { id } = req.params;
            const { file_name, file_url, file_path, mime_type, file_size, is_main, base64_content, replace_image_id } = req.body;
            const landlordId = req.user.id;

            // Verify ownership
            const property = await landlordModel.findPropertyById(id, landlordId);
            if (!property) {
                return responseHelper.error(res, 'Property not found or access denied.', null, 404);
            }

            // Validate file type
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
            if (!allowedTypes.includes(mime_type)) {
                return responseHelper.error(res, 'Invalid image format. Allowed formats: JPG, JPEG, PNG, WEBP.');
            }

            // Validate file size (limit 5MB)
            if (parseInt(file_size) > 5 * 1024 * 1024) {
                return responseHelper.error(res, 'Image size exceeds maximum limit of 5MB.');
            }

            // Clean existing image if replacing
            if (replace_image_id) {
                await supabase
                    .from('property_images')
                    .delete()
                    .eq('id', replace_image_id)
                    .eq('property_id', id);
            } else if (is_main === true || is_main === 'true') {
                // Prevent duplicate main/cover images
                await supabase
                    .from('property_images')
                    .delete()
                    .eq('property_id', id)
                    .eq('is_main', true);
            }

            let finalUrl = file_url;
            let finalPath = file_path;

            // Upload base64 if provided
            if (base64_content) {
                const uniqueName = `${Date.now()}-${file_name}`;
                const storagePath = `properties/${id}/${uniqueName}`;
                const uploadResult = await uploadFile('property-images', storagePath, base64_content, mime_type);
                finalUrl = uploadResult.url;
                finalPath = uploadResult.path;
            }

            const imgRecord = await landlordModel.saveImage({
                property_id: id,
                image_url: finalUrl,
                image_path: finalPath,
                is_main: is_main === true || is_main === 'true'
            });

            await auditLogModel.log(landlordId, 'UPLOAD_PROPERTY_IMAGE', `Landlord uploaded image for property ${id}`);

            return responseHelper.success(res, 'Property image uploaded successfully', imgRecord);

        } catch (error) {
            console.error('Upload image error:', error);
            return responseHelper.error(res, 'Failed to upload property image', error.message || error, 500);
        }
    },

    async uploadDocument(req, res) {
        try {
            const { id } = req.params;
            const { file_name, file_url, file_path, mime_type, file_size, document_type, base64_content, replace_doc_id } = req.body;
            const landlordId = req.user.id;

            // Verify ownership
            const property = await landlordModel.findPropertyById(id, landlordId);
            if (!property) {
                return responseHelper.error(res, 'Property not found or access denied.', null, 404);
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

            // Clean existing document if replacing
            if (replace_doc_id) {
                await supabase
                    .from('property_documents')
                    .delete()
                    .eq('id', replace_doc_id)
                    .eq('property_id', id);
            } else if (document_type === 'ownership_proof' || document_type === 'government_permit') {
                // Ensure only one active document of these unique types is kept
                await supabase
                    .from('property_documents')
                    .delete()
                    .eq('property_id', id)
                    .eq('document_type', document_type);
            }

            let finalUrl = file_url;
            let finalPath = file_path;

            // Upload base64 if provided
            if (base64_content) {
                const uniqueName = `${Date.now()}-${file_name}`;
                const storagePath = `documents/${id}/${uniqueName}`;
                const uploadResult = await uploadFile('property-documents', storagePath, base64_content, mime_type);
                finalUrl = uploadResult.url;
                finalPath = uploadResult.path;
            }

            const docRecord = await landlordModel.saveDocument({
                property_id: id,
                landlord_id: landlordId,
                document_type,
                file_name,
                file_url: finalUrl,
                file_path: finalPath,
                mime_type,
                file_size: parseInt(file_size),
                status: 'submitted'
            });

            await auditLogModel.log(landlordId, 'UPLOAD_PROPERTY_DOCUMENT', `Landlord uploaded document (${document_type}) for property ${id}`);

            return responseHelper.success(res, 'Property document uploaded successfully', docRecord);

        } catch (error) {
            console.error('Upload document error:', error);
            return responseHelper.error(res, 'Failed to upload property document', error.message || error, 500);
        }
    },

    async getTenantApplications(req, res) {
        try {
            const list = await landlordModel.findTenantApplications(req.user.id);
            return responseHelper.success(res, 'Tenant applications retrieved successfully', list);
        } catch (error) {
            console.error('Get landlord tenant applications error:', error);
            return responseHelper.error(res, 'Failed to fetch tenant applications', error, 500);
        }
    },

    async getTenantApplicationById(req, res) {
        try {
            const { id } = req.params;
            const details = await landlordModel.findApplicationDetails(id, req.user.id);

            if (!details) {
                return responseHelper.error(res, 'Application not found or access denied.', null, 404);
            }

            // Generate fresh signed URLs for tenant application documents
            if (details.documents && details.documents.length > 0) {
                for (const doc of details.documents) {
                    if (doc.file_path) {
                        try {
                            doc.file_url = await getSignedUrl('tenant-application-documents', doc.file_path);
                        } catch (err) {
                            console.error('Error generating signed URL for application doc:', err);
                        }
                    }
                }
            }

            return responseHelper.success(res, 'Application details retrieved', details);
        } catch (error) {
            console.error('Get landlord application by id error:', error);
            return responseHelper.error(res, 'Failed to fetch application details', error, 500);
        }
    },

    async updateApplicationStatus(req, res) {
        try {
            const { id } = req.params;
            const { status, landlord_remarks } = req.body;
            const landlordId = req.user.id;

            const allowedStatuses = ['approved', 'rejected'];
            if (!allowedStatuses.includes(status)) {
                return responseHelper.error(res, 'Invalid status update. Allowed: approved, rejected.');
            }

            const updated = await landlordModel.updateApplicationStatus(id, landlordId, status, landlord_remarks);
            if (!updated) {
                return responseHelper.error(res, 'Application not found or unauthorized status change.', null, 400);
            }

            // Reserve unit/bed if approved
            if (status === 'approved') {
                if (updated.bed_id) {
                    await supabase
                        .from('unit_beds')
                        .update({ status: 'reserved' })
                        .eq('id', updated.bed_id);
                } else if (updated.unit_id) {
                    await supabase
                        .from('property_units')
                        .update({ status: 'reserved' })
                        .eq('id', updated.unit_id);
                }
            } else if (status === 'rejected') {
                // Revert status to available if landlord rejects
                if (updated.bed_id) {
                    await supabase
                        .from('unit_beds')
                        .update({ status: 'available' })
                        .eq('id', updated.bed_id);
                } else if (updated.unit_id) {
                    await supabase
                        .from('property_units')
                        .update({ status: 'available' })
                        .eq('id', updated.unit_id);
                }
            }

            // Log audits
            const actionType = status === 'approved' ? 'APPROVE_TENANT_APPLICATION' : 'REJECT_TENANT_APPLICATION';
            await auditLogModel.log(landlordId, actionType, `Landlord updated tenant application ${id} status to ${status}`);

            return responseHelper.success(res, `Tenant application successfully marked as ${status}`, updated);

        } catch (error) {
            console.error('Update tenant application status error:', error);
            return responseHelper.error(res, 'Failed to update tenant application status', error, 500);
        }
    },

    async deleteProperty(req, res) {
        try {
            const { id } = req.params;
            const landlordId = req.user.id;

            const success = await landlordModel.deleteProperty(id, landlordId);
            if (!success) {
                return responseHelper.error(res, 'Property not found, status is not pending/rejected, or access denied.', null, 404);
            }

            await auditLogModel.log(landlordId, 'DELETE_PROPERTY', `Landlord deleted property ${id}`);

            return responseHelper.success(res, 'Property deleted successfully');
        } catch (error) {
            console.error('Delete property error:', error);
            return responseHelper.error(res, error.message || 'Failed to delete property', error, 500);
        }
    }
};

module.exports = landlordController;
