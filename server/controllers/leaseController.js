const leaseModel = require('../models/leaseModel');
const landlordModel = require('../models/landlordModel');
const userModel = require('../models/userModel');
const auditLogModel = require('../models/auditLogModel');
const notificationModel = require('../models/notificationModel');
const responseHelper = require('../utils/responseHelper');
const cache = require('../utils/cacheHelper');

// Cache TTLs (seconds)
const TTL = {
    leases: 120,      // Lease list – 2 min
    leaseDetail: 180  // Single lease – 3 min
};

const leaseController = {
    async createLease(req, res) {
        try {
            const { 
                application_id, lease_start_date, lease_end_date, 
                monthly_rent, security_deposit, advance_payment, payment_due_day,
                utilities_covered, utilities_config, utilities_other, max_occupants, pet_policy,
                pet_conditions, smoking_policy, parking_policy, parking_slot_number,
                house_rules, landlord_responsibilities, tenant_responsibilities,
                late_fee_amount, grace_period, termination_policy, additional_terms
            } = req.body;
            
            const landlordId = req.user.id;

            // 1. Validate inputs
            if (!application_id || !lease_start_date || !lease_end_date || !monthly_rent || security_deposit === undefined || advance_payment === undefined || !payment_due_day) {
                return responseHelper.error(res, 'Application ID, lease start/end dates, monthly rent, security deposit, advance payment, and due day are required.');
            }

            const parsedDueDay = parseInt(payment_due_day);
            if (isNaN(parsedDueDay) || parsedDueDay < 1 || parsedDueDay > 28) {
                return responseHelper.error(res, 'Payment due day must be between 1 and 28.');
            }

            // 2. Fetch application details to check landlord ownership and approved status
            const application = await landlordModel.findApplicationDetails(application_id, landlordId);
            if (!application) {
                return responseHelper.error(res, 'Tenant application not found or unauthorized access.', null, 404);
            }

            if (application.status !== 'approved') {
                return responseHelper.error(res, 'Leases can only be established from approved tenant applications.');
            }

            // 3. Check if lease already exists
            const existingLease = await leaseModel.findLeaseByApplicationId(application_id);
            if (existingLease) {
                if (existingLease.lease_status === 'rejected') {
                    return responseHelper.error(res, 'A lease contract already exists for this application but was rejected. Please edit the existing lease contract in the directory instead.');
                }
                return responseHelper.error(res, 'A lease agreement has already been created for this tenant application.');
            }

            // 4. Get Landlord User Details for signature
            const landlordUser = await userModel.findById(landlordId);
            if (!landlordUser) {
                return responseHelper.error(res, 'Landlord user profile not found.', null, 404);
            }

            // 5. Auto-generate lease number format LSE-YYYYMMDD-XXXX
            const today = new Date();
            const yyyymmdd = today.toISOString().slice(0, 10).replace(/-/g, '');
            const randomNum = Math.floor(1000 + Math.random() * 9000);
            const lease_number = `LSE-${yyyymmdd}-${randomNum}`;

            // 6. Create lease
            const lease = await leaseModel.createLease({
                application_id,
                tenant_id: application.tenant_id,
                landlord_id: landlordId,
                property_id: application.property_id,
                unit_id: application.unit_id || null,
                bed_id: application.bed_id || null,
                lease_start_date,
                lease_end_date,
                monthly_rent: parseFloat(monthly_rent),
                security_deposit: parseFloat(security_deposit),
                advance_payment: parseFloat(advance_payment),
                payment_due_day: parsedDueDay,
                utilities_covered: utilities_config || (Array.isArray(utilities_covered) ? utilities_covered : utilities_covered || {}),
                utilities_other: utilities_other || '',
                max_occupants: parseInt(max_occupants) || 1,
                pet_policy: pet_policy || 'Not Allowed',
                pet_conditions: pet_conditions || '',
                smoking_policy: smoking_policy || 'Not Allowed',
                parking_policy: parking_policy || 'Not Included',
                parking_slot_number: parking_slot_number || '',
                house_rules: house_rules || '',
                landlord_responsibilities: landlord_responsibilities || '',
                tenant_responsibilities: tenant_responsibilities || '',
                late_fee_amount: late_fee_amount || '',
                grace_period: parseInt(grace_period) || 0,
                termination_policy: termination_policy || '',
                additional_terms: additional_terms || '',
                lease_number,
                lease_status: 'pending_tenant_acceptance',
                landlord_signature_name: landlordUser.full_name,
                landlord_signature_date: new Date()
            });

            // 7. Audit log
            await auditLogModel.log(landlordId, 'CREATE_LEASE', `Landlord created lease agreement ${lease.lease_number} for application ${application_id}`);

            // Dispatch notification to tenant
            if (application.tenant_id) {
                await notificationModel.create({
                    user_id: application.tenant_id,
                    type: 'lease_created',
                    title: 'New Digital Lease Agreement Prepared 📄',
                    message: `Landlord has issued a digital lease contract (${lease.lease_number}) for property "${application.property_name || 'your unit'}". Please review and sign.`,
                    reference_id: lease.id
                });
            }

            // Invalidate the leases list so the new record appears on next fetch
            cache.invalidateLandlord(landlordId, 'leases');

            return responseHelper.success(res, 'Lease agreement drafted successfully and sent to tenant for review.', lease, 201);

        } catch (error) {
            console.error('Create lease error:', error);
            return responseHelper.error(res, 'Failed to create lease agreement', error, 500);
        }
    },

    async updateLeaseDetails(req, res) {
        try {
            const { id } = req.params;
            const { 
                lease_start_date, lease_end_date, 
                monthly_rent, security_deposit, advance_payment, payment_due_day,
                utilities_covered, utilities_config, utilities_other, max_occupants, pet_policy,
                pet_conditions, smoking_policy, parking_policy, parking_slot_number,
                house_rules, landlord_responsibilities, tenant_responsibilities,
                late_fee_amount, grace_period, termination_policy, additional_terms
            } = req.body;
            
            const landlordId = req.user.id;

            // 1. Validate inputs
            if (!lease_start_date || !lease_end_date || !monthly_rent || security_deposit === undefined || advance_payment === undefined || !payment_due_day) {
                return responseHelper.error(res, 'Lease start/end dates, monthly rent, security deposit, advance payment, and due day are required.');
            }

            const parsedDueDay = parseInt(payment_due_day);
            if (isNaN(parsedDueDay) || parsedDueDay < 1 || parsedDueDay > 28) {
                return responseHelper.error(res, 'Payment due day must be between 1 and 28.');
            }

            // 2. Fetch landlord user details for resubmission signature
            const landlordUser = await userModel.findById(landlordId);
            if (!landlordUser) {
                return responseHelper.error(res, 'Landlord user profile not found.', null, 404);
            }

            // 3. Update lease
            const updated = await leaseModel.updateLease(id, landlordId, {
                lease_start_date,
                lease_end_date,
                monthly_rent: parseFloat(monthly_rent),
                security_deposit: parseFloat(security_deposit),
                advance_payment: parseFloat(advance_payment),
                payment_due_day: parsedDueDay,
                utilities_covered: utilities_config || (Array.isArray(utilities_covered) ? utilities_covered : utilities_covered || {}),
                utilities_other: utilities_other || '',
                max_occupants: parseInt(max_occupants) || 1,
                pet_policy: pet_policy || 'Not Allowed',
                pet_conditions: pet_conditions || '',
                smoking_policy: smoking_policy || 'Not Allowed',
                parking_policy: parking_policy || 'Not Included',
                parking_slot_number: parking_slot_number || '',
                house_rules: house_rules || '',
                landlord_responsibilities: landlord_responsibilities || '',
                tenant_responsibilities: tenant_responsibilities || '',
                late_fee_amount: late_fee_amount || '',
                grace_period: parseInt(grace_period) || 0,
                termination_policy: termination_policy || '',
                additional_terms: additional_terms || '',
                lease_status: 'pending_tenant_acceptance', // Reset status to pending when modified
                landlord_signature_name: landlordUser.full_name,
                landlord_signature_date: new Date(),
                tenant_signature_name: null, // Clear any previous tenant signatures/rejections
                tenant_signature_date: null
            });

            if (!updated) {
                return responseHelper.error(res, 'Lease agreement not found, or you are unauthorized to edit it.', null, 404);
            }

            // Audit log
            await auditLogModel.log(landlordId, 'UPDATE_LEASE_DETAILS', `Landlord updated and re-submitted lease agreement ${updated.lease_number || id}`);

            // Invalidate lease list and specific lease detail
            cache.del(cache.landlordKey(landlordId, 'leases', id));
            cache.del(cache.landlordKey(landlordId, 'leases'));

            return responseHelper.success(res, 'Lease agreement successfully updated and re-sent to tenant.', updated);

        } catch (error) {
            console.error('Update lease details error:', error);
            return responseHelper.error(res, error.message || 'Failed to update lease details', error, 500);
        }
    },

    async getLeaseById(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const userRole = req.user.role;

            // Only cache landlord reads – tenants are handled separately
            const cacheKey = userRole === 'landlord'
                ? cache.landlordKey(userId, 'leases', id)
                : null;

            if (cacheKey) {
                const cached = cache.get(cacheKey);
                if (cached) {
                    return responseHelper.success(res, 'Lease agreement details retrieved.', cached);
                }
            }

            const lease = await leaseModel.findLeaseById(id);
            if (!lease) {
                return responseHelper.error(res, 'Lease agreement not found.', null, 404);
            }

            // Enforce role-based access control
            if (userRole === 'landlord' && lease.landlord_id !== userId) {
                return responseHelper.error(res, 'Access denied to this lease record.', null, 403);
            }
            if (userRole === 'tenant' && lease.tenant_id !== userId) {
                return responseHelper.error(res, 'Access denied to this lease record.', null, 403);
            }

            if (cacheKey) cache.set(cacheKey, lease, TTL.leaseDetail);
            return responseHelper.success(res, 'Lease agreement details retrieved.', lease);
        } catch (error) {
            console.error('Get lease by ID error:', error);
            return responseHelper.error(res, 'Failed to fetch lease details', error, 500);
        }
    },

    async getLandlordLeases(req, res) {
        try {
            const userId = req.user.id;
            const cacheKey = cache.landlordKey(userId, 'leases');
            const cached = cache.get(cacheKey);
            if (cached) {
                return responseHelper.success(res, 'Landlord lease directory retrieved', cached);
            }

            const list = await leaseModel.findByLandlordId(userId);
            cache.set(cacheKey, list, TTL.leases);
            return responseHelper.success(res, 'Landlord lease directory retrieved', list);
        } catch (error) {
            console.error('Get landlord leases error:', error);
            return responseHelper.error(res, 'Failed to fetch lease records', error, 500);
        }
    },

    async getTenantLeases(req, res) {
        try {
            const list = await leaseModel.findByTenantId(req.user.id);
            return responseHelper.success(res, 'Tenant lease agreements retrieved', list);
        } catch (error) {
            console.error('Get tenant leases error:', error);
            return responseHelper.error(res, 'Failed to fetch lease records', error, 500);
        }
    },

    async acceptLease(req, res) {
        try {
            const { id } = req.params;
            const { signature_name } = req.body;
            const tenantId = req.user.id;

            if (!signature_name || signature_name.trim() === '') {
                return responseHelper.error(res, 'Electronic signature name is required to accept the lease agreement.');
            }

            // Verify tenant name from database
            const tenantUser = await userModel.findById(tenantId);
            if (!tenantUser) {
                return responseHelper.error(res, 'Tenant user profile not found.', null, 404);
            }

            const acceptedLease = await leaseModel.acceptLease(id, tenantId, signature_name.trim());
            if (!acceptedLease) {
                return responseHelper.error(res, 'Lease record not found or access denied.', null, 404);
            }

            // Dispatch notification to landlord
            if (acceptedLease.landlord_id) {
                await notificationModel.create({
                    user_id: acceptedLease.landlord_id,
                    type: 'lease_signed',
                    title: 'Lease Contract Signed 🖊️',
                    message: `Tenant ${tenantUser.full_name || 'Tenant'} has electronically signed the lease agreement (${acceptedLease.lease_number}).`,
                    reference_id: id
                });
            }

            // Sync occupancy status
            const supabase = require('../config/supabaseClient');
            if (acceptedLease.bed_id) {
                await supabase
                    .from('unit_beds')
                    .update({ status: 'occupied' })
                    .eq('id', acceptedLease.bed_id);
                
                if (acceptedLease.unit_id) {
                    const { data: allBeds } = await supabase
                        .from('unit_beds')
                        .select('status')
                        .eq('unit_id', acceptedLease.unit_id);
                    
                    if (allBeds && allBeds.length > 0) {
                        const allFilled = allBeds.every(b => b.status === 'occupied' || b.status === 'reserved');
                        if (allFilled) {
                            await supabase
                                .from('property_units')
                                .update({ status: 'occupied' })
                                .eq('id', acceptedLease.unit_id);
                        }
                    }
                }
            } else if (acceptedLease.unit_id) {
                await supabase
                    .from('property_units')
                    .update({ status: 'occupied' })
                    .eq('id', acceptedLease.unit_id);
            }

            // Auto-generate Initial Move-In Billing Statement for tenant
            try {
                const billingModel = require('../models/billingModel');
                const leaseStartDt = new Date(acceptedLease.lease_start_date || new Date());
                const monthStr = leaseStartDt.toISOString().slice(0, 7);
                const initMonth = `${monthStr} (Move-In)`;

                // Check if initial billing already exists for this lease
                const { data: existingInits } = await supabase
                    .from('billing_records')
                    .select('id')
                    .eq('lease_id', acceptedLease.id)
                    .limit(1);

                const existingInit = existingInits && existingInits.length > 0 ? existingInits[0] : null;

                if (!existingInit) {
                    const rentAmt = parseFloat(acceptedLease.monthly_rent || 0);
                    const secDep  = parseFloat(acceptedLease.security_deposit || 0);
                    const advPay  = parseFloat(acceptedLease.advance_payment || 0);
                    const totalAmt = rentAmt + secDep + advPay;

                    await billingModel.createBilling({
                        lease_id: acceptedLease.id,
                        tenant_id: acceptedLease.tenant_id,
                        landlord_id: acceptedLease.landlord_id,
                        property_id: acceptedLease.property_id,
                        billing_month: initMonth,
                        rent_amount: rentAmt,
                        utility_amount: 0,
                        water: 0,
                        electricity: 0,
                        internet: 0,
                        parking: 0,
                        other_charges: secDep + advPay,
                        penalty_amount: 0,
                        total_amount: totalAmt,
                        due_date: acceptedLease.lease_start_date || new Date().toISOString().slice(0, 10),
                        billing_status: 'pending_payment',
                        remarks: `Initial Move-In Billing: Monthly Rent (₱${rentAmt.toLocaleString()}) + Security Deposit (₱${secDep.toLocaleString()}) + Advance Payment (₱${advPay.toLocaleString()})`
                    });
                }
            } catch (billErr) {
                console.error('Auto-generate initial billing error:', billErr);
            }

            await auditLogModel.log(tenantId, 'ACCEPT_LEASE', `Tenant accepted lease agreement ${acceptedLease.lease_number || id}`);

            // Invalidate landlord's leases, billings, and units cache
            cache.del(cache.landlordKey(acceptedLease.landlord_id, 'leases', id));
            cache.invalidateLandlord(acceptedLease.landlord_id, 'leases');
            cache.invalidateLandlord(acceptedLease.landlord_id, 'billings');
            if (acceptedLease.property_id) {
                cache.invalidatePrefix(`units:property:${acceptedLease.property_id}`);
            }

            return responseHelper.success(res, 'Lease agreement accepted successfully. Status is now ACTIVE.', acceptedLease);

        } catch (error) {
            console.error('Accept lease error:', error);
            return responseHelper.error(res, error.message || 'Failed to accept lease agreement', error, 500);
        }
    },

    async rejectLease(req, res) {
        try {
            const { id } = req.params;
            const { signature_name, tenant_notes, rejection_reason } = req.body;
            const tenantId = req.user.id;

            const notesText = tenant_notes || rejection_reason || req.body.reason || '';

            const rejectedLease = await leaseModel.rejectLease(id, tenantId, signature_name || 'Rejected with concerns', notesText);
            if (!rejectedLease) {
                return responseHelper.error(res, 'Lease record not found or access denied.', null, 404);
            }

            await auditLogModel.log(tenantId, 'REJECT_LEASE', `Tenant rejected lease agreement ${rejectedLease.lease_number || id} with concern notes`);

            // Invalidate landlord's leases cache
            cache.del(cache.landlordKey(rejectedLease.landlord_id, 'leases', id));
            cache.invalidateLandlord(rejectedLease.landlord_id, 'leases');

            return responseHelper.success(res, 'Lease agreement returned to landlord with your concern notes for review and adjustments.', rejectedLease);

        } catch (error) {
            console.error('Reject lease error:', error);
            return responseHelper.error(res, error.message || 'Failed to reject lease agreement', error, 500);
        }
    },
    async respondLease(req, res) {
        const { action } = req.body;
        if (!['accept', 'reject'].includes(action)) {
            return responseHelper.error(res, 'Action must be either accept or reject.');
        }
        if (action === 'accept') {
            return leaseController.acceptLease(req, res);
        }
        return leaseController.rejectLease(req, res);
    },

    async updateLeaseStatus(req, res) {
        try {
            const { id } = req.params;
            const { lease_status } = req.body;
            const landlordId = req.user.id;

            // Tenant acceptance/rejection is handled exclusively by the tenant
            // endpoints. Landlords may only close a draft/active lease or
            // finalize a legacy accepted record.
            const allowedStatuses = ['active', 'expired', 'terminated', 'ended', 'cancelled'];
            if (!allowedStatuses.includes(lease_status)) {
                return responseHelper.error(res, 'Invalid lease status.');
            }

            const updated = await leaseModel.updateLeaseStatus(id, landlordId, lease_status);
            if (!updated) {
                return responseHelper.error(res, 'Lease record not found or access denied.', null, 404);
            }

            // If the status changed to inactive, free the bed/unit
            const inactiveStatuses = ['expired', 'terminated', 'ended', 'cancelled'];
            if (inactiveStatuses.includes(lease_status)) {
                const supabase = require('../config/supabaseClient');
                if (updated.bed_id) {
                    await supabase
                        .from('unit_beds')
                        .update({ status: 'available' })
                        .eq('id', updated.bed_id);
                    
                    // Also make sure parent room is available if it was marked occupied
                    if (updated.unit_id) {
                        await supabase
                            .from('property_units')
                            .update({ status: 'available' })
                            .eq('id', updated.unit_id);
                    }
                } else if (updated.unit_id) {
                    await supabase
                        .from('property_units')
                        .update({ status: 'available' })
                        .eq('id', updated.unit_id);
                }
            }

            await auditLogModel.log(landlordId, 'UPDATE_LEASE_STATUS', `Landlord updated status of lease ${id} to ${lease_status}`);

            // Invalidate lease list and specific detail
            cache.del(cache.landlordKey(landlordId, 'leases', id));
            cache.del(cache.landlordKey(landlordId, 'leases'));

            return responseHelper.success(res, `Lease status successfully updated to ${lease_status}`, updated);

        } catch (error) {
            console.error('Update lease status error:', error);
            return responseHelper.error(
                res,
                error.message || 'Failed to update lease status',
                error,
                error.statusCode || 500
            );
        }
    }
};

module.exports = leaseController;
