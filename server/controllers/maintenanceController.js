const bcrypt = require('bcrypt');
const userModel = require('../models/userModel');
const maintenanceModel = require('../models/maintenanceModel');
const auditLogModel = require('../models/auditLogModel');
const notificationModel = require('../models/notificationModel');
const responseHelper = require('../utils/responseHelper');
const supabase = require('../config/supabaseClient');
const { uploadFile, getSignedUrl, isStorageObjectNotFound } = require('../utils/storageHelper');

let maintenanceComplianceService = null;
let maintenancePersonnelModel = null;
try {
    maintenanceComplianceService = require('../services/maintenanceComplianceService');
    maintenancePersonnelModel = require('../models/maintenancePersonnelModel');
} catch (_) {}

const MAINTENANCE_CATEGORIES = new Set([
    'plumbing', 'electrical', 'aircon', 'door', 'roof', 'internet', 'appliance', 'others'
]);
const MAINTENANCE_PRIORITIES = new Set(['low', 'medium', 'high', 'emergency']);

function getRequestMeta(request) {
    if (request && typeof maintenanceModel?.parseMaintenanceMeta === 'function') {
        return maintenanceModel.parseMaintenanceMeta(request);
    }
    return (request && request.meta) || {};
}

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
            } else {
                // Payment verification gate for billable & adjudicated work orders
                const meta = getRequestMeta(request);
                const isBillableAndAdjudicated = ['landlord', 'tenant', 'shared'].includes(meta.liability_party) && meta.total_cost > 0;
                if (isBillableAndAdjudicated && meta.payment_status !== 'verified') {
                    return responseHelper.error(
                        res,
                        `Payment verification required: This work order has an assessed balance of ₱${meta.total_cost.toFixed(2)} (${meta.liability_party.toUpperCase()} liability) that must be submitted and verified by Admin before the ticket can be formally closed.`
                    );
                }
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

    // ── Landlord: Create maintenance work order ──────────────────────────
    async createLandlordMaintenanceRequest(req, res) {
        try {
            const {
                property_id, unit_id, unit_number, scope,
                issue_title, issue_description, issue_category, priority_level,
                preferred_schedule,
                base64_content, file_name, mime_type, file_size
            } = req.body;

            const landlordId = req.user.id;

            if (!property_id || !issue_title || !issue_description || !issue_category || !priority_level) {
                return responseHelper.error(res, 'Property, title, description, category, and priority level are required.');
            }
            if (!MAINTENANCE_CATEGORIES.has(issue_category)) {
                return responseHelper.error(res, 'Select a valid maintenance issue category.');
            }
            if (!MAINTENANCE_PRIORITIES.has(priority_level)) {
                return responseHelper.error(res, 'Select a valid maintenance priority level.');
            }

            // Verify landlord owns this property
            const { data: property, error: propErr } = await supabase
                .from('properties')
                .select('id, property_name, landlord_id')
                .eq('id', property_id)
                .eq('landlord_id', landlordId)
                .maybeSingle();

            if (propErr) throw propErr;
            if (!property) {
                return responseHelper.error(res, 'Property not found or you are not authorized to create work orders for it.', null, 403);
            }

            // Determine unit number and active tenant/lease if applicable
            let resolvedUnitNumber = (unit_number || '').trim();
            let activeTenantId = null;
            let activeLeaseId = null;

            if (unit_id) {
                const { data: unitData } = await supabase
                    .from('property_units')
                    .select('id, unit_number')
                    .eq('id', unit_id)
                    .eq('property_id', property_id)
                    .maybeSingle();

                if (unitData) {
                    if (!resolvedUnitNumber) resolvedUnitNumber = unitData.unit_number;
                }

                // Check active lease for this unit
                const { data: unitLease } = await supabase
                    .from('lease_records')
                    .select('id, tenant_id')
                    .eq('unit_id', unit_id)
                    .eq('lease_status', 'active')
                    .maybeSingle();

                if (unitLease) {
                    activeLeaseId = unitLease.id;
                    activeTenantId = unitLease.tenant_id;
                }
            }

            // If scope is common area or no unit provided, set resolvedUnitNumber
            const isCommonArea = scope === 'common_area' || (!unit_id && !resolvedUnitNumber);
            if (isCommonArea) {
                resolvedUnitNumber = 'Common Area / Facility';
            }

            // If no active lease for this specific unit, resolve an anchor lease for the property
            if (!activeLeaseId || !activeTenantId) {
                // Try active lease on property
                const { data: propActiveLease } = await supabase
                    .from('lease_records')
                    .select('id, tenant_id')
                    .eq('property_id', property_id)
                    .eq('lease_status', 'active')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (propActiveLease) {
                    activeLeaseId = propActiveLease.id;
                    activeTenantId = propActiveLease.tenant_id;
                } else {
                    // Try any historical lease on property
                    const { data: propAnyLease } = await supabase
                        .from('lease_records')
                        .select('id, tenant_id')
                        .eq('property_id', property_id)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (propAnyLease) {
                        activeLeaseId = propAnyLease.id;
                        activeTenantId = propAnyLease.tenant_id;
                    } else {
                        // System anchor fallback to satisfy DB FK constraints
                        const { data: sysLease } = await supabase
                            .from('lease_records')
                            .select('id, tenant_id')
                            .limit(1)
                            .maybeSingle();

                        if (sysLease) {
                            activeLeaseId = sysLease.id;
                            activeTenantId = sysLease.tenant_id;
                        } else {
                            return responseHelper.error(res, 'Cannot create maintenance request: No lease anchor found in the system.', null, 400);
                        }
                    }
                }
            }

            // Handle optional image upload
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
                const storagePath = `maintenance/${landlordId}/${uniqueName}`;
                const uploadResult = await uploadFile('maintenance-images', storagePath, base64_content, mime_type);
                imageUrl = uploadResult.url;
                imagePath = uploadResult.path;
            }

            const scopeTag = isCommonArea ? 'COMMON_AREA' : (resolvedUnitNumber.replace(/\s+/g, '_').toUpperCase() || 'UNIT');
            const recommendations = `[INITIATED_BY:LANDLORD][SCOPE:${scopeTag}][LIABILITY:PENDING_ADMIN_DETERMINATION][BASIS:ART_1654_MAINTENANCE] Work order initiated by property owner under Civil Code Art. 1654. Root-cause inspection and legal liability pending Admin determination.`;

            // Landlord-initiated work orders start as 'approved' (pre-approved by property owner, ready for Admin technician dispatch)
            const request = await maintenanceModel.createRequest({
                tenant_id: activeTenantId,
                landlord_id: landlordId,
                property_id,
                lease_id: activeLeaseId,
                issue_title,
                issue_description,
                issue_category,
                priority_level,
                preferred_schedule,
                unit_number: resolvedUnitNumber,
                image_url: imageUrl,
                image_path: imagePath,
                recommendations,
                status: 'approved'
            });

            // Update status explicitly to approved if createRequest sets status: 'pending'
            await supabase
                .from('maintenance_requests')
                .update({ status: 'approved', recommendations })
                .eq('id', request.id);

            // Log progress entry
            await maintenanceModel.createProgressUpdate({
                maintenance_request_id: request.id,
                status_update: 'approved',
                notes: `Work order submitted directly by Property Owner (${property.property_name}). Pre-approved for technician dispatch under Civil Code Art. 1654.`
            });

            await auditLogModel.log(landlordId, 'SUBMIT_LANDLORD_WORK_ORDER', `Landlord submitted maintenance work order ${request.id} for ${property.property_name}`);

            // Notify Admin of new work order awaiting dispatch
            const { data: admins } = await supabase
                .from('users')
                .select('id')
                .eq('role', 'admin');

            if (admins && admins.length > 0) {
                await Promise.all(admins.map(adm => notificationModel.create({
                    user_id: adm.id,
                    type: 'maintenance_landlord_work_order',
                    title: 'New Landlord Work Order',
                    message: `${property.property_name}: Landlord submitted work order "${issue_title}" (${resolvedUnitNumber}). Ready for technician dispatch.`,
                    reference_id: request.id
                })));
            }

            // If unit has an active tenant, send a courtesy notification
            if (activeTenantId && activeTenantId !== landlordId && !isCommonArea) {
                await notificationModel.create({
                    user_id: activeTenantId,
                    type: 'maintenance_owner_scheduled',
                    title: 'Owner Scheduled Maintenance',
                    message: `Your landlord scheduled maintenance: "${issue_title}". Target schedule: ${preferred_schedule || 'To be coordinated by technician'}.`,
                    reference_id: request.id
                });
            }

            return responseHelper.success(res, 'Maintenance work order submitted successfully.', { ...request, status: 'approved' }, 201);

        } catch (error) {
            console.error('Create landlord work order error:', error);
            return responseHelper.error(res, 'Failed to submit landlord maintenance work order.', error, 500);
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

            // Qualification and compliance verification
            if (maintenanceComplianceService && typeof maintenanceComplianceService.checkEligibility === 'function') {
                const eligibility = await maintenanceComplianceService.checkEligibility(assigned_maintenance_id, request.issue_category);
                if (!eligibility.eligible) {
                    return responseHelper.error(res, `Assignment blocked: Technician is not eligible. ${eligibility.reasons.join('; ')}`);
                }
            }

            // Create assignment details
            await maintenanceModel.createAssignment({
                maintenance_request_id: id,
                maintenance_personnel_id: assigned_maintenance_id,
                due_date,
                instructions
            });

            if (maintenancePersonnelModel && typeof maintenancePersonnelModel.createVerifiedAssignment === 'function') {
                await maintenancePersonnelModel.createVerifiedAssignment({
                    maintenance_request_id: id,
                    maintenance_personnel_id: assigned_maintenance_id,
                    due_date,
                    instructions: instructions || 'Landlord assigned technician.',
                    compliance_verified_by: landlordId
                }).catch(() => {});
            }

            // Update request status to assigned
            const updated = await maintenanceModel.updateRequestStatus(id, {
                assigned_maintenance_id,
                status: 'assigned',
                preferred_schedule: due_date,
                landlord_remarks: instructions
            });

            // Log update
            await maintenanceModel.createProgressUpdate({
                maintenance_request_id: id,
                status_update: 'assigned',
                notes: `Assigned task to technician. Due: ${due_date}. instructions: ${instructions || 'None'}`
            });

            await auditLogModel.log(landlordId, 'ASSIGN_MAINTENANCE', `Assigned technician ${assigned_maintenance_id} to request ${id}`);
            
            const formattedDue = due_date ? new Date(due_date).toLocaleDateString('en-PH') : 'Scheduled date';
            const notifPromises = [
                notificationModel.create({
                    user_id: assigned_maintenance_id,
                    type: 'maintenance_assigned',
                    title: 'New maintenance task assigned',
                    message: `${request.issue_title} is due on ${formattedDue}. Open the task to accept or decline it.`,
                    reference_id: id
                })
            ];

            if (request.tenant_id) {
                notifPromises.push(
                    notificationModel.create({
                        user_id: request.tenant_id,
                        type: 'maintenance_assigned',
                        title: 'A technician was assigned',
                        message: `${request.issue_title} has been assigned to maintenance personnel. You can follow its progress from your request.`,
                        reference_id: id
                    })
                );
            }

            await Promise.allSettled(notifPromises);
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
                arrived: 'repairing',
                approved: 'repairing',
                quote_approved: 'repairing'
            }[request.status];
            if (status !== allowedNextStatus) {
                return responseHelper.error(
                    res,
                    allowedNextStatus
                        ? `The next valid task status is ${allowedNextStatus}.`
                        : (['inspection_submitted', 'quote_pending'].includes(request.status)
                            ? 'This work order is currently awaiting Admin liability adjudication or quotation approval.'
                            : 'This task cannot receive another progress update in its current state.')
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
            // Preserve existing metadata tags (like [INITIATED_BY:LANDLORD], [LIABILITY:...], etc.)
            const existingTags = (request.recommendations || '').match(/\[[A-Z0-9_: ]+\]/gi) || [];
            const tagsPrefix = existingTags.length > 0 ? existingTags.join('') + ' ' : '';
            const mergedRecommendations = `${tagsPrefix}${recommendations || ''}`.trim();

            const updated = await maintenanceModel.updateRequestStatus(id, {
                status: 'completed',
                completed_at: new Date(),
                before_photo_url: beforePhotoUrl || request.before_photo_url,
                after_photo_url: afterPhotoUrl || request.after_photo_url,
                labor_cost: parsedLaborCost,
                material_cost: calculatedMaterialCost,
                problem_found,
                repair_performed,
                recommendations: mergedRecommendations
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
            const meta = maintenanceModel.parseMaintenanceMeta(request);

            return responseHelper.success(res, 'Request details retrieved successfully.', {
                request,
                assignment,
                updates,
                materials,
                report,
                meta
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

            if (maintenanceComplianceService && typeof maintenanceComplianceService.initStaffRecords === 'function') {
                await maintenanceComplianceService.initStaffRecords(newWorker.id, {
                    department: trade ? `${trade.trim()} Team` : 'Property Maintenance',
                    service_area: 'Landlord Assigned Properties',
                    created_by: landlordId
                }).catch(() => {});
            }
            if (trade && maintenancePersonnelModel && typeof maintenancePersonnelModel.syncSkills === 'function') {
                await maintenancePersonnelModel.syncSkills(newWorker.id, [trade.trim()]).catch(() => {});
            }

            await maintenanceModel.ensureWorkerAccreditation(newWorker.id);
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
    },

    // ── Admin: Operational Cost & Maintenance Hub Overview ─────────────
    async adminGetOverview(req, res) {
        try {
            const stats = await maintenanceModel.adminGetOperationalCostStats();
            return responseHelper.success(res, 'Operational cost overview retrieved successfully.', stats);
        } catch (error) {
            console.error('Admin maintenance overview error:', error);
            return responseHelper.error(res, 'Failed to fetch operational cost overview.', error, 500);
        }
    },

    // ── Admin: Get all requests across properties with full filters ─────
    async adminGetAllRequests(req, res) {
        try {
            const { status, property_id } = req.query;
            const list = await maintenanceModel.findAllRequests({ status, property_id });
            return responseHelper.success(res, 'All maintenance requests retrieved successfully.', list);
        } catch (error) {
            console.error('Admin get requests error:', error);
            return responseHelper.error(res, 'Failed to fetch maintenance requests.', error, 500);
        }
    },

    // ── Admin: Dispatch accredited technician from platform pool ───────
    async adminDispatchPersonnel(req, res) {
        try {
            const { id } = req.params;
            const { assigned_maintenance_id, due_date, instructions } = req.body;
            const adminId = req.user.id;

            if (!assigned_maintenance_id || !due_date) {
                return responseHelper.error(res, 'Technician assignment ID and target completion due date are required.');
            }

            const request = await maintenanceModel.findRequestDetails(id);
            if (!request) {
                return responseHelper.error(res, 'Maintenance request not found.', null, 404);
            }

            // Verify technician role
            const { data: worker, error: workerErr } = await supabase
                .from('users')
                .select('id, full_name, role')
                .eq('id', assigned_maintenance_id)
                .maybeSingle();

            if (workerErr) throw workerErr;
            if (!worker || worker.role !== 'maintenance') {
                return responseHelper.error(res, 'Selected user is not registered as maintenance personnel.');
            }

            // Qualification and compliance verification
            if (maintenanceComplianceService && typeof maintenanceComplianceService.checkEligibility === 'function') {
                const eligibility = await maintenanceComplianceService.checkEligibility(assigned_maintenance_id, request.issue_category);
                if (!eligibility.eligible) {
                    return responseHelper.error(res, `Dispatch blocked: Technician is not eligible. ${eligibility.reasons.join('; ')}`);
                }
            }

            // Create assignment details
            await maintenanceModel.createAssignment({
                maintenance_request_id: id,
                maintenance_personnel_id: assigned_maintenance_id,
                due_date,
                instructions: instructions || 'Dispatched by Platform Administrator for on-site assessment.'
            });

            if (maintenancePersonnelModel && typeof maintenancePersonnelModel.createVerifiedAssignment === 'function') {
                await maintenancePersonnelModel.createVerifiedAssignment({
                    maintenance_request_id: id,
                    maintenance_personnel_id: assigned_maintenance_id,
                    due_date,
                    instructions: instructions || 'Dispatched by Platform Administrator for on-site assessment.',
                    compliance_verified_by: adminId
                }).catch(() => {});
            }

            // Update request status to assigned
            const updated = await maintenanceModel.updateRequestStatus(id, {
                assigned_maintenance_id,
                status: 'assigned',
                preferred_schedule: due_date,
                landlord_remarks: instructions || `Dispatched by Admin to ${worker.full_name}`
            });

            await maintenanceModel.createProgressUpdate({
                maintenance_request_id: id,
                status_update: 'assigned',
                notes: `Administrator dispatched technician ${worker.full_name}. Target due date: ${due_date}. Instructions: ${instructions || 'On-site diagnosis'}`
            });

            await auditLogModel.log(adminId, 'ADMIN_DISPATCH_MAINTENANCE', `Admin dispatched technician ${assigned_maintenance_id} to request ${id}`);

            // Safely notify technician, landlord, and tenant
            const formattedDue = due_date ? new Date(due_date).toLocaleDateString('en-PH') : 'Scheduled date';
            const notifPromises = [
                notificationModel.create({
                    user_id: assigned_maintenance_id,
                    type: 'maintenance_assigned',
                    title: 'New maintenance dispatch order',
                    message: `You were dispatched by Admin for ${request.issue_title} at ${request.properties?.property_name || 'Property'}. Due: ${formattedDue}.`,
                    reference_id: id
                })
            ];

            if (request.tenant_id) {
                notifPromises.push(
                    notificationModel.create({
                        user_id: request.tenant_id,
                        type: 'maintenance_assigned',
                        title: 'Technician dispatched for your request',
                        message: `Administrator dispatched ${worker.full_name} to inspect ${request.issue_title}.`,
                        reference_id: id
                    })
                );
            }

            if (request.landlord_id) {
                notifPromises.push(
                    notificationModel.create({
                        user_id: request.landlord_id,
                        type: 'maintenance_assigned',
                        title: 'Technician assigned to property request',
                        message: `Administrator dispatched ${worker.full_name} for ${request.issue_title} at ${request.properties?.property_name || 'Property'}.`,
                        reference_id: id
                    })
                );
            }

            await Promise.allSettled(notifPromises);

            return responseHelper.success(res, 'Technician dispatched successfully by Administrator.', updated);
        } catch (error) {
            console.error('Admin dispatch error:', error);
            return responseHelper.error(res, 'Failed to dispatch technician.', error, 500);
        }
    },

    // ── Admin: Validate legal liability & quotation (Civil Code Art. 1654 / 1657) ──
    async adminValidateLiability(req, res) {
        try {
            const { id } = req.params;
            const { liability_party, liability_basis, labor_cost, material_cost, admin_notes } = req.body;
            const adminId = req.user.id;

            if (!['landlord', 'tenant', 'shared'].includes(liability_party)) {
                return responseHelper.error(res, 'Liability party must be landlord, tenant, or shared.');
            }

            const request = await maintenanceModel.findRequestDetails(id);
            if (!request) {
                return responseHelper.error(res, 'Maintenance request not found.', null, 404);
            }

            // Guard: No liability decision before technician inspection
            const hasInspection = request.status === 'inspection_submitted' ||
                                  Boolean(request.problem_found) ||
                                  Boolean(request.before_photo_url) ||
                                  Boolean(request.recommendations && request.recommendations.includes('[TECH_FINDINGS:'));
            if (!hasInspection) {
                return responseHelper.error(
                    res,
                    'Neutral arbitration requires on-site inspection findings. Technician must submit an inspection report before Admin can determine legal liability.'
                );
            }

            const parsedLabor = Number(labor_cost) || Number(request.labor_cost) || 0;
            const parsedMaterial = Number(material_cost) || Number(request.material_cost) || 0;
            const total = parsedLabor + parsedMaterial;

            const basisTag = liability_basis ? liability_basis.toUpperCase() : (liability_party === 'landlord' ? 'ART_1654_WEAR_AND_TEAR' : 'ART_1657_NEGLIGENCE');
            const isLandlordInitiated = (request.recommendations || '').includes('[INITIATED_BY:LANDLORD]');
            const initTag = isLandlordInitiated ? '[INITIATED_BY:LANDLORD]' : '';
            const cleanRec = (request.recommendations || '')
                .replace(/\[[A-Z0-9_: ]+\]/gi, '')
                .replace(/\(Admin notes:[^)]*\)/gi, '')
                .trim();
            const quoteTag = ['completed', 'verified', 'closed'].includes(request.status) ? 'APPROVED' : 'PENDING_APPROVAL';
            const newRecommendations = `${initTag}[LIABILITY:${liability_party.toUpperCase()}][BASIS:${basisTag}][QUOTE:${quoteTag}][ADMIN_ADJUDICATED:TRUE] ${cleanRec} ${admin_notes ? `(Admin notes: ${admin_notes})` : ''}`.trim();

            let nextStatus = 'quote_pending';
            if (['completed', 'verified', 'closed'].includes(request.status)) {
                nextStatus = request.status;
            }

            const updated = await maintenanceModel.updateRequestStatus(id, {
                status: nextStatus,
                labor_cost: parsedLabor,
                material_cost: parsedMaterial,
                recommendations: newRecommendations,
                landlord_remarks: admin_notes !== undefined ? (admin_notes || null) : request.landlord_remarks
            });

            await maintenanceModel.createProgressUpdate({
                maintenance_request_id: id,
                status_update: nextStatus,
                notes: `Administrator verified liability as ${liability_party.toUpperCase()} (${basisTag.replace(/_/g, ' ')}). Total Quote: ₱${total.toFixed(2)}.`
            });

            await auditLogModel.log(adminId, 'ADMIN_VALIDATE_LIABILITY', `Admin set liability for request ${id} to ${liability_party} (${basisTag}) with total quote ₱${total}`);

            // Send notification to the liable party for quote approval
            if (liability_party === 'shared') {
                const notifications = [];
                if (request.landlord_id) {
                    notifications.push(
                        notificationModel.create({
                            user_id: request.landlord_id,
                            type: 'maintenance_quote_ready',
                            title: 'Repair quotation (50/50 Split) review',
                            message: `Shared quotation of ₱${total.toFixed(2)} is ready for ${request.issue_title} (Equitable 50/50 Split). Please review and approve the quote to proceed.`,
                            reference_id: id
                        })
                    );
                }
                if (request.tenant_id) {
                    notifications.push(
                        notificationModel.create({
                            user_id: request.tenant_id,
                            type: 'maintenance_quote_ready',
                            title: 'Repair quotation (50/50 Split) review',
                            message: `Shared quotation of ₱${total.toFixed(2)} is ready for ${request.issue_title} (Equitable 50/50 Split). Please review and approve the quote to proceed.`,
                            reference_id: id
                        })
                    );
                }
                if (notifications.length > 0) {
                    await Promise.all(notifications);
                }
            } else {
                const targetUserId = liability_party === 'tenant' ? request.tenant_id : request.landlord_id;
                const basisLabel = liability_party === 'landlord' ? 'Civil Code Art. 1654 (Wear & Tear)' : 'Civil Code Art. 1657 (Tenant Responsibility)';
                if (targetUserId) {
                    await notificationModel.create({
                        user_id: targetUserId,
                        type: 'maintenance_quote_ready',
                        title: 'Repair quotation & liability review',
                        message: `Quotation of ₱${total.toFixed(2)} is ready for ${request.issue_title} (${basisLabel}). Please review and approve the quote to proceed.`,
                        reference_id: id
                    });
                }
            }

            return responseHelper.success(res, 'Liability and quotation validated successfully.', updated);
        } catch (error) {
            console.error('Admin validate liability error:', error);
            return responseHelper.error(res, 'Failed to validate liability.', error, 500);
        }
    },

    // ── Admin: View all platform maintenance personnel ─────────────────
    async adminGetWorkers(req, res) {
        try {
            const workers = await maintenanceModel.adminGetWorkers();
            return responseHelper.success(res, 'Platform maintenance personnel retrieved successfully.', workers);
        } catch (error) {
            console.error('Admin get workers error:', error);
            return responseHelper.error(res, 'Failed to retrieve platform workers.', error, 500);
        }
    },

    // ── Admin: Register new accredited platform technician ──────────────
    async adminCreatePlatformWorker(req, res) {
        try {
            const { full_name, email, password, contact_number, specialization } = req.body;
            const adminId = req.user.id;

            if (!full_name || !email || !password) {
                return responseHelper.error(res, 'Full name, email, and initial password are required.');
            }

            // Check if email already exists
            const existing = await userModel.findByEmail(email);
            if (existing) {
                return responseHelper.error(res, 'A user with this email address is already registered.');
            }

            const saltRounds = 12;
            const password_hash = await bcrypt.hash(password, saltRounds);
            const displayName = specialization ? `${full_name.trim()} (${specialization.trim()})` : full_name.trim();

            const newWorker = await userModel.createUser({
                full_name: displayName,
                email: email.trim().toLowerCase(),
                password_hash,
                contact_number: contact_number ? contact_number.trim() : null,
                role: 'maintenance',
                is_verified: true,
                account_status: 'active'
            });

            if (maintenanceComplianceService && typeof maintenanceComplianceService.initStaffRecords === 'function') {
                await maintenanceComplianceService.initStaffRecords(newWorker.id, {
                    department: specialization ? `${specialization.trim()} Department` : 'General Maintenance',
                    trade: specialization,
                    service_area: 'Global / All Properties',
                    created_by: adminId
                }).catch(() => {});
            }
            if (specialization && maintenancePersonnelModel && typeof maintenancePersonnelModel.syncSkills === 'function') {
                await maintenancePersonnelModel.syncSkills(newWorker.id, [specialization.trim()]).catch(() => {});
            }

            await maintenanceModel.ensureWorkerAccreditation(newWorker.id);
            await auditLogModel.log(adminId, 'ADMIN_CREATE_WORKER', `Admin registered platform technician ${displayName} (${email})`);
            return responseHelper.success(res, 'Platform maintenance personnel registered successfully.', {
                id: newWorker.id,
                full_name: newWorker.full_name,
                email: newWorker.email,
                contact_number: newWorker.contact_number,
                role: newWorker.role,
                created_at: newWorker.created_at
            }, 201);
        } catch (error) {
            console.error('Admin create worker error:', error);
            return responseHelper.error(res, 'Failed to register platform technician.', error, 500);
        }
    },

    // ── Technician: Submit on-site diagnostic inspection & quotation ────
    async workerSubmitInspection(req, res) {
        try {
            const { id } = req.params;
            const { 
                problem_found, recommendations, 
                labor_cost, materials, // array of { material_name, quantity, cost }
                liability_recommendation, // 'landlord' | 'tenant'
                liability_basis, // 'art_1654_wear_and_tear' | 'art_1657_negligence'
                before_base64, before_filename, before_mimetype 
            } = req.body;
            const workerId = req.user.id;

            if (!problem_found) {
                return responseHelper.error(res, 'Diagnostic findings (problem found) are required.');
            }

            const request = await maintenanceModel.findRequestDetails(id);
            if (!request || request.assigned_maintenance_id !== workerId) {
                return responseHelper.error(res, 'Request not found or access denied.', null, 404);
            }

            // Upload before photo if provided
            let beforePhotoUrl = request.before_photo_url || null;
            if (before_base64 && before_filename && before_mimetype) {
                const uniqueName = `${Date.now()}-inspect-${before_filename}`;
                const storagePath = `maintenance_reports/${id}/${uniqueName}`;
                const uploadResult = await uploadFile('maintenance-images', storagePath, before_base64, before_mimetype);
                beforePhotoUrl = uploadResult.url;
            }

            // Save itemized materials if provided
            let materialTotal = 0;
            if (Array.isArray(materials) && materials.length > 0) {
                await maintenanceModel.deleteRequestMaterials(id);
                for (const mat of materials) {
                    const q = Number(mat.quantity) || 1;
                    const c = Number(mat.cost) || 0;
                    materialTotal += (q * c);
                    await maintenanceModel.addMaterial({
                        maintenance_request_id: id,
                        material_name: mat.material_name.trim(),
                        quantity: q,
                        cost: c
                    });
                }
            }

            const parsedLabor = Number(labor_cost) || 0;
            const chosenParty = ['landlord', 'tenant'].includes(liability_recommendation) ? liability_recommendation.toUpperCase() : 'LANDLORD';
            const chosenBasis = liability_basis ? liability_basis.toUpperCase() : (chosenParty === 'LANDLORD' ? 'ART_1654_WEAR_AND_TEAR' : 'ART_1657_NEGLIGENCE');

            const isLandlordInitiated = (request.recommendations || '').includes('[INITIATED_BY:LANDLORD]');
            const initTag = isLandlordInitiated ? '[INITIATED_BY:LANDLORD]' : '';
            const taggedRecommendations = `${initTag}[TECH_FINDINGS:${problem_found}][TECH_RECOMMENDED_LIABILITY:${chosenParty}][TECH_BASIS:${chosenBasis}][LIABILITY:PENDING_ADMIN_DETERMINATION][QUOTE:PENDING_ADMIN_VALIDATION] ${recommendations || ''}`.trim();

            const nextStatus = 'inspection_submitted';

            const updated = await maintenanceModel.updateRequestStatus(id, {
                status: nextStatus,
                problem_found,
                recommendations: taggedRecommendations,
                before_photo_url: beforePhotoUrl,
                labor_cost: parsedLabor,
                material_cost: materialTotal
            });

            await maintenanceModel.createProgressUpdate({
                maintenance_request_id: id,
                status_update: nextStatus,
                notes: `Technician submitted diagnostic assessment. Findings: ${problem_found}. Proposed liability: ${chosenParty} (${chosenBasis}). Quote: ₱${(parsedLabor + materialTotal).toFixed(2)}.`
            });

            await auditLogModel.log(workerId, 'WORKER_SUBMIT_INSPECTION', `Technician submitted diagnostic inspection for request ${id}`);

            // Notify Landlord & Admin
            const notifs = [
                notificationModel.create({
                    user_id: request.landlord_id,
                    type: 'maintenance_quote_ready',
                    title: 'Maintenance inspection completed',
                    message: `Technician completed diagnostic for ${request.issue_title}. Assessment is available for review.`,
                    reference_id: id
                })
            ];

            const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin');
            if (admins && admins.length > 0) {
                for (const adm of admins) {
                    notifs.push(notificationModel.create({
                        user_id: adm.id,
                        type: 'maintenance_inspection_submitted',
                        title: 'Diagnostic Inspection Awaiting Liability Ruling',
                        message: `Technician submitted inspection for ${request.issue_title}. Impartial legal liability ruling required.`,
                        reference_id: id
                    }));
                }
            }
            await Promise.allSettled(notifs);

            return responseHelper.success(res, 'Diagnostic inspection & quotation submitted successfully.', updated);
        } catch (error) {
            console.error('Worker submit inspection error:', error);
            return responseHelper.error(res, 'Failed to submit inspection report.', error, 500);
        }
    },

    // ── Liable Party (Landlord / Tenant): Approve or Dispute Quotation ──
    async partyDecideQuote(req, res) {
        try {
            const { id } = req.params;
            const { decision, remarks } = req.body; // 'approve' | 'dispute'
            const userId = req.user.id;

            if (!['approve', 'dispute'].includes(decision)) {
                return responseHelper.error(res, 'Decision must be either approve or dispute.');
            }

            const request = await maintenanceModel.findRequestDetails(id);
            if (!request) {
                return responseHelper.error(res, 'Maintenance request not found.', null, 404);
            }

            const meta = getRequestMeta(request);
            const isAuthorized = userId === request.landlord_id || userId === request.tenant_id || req.user.role === 'admin';
            if (!isAuthorized) {
                return responseHelper.error(res, 'You are not authorized to decide on this repair quotation.', null, 403);
            }

            let newStatus = request.status;
            let note = '';
            let newRec = request.recommendations || '';

            const userRole = (req.user.role || (userId === request.landlord_id ? 'landlord' : (userId === request.tenant_id ? 'tenant' : 'admin'))).toUpperCase();
            if (decision === 'approve') {
                newStatus = 'quote_approved';
                newRec = newRec.replace(/\[QUOTE:[A-Z_]+\]/i, '[QUOTE:APPROVED]');
                note = `${userRole} approved the repair quotation of ₱${(meta.total_cost || 0).toFixed(2)}. Technician is authorized to begin repairs.`;
            } else {
                newStatus = 'quote_pending';
                newRec = newRec.replace(/\[QUOTE:[A-Z_]+\]/i, '[QUOTE:DISPUTED]');
                note = `${userRole} disputed the quotation. Remarks: ${remarks || 'None'}`;
            }

            const updated = await maintenanceModel.updateRequestStatus(id, {
                status: newStatus,
                recommendations: newRec,
                rejection_reason: decision === 'dispute' ? remarks : request.rejection_reason
            });

            await maintenanceModel.createProgressUpdate({
                maintenance_request_id: id,
                status_update: newStatus,
                notes: note
            });

            await auditLogModel.log(userId, 'MAINTENANCE_QUOTE_DECISION', `User ${userId} decided ${decision} for maintenance quote ${id}`);

            // Notify technician if approved
            if (decision === 'approve' && request.assigned_maintenance_id) {
                await notificationModel.create({
                    user_id: request.assigned_maintenance_id,
                    type: 'maintenance_quote_approved',
                    title: 'Quotation approved - Proceed with repair',
                    message: `Repair quotation for ${request.issue_title} has been approved. You may now commence repair work.`,
                    reference_id: id
                });
            }

            return responseHelper.success(res, `Quotation has been successfully ${decision === 'approve' ? 'approved' : 'marked as disputed'}.`, updated);
        } catch (error) {
            console.error('Party decide quote error:', error);
            return responseHelper.error(res, 'Failed to process quotation decision.', error, 500);
        }
    },

    // ── In-System Maintenance Payment / Billing Statement Settlement ───
    async partyPayMaintenance(req, res) {
        try {
            const { id } = req.params;
            const { payment_method, reference_number, amount, paid_by, base64_content, file_name, mime_type } = req.body;
            const userId = req.user.id;

            const request = await maintenanceModel.findRequestDetails(id);
            if (!request) {
                return responseHelper.error(res, 'Maintenance request not found.', null, 404);
            }

            if (!reference_number || !reference_number.trim()) {
                return responseHelper.error(res, 'Transaction reference number is required.');
            }

            let proofUrl = null;
            if (base64_content && file_name && mime_type) {
                const safeName = String(file_name).replace(/[^a-zA-Z0-9._-]/g, '_');
                const uniqueName = `pay-${Date.now()}-${safeName}`;
                const storagePath = `maintenance-payments/${id}/${uniqueName}`;
                try {
                    const uploadResult = await uploadFile('maintenance-images', storagePath, base64_content, mime_type);
                    if (uploadResult && uploadResult.url) {
                        proofUrl = uploadResult.url;
                    }
                } catch (uploadErr) {
                    console.warn('Payment proof upload warning:', uploadErr.message);
                }
            }

            const meta = getRequestMeta(request);
            const payerRole = paid_by || (userId === request.tenant_id ? 'tenant' : 'landlord');
            const payAmount = Number(amount) || meta.total_cost;
            const cleanRec = (request.recommendations || '')
                .replace(/\[PAYMENT:[A-Z_]+\]/gi, '')
                .replace(/\[PAID_BY:[A-Z_]+\]/gi, '')
                .replace(/\[METHOD:[^\]]+\]/gi, '')
                .replace(/\[REF:[^\]]+\]/gi, '')
                .replace(/\[PROOF_URL:[^\]]+\]/gi, '')
                .replace(/\[PAY_AMOUNT:[0-9.]+\]/gi, '')
                .replace(/\[REJECTION_REASON:[^\]]+\]/gi, '')
                .trim();
            const proofTag = proofUrl ? `[PROOF_URL:${proofUrl}]` : '';
            const newRec = `${cleanRec} [PAYMENT:WAITING_VERIFICATION][PAID_BY:${payerRole.toUpperCase()}][METHOD:${(payment_method || 'SYSTEM').toUpperCase()}][REF:${reference_number.trim()}][PAY_AMOUNT:${payAmount}]${proofTag}`.trim();

            const updated = await maintenanceModel.updateRequestStatus(id, {
                recommendations: newRec
            });

            await maintenanceModel.createProgressUpdate({
                maintenance_request_id: id,
                status_update: request.status,
                notes: `Maintenance payment of ₱${payAmount.toFixed(2)} submitted via ${payment_method || 'System'} (Ref: ${reference_number.trim()}) by ${payerRole.toUpperCase()}. Awaiting Administrator verification.${proofUrl ? ' Receipt proof attached.' : ''}`
            });

            await auditLogModel.log(userId, 'SUBMIT_MAINTENANCE_PAYMENT', `Submitted maintenance fee ₱${payAmount} for request ${id} via ${payment_method} (Ref: ${reference_number.trim()})`);

            return responseHelper.success(res, 'Payment submitted successfully. Awaiting Administrator verification.', updated);
        } catch (error) {
            console.error('Party pay maintenance error:', error);
            return responseHelper.error(res, 'Failed to record maintenance payment.', error, 500);
        }
    },

    // ── Admin: List Maintenance Payments ──────────────────────────────────
    async adminGetMaintenancePayments(req, res) {
        try {
            const list = await maintenanceModel.findMaintenancePayments();
            return responseHelper.success(res, 'Maintenance payments retrieved.', list);
        } catch (error) {
            console.error('Admin get maintenance payments error:', error);
            return responseHelper.error(res, 'Failed to fetch maintenance payments.', error, 500);
        }
    },

    // ── Admin: Verify Maintenance Payment ─────────────────────────────────
    async adminVerifyMaintenancePayment(req, res) {
        try {
            const { id } = req.params;
            const adminId = req.user.id;
            const request = await maintenanceModel.findRequestDetails(id);
            if (!request) {
                return responseHelper.error(res, 'Maintenance request not found.', null, 404);
            }

            const meta = getRequestMeta(request);
            const cleanRec = (request.recommendations || '')
                .replace(/\[PAYMENT:[A-Z_]+\]/gi, '')
                .replace(/\[VERIFIED_BY:[^\]]+\]/gi, '')
                .replace(/\[VERIFIED_AT:[^\]]+\]/gi, '')
                .replace(/\[REJECTION_REASON:[^\]]+\]/gi, '')
                .replace(/\[REJECTED_BY:[^\]]+\]/gi, '')
                .replace(/\[REJECTED_AT:[^\]]+\]/gi, '')
                .trim();
            const newRec = `${cleanRec} [PAYMENT:VERIFIED][VERIFIED_BY:ADMIN][VERIFIED_AT:${new Date().toISOString()}]`.trim();
            let targetStatus = request.status;
            if (request.status === 'verified') {
                targetStatus = 'closed';
            }

            const updated = await maintenanceModel.updateRequestStatus(id, {
                status: targetStatus,
                recommendations: newRec
            });

            const payAmount = Number(meta.payment_amount || meta.total_cost || 0);

            await maintenanceModel.createProgressUpdate({
                maintenance_request_id: id,
                status_update: targetStatus,
                notes: `Maintenance payment of ₱${payAmount.toFixed(2)} was verified and confirmed by Administrator.${targetStatus === 'closed' ? ' Work order has been successfully settled and closed.' : ''}`
            });

            await auditLogModel.log(adminId, 'VERIFY_MAINTENANCE_PAYMENT', `Verified maintenance payment ₱${payAmount} for request ${id}`);

            // Notifications to parties
            if (request.tenant_id) {
                await notificationModel.create({
                    user_id: request.tenant_id,
                    title: 'Maintenance Payment Verified',
                    message: `Payment of ₱${payAmount.toFixed(2)} for maintenance ticket "${request.issue_title}" has been verified by Administrator.`,
                    type: 'maintenance',
                    reference_id: id
                }).catch(() => {});
            }
            if (request.landlord_id && request.landlord_id !== request.tenant_id) {
                await notificationModel.create({
                    user_id: request.landlord_id,
                    title: 'Maintenance Payment Verified',
                    message: `Payment of ₱${payAmount.toFixed(2)} for maintenance ticket "${request.issue_title}" has been verified by Administrator.`,
                    type: 'maintenance',
                    reference_id: id
                }).catch(() => {});
            }

            return responseHelper.success(res, 'Maintenance payment verified successfully.', updated);
        } catch (error) {
            console.error('Admin verify maintenance payment error:', error);
            return responseHelper.error(res, 'Failed to verify maintenance payment.', error, 500);
        }
    },

    // ── Admin: Reject Maintenance Payment ──────────────────────────────────
    async adminRejectMaintenancePayment(req, res) {
        try {
            const { id } = req.params;
            const reason = req.body.reason || req.body.rejection_reason;
            const adminId = req.user.id;

            if (!reason || !reason.trim()) {
                return responseHelper.error(res, 'Rejection reason is required.');
            }

            const request = await maintenanceModel.findRequestDetails(id);
            if (!request) {
                return responseHelper.error(res, 'Maintenance request not found.', null, 404);
            }

            const meta = getRequestMeta(request);
            const safeReason = reason.trim().replace(/[\[\]]/g, '');
            const cleanRec = (request.recommendations || '')
                .replace(/\[PAYMENT:[A-Z_]+\]/gi, '')
                .replace(/\[VERIFIED_BY:[^\]]+\]/gi, '')
                .replace(/\[VERIFIED_AT:[^\]]+\]/gi, '')
                .replace(/\[REJECTION_REASON:[^\]]+\]/gi, '')
                .replace(/\[REJECTED_BY:[^\]]+\]/gi, '')
                .replace(/\[REJECTED_AT:[^\]]+\]/gi, '')
                .trim();
            const newRec = `${cleanRec} [PAYMENT:REJECTED][REJECTION_REASON:${safeReason}][REJECTED_BY:ADMIN][REJECTED_AT:${new Date().toISOString()}]`.trim();

            const updated = await maintenanceModel.updateRequestStatus(id, {
                recommendations: newRec
            });

            await maintenanceModel.createProgressUpdate({
                maintenance_request_id: id,
                status_update: request.status,
                notes: `Maintenance payment proof was rejected by Administrator. Reason: ${safeReason}. Payer requested to re-submit.`
            });

            await auditLogModel.log(adminId, 'REJECT_MAINTENANCE_PAYMENT', `Rejected maintenance payment for request ${id}. Reason: ${safeReason}`);

            const targetId = meta.paid_by === 'tenant' ? request.tenant_id : request.landlord_id;
            if (targetId) {
                await notificationModel.create({
                    user_id: targetId,
                    title: 'Maintenance Payment Proof Rejected',
                    message: `Payment proof for "${request.issue_title}" was rejected: ${safeReason}. Please re-submit valid payment details.`,
                    type: 'maintenance',
                    reference_id: id
                }).catch(() => {});
            }

            return responseHelper.success(res, 'Maintenance payment proof rejected.', updated);
        } catch (error) {
            console.error('Admin reject maintenance payment error:', error);
            return responseHelper.error(res, 'Failed to reject maintenance payment.', error, 500);
        }
    }
};

module.exports = maintenanceController;
