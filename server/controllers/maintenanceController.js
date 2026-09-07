const bcrypt = require('bcrypt');
const userModel = require('../models/userModel');
const maintenanceModel = require('../models/maintenanceModel');
const auditLogModel = require('../models/auditLogModel');
const notificationModel = require('../models/notificationModel');
const responseHelper = require('../utils/responseHelper');
const supabase = require('../config/supabaseClient');
const { uploadFile, getSignedUrl, isStorageObjectNotFound } = require('../utils/storageHelper');

const MAINTENANCE_CATEGORIES = new Set([
    'plumbing', 'electrical', 'aircon', 'door', 'roof', 'internet', 'appliance', 'others'
]);
const MAINTENANCE_PRIORITIES = new Set(['low', 'medium', 'high', 'emergency']);

const maintenanceController = {
    // ── Tenant: Create request ──────────────────────────────────────────
    async createMaintenanceRequest(req, res) {
        try {
            const { 
                property_id, lease_id, issue_title, 
                issue_description, issue_category, priority_level,
                preferred_schedule, unit_number,
                base64_content, file_name, mime_type, file_size 
            } = req.body;
            
            const tenantId = req.user.id;

            if (!property_id || !lease_id || !issue_title || !issue_description || !issue_category || !priority_level) {
                return responseHelper.error(res, 'Property, lease, title, description, category, and priority level are required.');
            }
            if (!MAINTENANCE_CATEGORIES.has(issue_category)) {
                return responseHelper.error(res, 'Select a valid maintenance issue category.');
            }
            if (!MAINTENANCE_PRIORITIES.has(priority_level)) {
                return responseHelper.error(res, 'Select a valid maintenance priority level.');
            }

            // Verify active lease
            const lease = await maintenanceModel.findActiveLease(tenantId, property_id, lease_id);
            if (!lease) {
                return responseHelper.error(res, 'You must have an active lease for this property to submit a maintenance request.');
            }

            let imageUrl = null;
            let imagePath = null;

            if (base64_content && file_name && mime_type && file_size) {
                const allowedMime = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
                if (!allowedMime.includes(mime_type)) {
                    return responseHelper.error(res, 'Invalid format. Allowed formats: PDF, JPG, JPEG, PNG, WEBP.');
                }
                if (parseInt(file_size) > 10 * 1024 * 1024) {
                    return responseHelper.error(res, 'File size exceeds maximum limit of 10MB.');
                }

                const uniqueName = `${Date.now()}-${file_name}`;
                const storagePath = `maintenance/${tenantId}/${uniqueName}`;
                const uploadResult = await uploadFile('maintenance-images', storagePath, base64_content, mime_type);
                imageUrl = uploadResult.url;
                imagePath = uploadResult.path;
            }

            const request = await maintenanceModel.createRequest({
                tenant_id: tenantId,
                landlord_id: lease.landlord_id,
                property_id,
                lease_id,
                issue_title,
                issue_description,
                issue_category,
                priority_level,
                preferred_schedule,
                unit_number,
                image_url: imageUrl,
                image_path: imagePath,
                status: 'pending'
            });

            // Create initial update log
            await maintenanceModel.createProgressUpdate({
                maintenance_request_id: request.id,
                status_update: 'pending',
                notes: 'Maintenance request submitted by tenant.'
            });

            await auditLogModel.log(tenantId, 'SUBMIT_MAINTENANCE_REQUEST', `Tenant submitted maintenance request ${request.id}`);
            await notificationModel.create({
                user_id: lease.landlord_id,
                type: 'maintenance_submitted',
                title: 'New maintenance request',
                message: `${issue_title} was reported${unit_number ? ` for unit ${unit_number}` : ''}. Review its priority and assign the next action.`,
                reference_id: request.id
            });
            return responseHelper.success(res, 'Maintenance request successfully submitted.', request, 201);

        } catch (error) {
            console.error('Create request error:', error);
            return responseHelper.error(res, 'Failed to submit maintenance request.', error, 500);
        }
    },

    // ── Tenant: Get history list ─────────────────────────────────────────
    async getMyMaintenanceRequests(req, res) {
        try {
            const list = await maintenanceModel.findByTenantId(req.user.id);
            return responseHelper.success(res, 'My maintenance requests retrieved successfully.', list);
        } catch (error) {
            console.error('Get my requests error:', error);
            return responseHelper.error(res, 'Failed to retrieve maintenance requests.', error, 500);
        }
    },

    // ── Tenant: Confirm completion or request rework ────────────────────
    async tenantConfirmRequest(req, res) {
        try {
            const { id } = req.params;
            const { decision, remarks } = req.body; // decision: 'confirm' or 'rework'
            const tenantId = req.user.id;

            if (!['confirm', 'rework'].includes(decision)) {
                return responseHelper.error(res, 'Decision must be either confirm or rework.');
            }
            if (decision === 'rework' && (!remarks || remarks.trim().length < 5)) {
                return responseHelper.error(res, 'Explain what still needs work before requesting rework.');
            }

            const request = await maintenanceModel.findRequestDetails(id);
            if (!request || request.tenant_id !== tenantId) {
                return responseHelper.error(res, 'Request not found or access denied.', null, 404);
            }

            if (request.status !== 'completed' && request.status !== 'verified') {
                return responseHelper.error(res, 'Completion can only be confirmed once task is marked completed or verified.');
            }

            let newStatus = 'closed';
            let note = 'Tenant confirmed successful repair completion. Request closed.';
            if (decision === 'rework') {
                newStatus = 'repairing';
                note = `Tenant requested rework. Remarks: ${remarks || 'None'}`;
            }

            const updated = await maintenanceModel.updateRequestStatus(id, { status: newStatus });

            await maintenanceModel.createProgressUpdate({
                maintenance_request_id: id,
                status_update: newStatus,
                notes: note
            });

            await auditLogModel.log(tenantId, 'TENANT_RESPOND_MAINTENANCE', `Tenant responded with ${decision} for task ${id}`);

            const recipients = [{
                user_id: request.landlord_id,
                type: decision === 'rework' ? 'maintenance_rework_requested' : 'maintenance_closed',
                title: decision === 'rework' ? 'Tenant requested maintenance rework' : 'Tenant confirmed the repair',
                message: decision === 'rework'
                    ? `${request.issue_title}: the tenant requested additional work${remarks ? ` — ${remarks}` : '.'}`
                    : `${request.issue_title} was confirmed complete and has been closed.`,
                reference_id: id
            }];
            if (decision === 'rework' && request.assigned_maintenance_id) {
                recipients.push({
                    user_id: request.assigned_maintenance_id,
                    type: 'maintenance_rework_requested',
                    title: 'Maintenance rework requested',
                    message: `${request.issue_title} needs additional work${remarks ? ` — ${remarks}` : '.'}`,
                    reference_id: id
                });
            }
            await Promise.all(recipients.map(notification => notificationModel.create(notification)));
            return responseHelper.success(res, `Request successfully updated as ${newStatus}.`, updated);

        } catch (error) {
            console.error('Tenant confirm error:', error);
            return responseHelper.error(res, 'Failed to log tenant response.', error, 500);
        }
    },

    // ── Landlord: Get queue list ─────────────────────────────────────────
    async getLandlordMaintenanceRequests(req, res) {
        try {
            const list = await maintenanceModel.findByLandlordId(req.user.id);
            return responseHelper.success(res, 'Landlord maintenance queue retrieved.', list);
        } catch (error) {
            console.error('Get landlord queue error:', error);
            return responseHelper.error(res, 'Failed to fetch landlord queue.', error, 500);
        }
    },

    // ── Landlord: Approve or Reject request ──────────────────────────────
    async landlordRespondRequest(req, res) {
        try {
            const { id } = req.params;
            const { decision, rejection_reason } = req.body; // decision: 'approve' or 'reject'
            const landlordId = req.user.id;

            if (!['approve', 'reject'].includes(decision)) {
                return responseHelper.error(res, 'Decision must be either approve or reject.');
            }

            const request = await maintenanceModel.findRequestDetails(id);
            if (!request || request.landlord_id !== landlordId) {
                return responseHelper.error(res, 'Request not found or access denied.', null, 404);
            }

            if (request.status !== 'pending') {
                return responseHelper.error(res, 'Request has already been processed.');
            }

            let newStatus = 'approved';
            let updatePayload = { status: 'approved' };
            let note = 'Landlord approved request.';

            if (decision === 'reject') {
                if (!rejection_reason || rejection_reason.trim().length < 5) {
                    return responseHelper.error(res, 'A clear rejection reason is required.');
                }
                newStatus = 'rejected';
                updatePayload = { status: 'rejected', rejection_reason };
                note = `Landlord rejected request. Reason: ${rejection_reason}`;
            }

            const updated = await maintenanceModel.updateRequestStatus(id, updatePayload);

            await maintenanceModel.createProgressUpdate({
                maintenance_request_id: id,
                status_update: newStatus,
                notes: note
            });

            await auditLogModel.log(landlordId, 'LANDLORD_RESPOND_MAINTENANCE', `Landlord responded ${decision} to request ${id}`);
            await notificationModel.create({
                user_id: request.tenant_id,
                type: decision === 'reject' ? 'maintenance_rejected' : 'maintenance_approved',
                title: decision === 'reject' ? 'Maintenance request was not approved' : 'Maintenance request approved',
                message: decision === 'reject'
                    ? `${request.issue_title} was not approved. ${rejection_reason}`
                    : `${request.issue_title} was approved and is ready for technician assignment.`,
                reference_id: id
            });
            return responseHelper.success(res, `Request successfully marked as ${newStatus}.`, updated);

        } catch (error) {
            console.error('Landlord respond error:', error);
            return responseHelper.error(res, 'Failed to update request evaluation.', error, 500);
        }
    },

    // ── Landlord: Assign technician ─────────────────────────────────────
    async landlordAssignRequest(req, res) {
        try {
            const { id } = req.params;
            const { assigned_maintenance_id, due_date, instructions } = req.body;
            const landlordId = req.user.id;

            if (!assigned_maintenance_id || !due_date) {
                return responseHelper.error(res, 'Technician assignment ID and completion due date are required.');
            }

            const request = await maintenanceModel.findRequestDetails(id);
            if (!request || request.landlord_id !== landlordId) {
                return responseHelper.error(res, 'Request not found or access denied.', null, 404);
            }
            if (request.status !== 'approved') {
                return responseHelper.error(res, 'Only approved requests can be assigned to a technician.');
            }

            // Verify technician role and ownership — worker must belong to this landlord
            const { data: worker, error: workerErr } = await supabase
                .from('users')
                .select('role, created_by_landlord_id')
                .eq('id', assigned_maintenance_id)
                .maybeSingle();

            if (workerErr) throw workerErr;
            if (!worker || worker.role !== 'maintenance') {
                return responseHelper.error(res, 'Selected user is not registered as maintenance personnel.');
            }
            if (worker.created_by_landlord_id !== landlordId) {
                return responseHelper.error(res, 'You can only assign maintenance workers from your own team.', null, 403);
            }

            // Create assignment details
            await maintenanceModel.createAssignment({
                maintenance_request_id: id,
                maintenance_personnel_id: assigned_maintenance_id,
                due_date,
                instructions
            });

            // Update request status to assigned
            const updated = await maintenanceModel.updateRequestStatus(id, {
                assigned_maintenance_id,
                status: 'assigned',
                landlord_remarks: instructions
            });

            // Log update
            await maintenanceModel.createProgressUpdate({
                maintenance_request_id: id,
                status_update: 'assigned',
                notes: `Assigned task to technician. Due: ${due_date}. instructions: ${instructions || 'None'}`
            });

            await auditLogModel.log(landlordId, 'ASSIGN_MAINTENANCE', `Assigned technician ${assigned_maintenance_id} to request ${id}`);
            await Promise.all([
                notificationModel.create({
                    user_id: assigned_maintenance_id,
                    type: 'maintenance_assigned',
                    title: 'New maintenance task assigned',
                    message: `${request.issue_title} is due on ${new Date(due_date).toLocaleDateString('en-PH')}. Open the task to accept or decline it.`,
                    reference_id: id
                }),
                notificationModel.create({
                    user_id: request.tenant_id,
                    type: 'maintenance_assigned',
                    title: 'A technician was assigned',
                    message: `${request.issue_title} has been assigned to maintenance personnel. You can follow its progress from your request.`,
                    reference_id: id
                })
            ]);
            return responseHelper.success(res, 'Technician assigned successfully.', updated);

        } catch (error) {
            console.error('Landlord assign error:', error);
            return responseHelper.error(res, 'Failed to assign technician.', error, 500);
        }
    },

    // ── Landlord: Verify completion or request rework ────────────────────
    async landlordVerifyCompletion(req, res) {
        try {
            const { id } = req.params;
            const { decision, remarks } = req.body; // decision: 'accept' or 'rework'
            const landlordId = req.user.id;

            if (!['accept', 'rework'].includes(decision)) {
                return responseHelper.error(res, 'Decision must be either accept or rework.');
            }
            if (decision === 'rework' && (!remarks || remarks.trim().length < 5)) {
                return responseHelper.error(res, 'Explain what still needs work before requesting rework.');
            }

            const request = await maintenanceModel.findRequestDetails(id);
            if (!request || request.landlord_id !== landlordId) {
                return responseHelper.error(res, 'Request not found or access denied.', null, 404);
            }

            if (request.status !== 'completed') {
                return responseHelper.error(res, 'Task must be in completed status to verify.');
            }

            let newStatus = 'verified';
            let note = 'Landlord verified and accepted the completed repair work.';
            if (decision === 'rework') {
                newStatus = 'repairing'; // Return to technician
                note = `Landlord requested rework. Remarks: ${remarks || 'None'}`;
            }

            const updated = await maintenanceModel.updateRequestStatus(id, { status: newStatus });

            await maintenanceModel.createProgressUpdate({
                maintenance_request_id: id,
                status_update: newStatus,
                notes: note
            });

            await auditLogModel.log(landlordId, 'LANDLORD_VERIFY_MAINTENANCE', `Landlord assessed completion as ${decision} for request ${id}`);
            const verificationNotifications = [{
                user_id: request.tenant_id,
                type: decision === 'rework' ? 'maintenance_rework_requested' : 'maintenance_verified',
                title: decision === 'rework' ? 'Maintenance rework requested' : 'Maintenance work verified',
                message: decision === 'rework'
                    ? `${request.issue_title} was returned to the technician for additional work.`
                    : `${request.issue_title} was verified by the landlord. Please confirm the repair from your request.`,
                reference_id: id
            }];
            if (request.assigned_maintenance_id) {
                verificationNotifications.push({
                    user_id: request.assigned_maintenance_id,
                    type: decision === 'rework' ? 'maintenance_rework_requested' : 'maintenance_verified',
                    title: decision === 'rework' ? 'Landlord requested rework' : 'Maintenance work accepted',
                    message: decision === 'rework'
                        ? `${request.issue_title} needs additional work${remarks ? ` — ${remarks}` : '.'}`
                        : `${request.issue_title} was reviewed and accepted by the landlord.`,
                    reference_id: id
                });
            }
            await Promise.all(verificationNotifications.map(notification => notificationModel.create(notification)));
            return responseHelper.success(res, `Request successfully updated as ${newStatus}.`, updated);

        } catch (error) {
            console.error('Landlord verify error:', error);
            return responseHelper.error(res, 'Failed to verify maintenance completion.', error, 500);
        }
    },

    // ── Technician: View assigned jobs ──────────────────────────────────
    async getMaintenanceTasks(req, res) {
        try {
            const list = await maintenanceModel.findByMaintenanceId(req.user.id);
            return responseHelper.success(res, 'Assigned maintenance tasks retrieved successfully.', list);
        } catch (error) {
            console.error('Get assigned tasks error:', error);
            return responseHelper.error(res, 'Failed to retrieve tasks.', error, 500);
        }
    },

    // ── Technician: Accept or Decline job ───────────────────────────────
    async workerRespondJob(req, res) {
        try {
            const { id } = req.params;
            const { response } = req.body; // response: 'accept' or 'decline'
            const workerId = req.user.id;

            if (!['accept', 'decline'].includes(response)) {
                return responseHelper.error(res, 'Response must be either accept or decline.');
            }

            const request = await maintenanceModel.findRequestDetails(id);
            if (!request || request.assigned_maintenance_id !== workerId) {
                return responseHelper.error(res, 'Request not found or access denied.', null, 404);
            }

            if (request.status !== 'assigned') {
                return responseHelper.error(res, 'Task status is not assigned.');
            }

            let newStatus = 'accepted';
            let updatePayload = { status: 'accepted' };
            let note = 'Technician accepted the job.';

            if (response === 'decline') {
                // If declined, return request back to approved status for landlord to re-assign
                newStatus = 'approved';
                updatePayload = { status: 'approved', assigned_maintenance_id: null };
                note = 'Technician declined the job. Task returned to approved pool.';
            }

            const updated = await maintenanceModel.updateRequestStatus(id, updatePayload);

            await maintenanceModel.createProgressUpdate({
                maintenance_request_id: id,
                status_update: newStatus,
                notes: note
            });

            await auditLogModel.log(workerId, 'WORKER_RESPOND_JOB', `Technician ${workerId} responded ${response} to task ${id}`);
            await Promise.all([
                notificationModel.create({
                    user_id: request.landlord_id,
                    type: response === 'decline' ? 'maintenance_assignment_declined' : 'maintenance_assignment_accepted',
                    title: response === 'decline' ? 'Technician declined the task' : 'Technician accepted the task',
                    message: response === 'decline'
                        ? `${request.issue_title} needs to be assigned to another technician.`
                        : `${request.issue_title} was accepted and is ready to begin.`,
                    reference_id: id
                }),
                ...(response === 'accept' ? [notificationModel.create({
                    user_id: request.tenant_id,
                    type: 'maintenance_assignment_accepted',
                    title: 'Technician accepted your request',
                    message: `Maintenance personnel accepted ${request.issue_title}. Progress updates will appear here.`,
                    reference_id: id
                })] : [])
            ]);
            return responseHelper.success(res, `Task marked as ${newStatus}.`, updated);

        } catch (error) {
            console.error('Worker respond error:', error);
            return responseHelper.error(res, 'Failed to submit response.', error, 500);
        }
    },

    // ── Technician: Update job status (travelling, arrived, repairing) ──
    async workerUpdateStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body; // status: 'travelling', 'arrived', 'repairing'
            const workerId = req.user.id;

            if (!status) {
                return responseHelper.error(res, 'Status update parameter is required.');
            }

            const allowedStatuses = ['travelling', 'arrived', 'repairing'];
            if (!allowedStatuses.includes(status)) {
                return responseHelper.error(res, 'Invalid status update. Allowed: travelling, arrived, repairing.');
            }

            const request = await maintenanceModel.findRequestDetails(id);
            if (!request || request.assigned_maintenance_id !== workerId) {
                return responseHelper.error(res, 'Request not found or access denied.', null, 404);
            }

            const allowedNextStatus = {
                accepted: 'travelling',
                travelling: 'arrived',
                arrived: 'repairing'
            }[request.status];
            if (status !== allowedNextStatus) {
                return responseHelper.error(
                    res,
                    allowedNextStatus
                        ? `The next valid task status is ${allowedNextStatus}.`
                        : 'This task cannot receive another progress update in its current state.'
                );
            }

            let updatePayload = { status };
            let note = `Technician updated progress status to: ${status}`;

            if (status === 'travelling') {
                updatePayload.travel_started_at = new Date();
                note = 'Technician is travelling / on the way to the property.';
            } else if (status === 'arrived') {
                updatePayload.arrived_at = new Date();
                note = 'Technician has arrived at the property unit.';
            } else if (status === 'repairing') {
                updatePayload.repair_started_at = new Date();
                note = 'Technician has started repairing the issue.';
            }

            const updated = await maintenanceModel.updateRequestStatus(id, updatePayload);

            await maintenanceModel.createProgressUpdate({
                maintenance_request_id: id,
                status_update: status,
                notes: note
            });

            await auditLogModel.log(workerId, 'WORKER_UPDATE_STATUS', `Technician updated status to ${status} for task ${id}`);
            const statusLabels = {
                travelling: 'is on the way to the property',
                arrived: 'has arrived at the property',
                repairing: 'has started the repair'
            };
            await Promise.all([request.tenant_id, request.landlord_id].map(userId => notificationModel.create({
                user_id: userId,
                type: `maintenance_${status}`,
                title: 'Maintenance progress updated',
                message: `The technician ${statusLabels[status]} for ${request.issue_title}.`,
                reference_id: id
            })));
            return responseHelper.success(res, `Task updated as ${status}.`, updated);

        } catch (error) {
            console.error('Worker status update error:', error);
            return responseHelper.error(res, 'Failed to update task status.', error, 500);
        }
    },

    // ── Technician: Submit completion report ────────────────────────────
    async workerSubmitReport(req, res) {
        try {
            const { id } = req.params;
            const { 
                problem_found, repair_performed, recommendations, 
                labor_cost, materials, // materials array: [{material_name, quantity, cost}]
                before_base64, before_filename, before_mimetype,
                after_base64, after_filename, after_mimetype
            } = req.body;
            
            const workerId = req.user.id;

            if (!problem_found || !repair_performed) {
                return responseHelper.error(res, 'Problem found details and repair actions description are required.');
            }

            const request = await maintenanceModel.findRequestDetails(id);
            if (!request || request.assigned_maintenance_id !== workerId) {
                return responseHelper.error(res, 'Request not found or access denied.', null, 404);
            }
            if (request.status !== 'repairing') {
                return responseHelper.error(res, 'A completion report can only be submitted while the task is in repair.');
            }

            const validCost = value => ['string', 'number'].includes(typeof value)
                && /^\d+(?:\.\d{1,2})?$/.test(String(value).trim())
                && Number.isSafeInteger(Math.round(Number(value) * 100));
            const laborValue = labor_cost == null || labor_cost === '' ? 0 : labor_cost;
            const materialRows = materials == null ? [] : materials;
            if (!validCost(laborValue) || !Array.isArray(materialRows) || materialRows.some(item =>
                !item || typeof item.material_name !== 'string' || !item.material_name.trim()
                || !['string', 'number'].includes(typeof item.quantity)
                || !/^\d+$/.test(String(item.quantity)) || !Number.isSafeInteger(Number(item.quantity)) || Number(item.quantity) < 1
                || !validCost(item.cost))) {
                return responseHelper.error(res, 'Enter nonnegative costs with at most two decimal places and positive whole-number material quantities.');
            }
            const materialCentavos = materialRows.reduce((total, item) => total + Math.round(Number(item.cost) * 100) * Number(item.quantity), 0);
            if (!Number.isSafeInteger(materialCentavos)) return responseHelper.error(res, 'The material total is too large.');

            // Upload photos if provided
            let beforePhotoUrl = null;
            let afterPhotoUrl = null;

            if (before_base64 && before_filename && before_mimetype) {
                const uniqueName = `${Date.now()}-before-${before_filename}`;
                const storagePath = `maintenance_reports/${id}/${uniqueName}`;
                const uploadResult = await uploadFile('maintenance-images', storagePath, before_base64, before_mimetype);
                beforePhotoUrl = uploadResult.url;
            }

            if (after_base64 && after_filename && after_mimetype) {
                const uniqueName = `${Date.now()}-after-${after_filename}`;
                const storagePath = `maintenance_reports/${id}/${uniqueName}`;
                const uploadResult = await uploadFile('maintenance-images', storagePath, after_base64, after_mimetype);
                afterPhotoUrl = uploadResult.url;
            }

            // Save materials
            const calculatedMaterialCost = materialCentavos / 100;
            await maintenanceModel.deleteRequestMaterials(id);
            for (const material of materialRows) {
                await maintenanceModel.addMaterial({
                    maintenance_request_id: id,
                    material_name: material.material_name.trim(),
                    quantity: Number(material.quantity),
                    cost: Number(material.cost)
                });
            }

            const parsedLaborCost = Number(laborValue);

            // Create completion report
            const materialsListStr = Array.isArray(materials) 
                ? materials.map(m => `${m.material_name} (x${m.quantity})`).join(', ')
                : '';

            const report = await maintenanceModel.createReport({
                maintenance_request_id: id,
                maintenance_personnel_id: workerId,
                problem_found,
                repair_performed,
                materials_used: materialsListStr,
                recommendations,
                labor_cost: parsedLaborCost,
                material_cost: calculatedMaterialCost
            });

            // Update request status to completed
            const updated = await maintenanceModel.updateRequestStatus(id, {
                status: 'completed',
                completed_at: new Date(),
                before_photo_url: beforePhotoUrl || request.before_photo_url,
                after_photo_url: afterPhotoUrl || request.after_photo_url,
                labor_cost: parsedLaborCost,
                material_cost: calculatedMaterialCost,
                problem_found,
                repair_performed,
                recommendations
            });

            // Log update
            await maintenanceModel.createProgressUpdate({
                maintenance_request_id: id,
                status_update: 'completed',
                notes: `Job completed. Labor: ₱${parsedLaborCost}. Materials: ₱${calculatedMaterialCost}. Report submitted.`
            });

            await auditLogModel.log(workerId, 'WORKER_SUBMIT_REPORT', `Technician submitted completion report for request ${id}`);
            await Promise.all([request.tenant_id, request.landlord_id].map(userId => notificationModel.create({
                user_id: userId,
                type: 'maintenance_completed',
                title: 'Maintenance work completed',
                message: `${request.issue_title} was marked complete. Review the repair report and confirm the result.`,
                reference_id: id
            })));
            return responseHelper.success(res, 'Maintenance completion report submitted successfully.', { report, updated });

        } catch (error) {
            console.error('Worker submit report error:', error);
            return responseHelper.error(res, 'Failed to submit completion report.', error, 500);
        }
    },

    // ── Get request details (Shared) ─────────────────────────────────────
    async getRequestDetails(req, res) {
        try {
            const { id } = req.params;
            const request = await maintenanceModel.findRequestDetails(id);
            if (!request) {
                return responseHelper.error(res, 'Maintenance request not found.', null, 404);
            }

            // Authorization check
            const role = req.user.role;
            const userId = req.user.id;

            if (role === 'tenant' && request.tenant_id !== userId) {
                return responseHelper.error(res, 'Access denied.', null, 403);
            }
            if (role === 'landlord' && request.landlord_id !== userId) {
                return responseHelper.error(res, 'Access denied.', null, 403);
            }
            if (role === 'maintenance' && request.assigned_maintenance_id !== userId) {
                return responseHelper.error(res, 'Access denied.', null, 403);
            }

            // Generate signed URLs if storage path exists
            if (request.image_path) {
                try {
                    request.image_url = await getSignedUrl('maintenance-images', request.image_path);
                } catch (e) {
                    if (isStorageObjectNotFound(e)) {
                        request.image_url = null;
                        request.image_unavailable = true;
                    } else {
                        console.error('Error generating request image signed url:', e);
                    }
                }
            }

            // Get support records
            const assignment = await maintenanceModel.findAssignment(id);
            const updates = await maintenanceModel.findProgressUpdates(id);
            const materials = await maintenanceModel.findMaterials(id);
            const report = await maintenanceModel.findReport(id);

            return responseHelper.success(res, 'Request details retrieved successfully.', {
                request,
                assignment,
                updates,
                materials,
                report
            });

        } catch (error) {
            console.error('Get request details error:', error);
            return responseHelper.error(res, 'Failed to retrieve details.', error, 500);
        }
    },

    // ── Get Active Maintenance workers list ──────────────────────────────
    // Admins see all workers; landlords see only their own workers.
    async getMaintenancePersonnel(req, res) {
        try {
            let query = supabase
                .from('users')
                .select('id, full_name, email, contact_number, created_at')
                .eq('role', 'maintenance')
                .eq('account_status', 'active');

            if (req.user.role === 'landlord') {
                query = query.eq('created_by_landlord_id', req.user.id);
            }

            const { data: workers, error } = await query;
            if (error) throw error;
            return responseHelper.success(res, 'Active maintenance personnel list retrieved.', workers);
        } catch (error) {
            console.error('Get technicians list error:', error);
            return responseHelper.error(res, 'Failed to fetch workers list.', error, 500);
        }
    },

    // ── Create Maintenance Worker Account (Landlord) ──────────────────────
    async createMaintenanceWorker(req, res) {
        try {
            const { full_name, email, password, contact_number, trade } = req.body;
            const landlordId = req.user.id;

            if (!full_name || !email || !password) {
                return responseHelper.error(res, 'Full name, email, and password are required.');
            }
            if (password.length < 6) {
                return responseHelper.error(res, 'Password must be at least 6 characters.');
            }

            // Check duplicate email
            const existingUser = await userModel.findByEmail(email);
            if (existingUser) {
                return responseHelper.error(res, 'An account with this email address is already registered.');
            }

            // Hash password
            const saltRounds = 12;
            const password_hash = await bcrypt.hash(password, saltRounds);

            // Format worker display name with trade if provided
            const displayName = trade ? `${full_name.trim()} (${trade.trim()})` : full_name.trim();

            // Create worker user — scoped to the creating landlord
            const newWorker = await userModel.createUser({
                full_name: displayName,
                email: email.trim().toLowerCase(),
                password_hash,
                role: 'maintenance',
                contact_number: contact_number || null,
                created_by_landlord_id: landlordId,
                is_verified: true,
                account_status: 'active'
            });

            await auditLogModel.log(landlordId, 'CREATE_MAINTENANCE_WORKER', `Created worker ${newWorker.email}`);

            await Promise.all([
                notificationModel.create({
                    user_id: newWorker.id,
                    type: 'welcome',
                    title: 'Welcome to DOMIKNOW Field Operations',
                    message: 'Your maintenance account is active. Assigned work orders and schedule changes will appear in this notification center.',
                    reference_id: null
                }),
                notificationModel.create({
                    user_id: landlordId,
                    type: 'maintenance_account_created',
                    title: 'Maintenance account created',
                    message: `${newWorker.full_name} can now receive maintenance task assignments.`,
                    reference_id: newWorker.id
                })
            ]);

            return responseHelper.success(res, 'Maintenance worker account created successfully.', {
                id: newWorker.id,
                full_name: newWorker.full_name,
                email: newWorker.email,
                role: newWorker.role
            }, 201);

        } catch (error) {
            console.error('Create worker error:', error);
            return responseHelper.error(res, 'Failed to create worker account.', error, 500);
        }
    },

    // ── Delete / Remove Maintenance Worker ──────────────────────────────
    async deleteMaintenanceWorker(req, res) {
        try {
            const { id } = req.params;
            const landlordId = req.user.id;
            const role = req.user.role;

            // 1. Verify worker exists
            const { data: worker, error: workerErr } = await supabase
                .from('users')
                .select('id, full_name, email, role, created_by_landlord_id, account_status')
                .eq('id', id)
                .maybeSingle();

            if (workerErr) throw workerErr;
            if (!worker || worker.role !== 'maintenance') {
                return responseHelper.error(res, 'Maintenance worker not found.', null, 404);
            }

            // 2. Authorization check: landlord can only delete workers they created
            if (role === 'landlord' && worker.created_by_landlord_id !== landlordId) {
                return responseHelper.error(res, 'You do not have permission to delete this maintenance worker.', null, 403);
            }

            // 3. Check for ongoing/active tasks
            const { data: activeTasks, error: activeErr } = await supabase
                .from('maintenance_requests')
                .select('id, issue_title, status')
                .eq('assigned_maintenance_id', id)
                .in('status', ['assigned', 'accepted', 'travelling', 'arrived', 'repairing']);

            if (activeErr) throw activeErr;

            if (activeTasks && activeTasks.length > 0) {
                const sampleTitle = activeTasks[0].issue_title;
                return responseHelper.error(
                    res,
                    `Cannot delete this worker because they have ${activeTasks.length} ongoing repair task(s) (e.g. "${sampleTitle}"). Please reassign or complete those tasks before removing this worker.`,
                    null,
                    400
                );
            }

            // 4. Check if worker has historical records
            let hardDeleted = false;
            const { data: allTasks } = await supabase
                .from('maintenance_requests')
                .select('id')
                .eq('assigned_maintenance_id', id)
                .limit(1);

            if (!allTasks || allTasks.length === 0) {
                const { error: delErr } = await supabase
                    .from('users')
                    .delete()
                    .eq('id', id);

                if (!delErr) hardDeleted = true;
            }

            if (!hardDeleted) {
                const { error: updErr } = await supabase
                    .from('users')
                    .update({
                        account_status: 'disabled',
                        is_verified: false,
                        updated_at: new Date()
                    })
                    .eq('id', id);

                if (updErr) throw updErr;
            }

            await auditLogModel.log(
                landlordId,
                'DELETE_MAINTENANCE_WORKER',
                `Removed worker ${worker.full_name} (${worker.email})`
            );

            return responseHelper.success(res, `Maintenance worker "${worker.full_name}" has been successfully removed.`);

        } catch (error) {
            console.error('Delete worker error:', error);
            return responseHelper.error(res, 'Failed to delete maintenance worker.', error, 500);
        }
    }
};

module.exports = maintenanceController;
