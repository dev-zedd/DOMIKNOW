const billingModel = require('../models/billingModel');
const auditLogModel = require('../models/auditLogModel');
const responseHelper = require('../utils/responseHelper');
const supabase = require('../config/supabaseClient');

async function checkAndApplyOverduePenalties(userId, isLandlord = true) {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let query = supabase
            .from('billing_records')
            .select('*, lease_records(id, late_fee_amount, grace_period)')
            .in('billing_status', ['pending_payment', 'unpaid', 'overdue']);

        if (isLandlord) {
            query = query.eq('landlord_id', userId);
        } else {
            query = query.eq('tenant_id', userId);
        }

        const { data: bills } = await query;
        if (!bills || bills.length === 0) return;

        for (const b of bills) {
            if (!b.due_date) continue;
            const dueDt = new Date(b.due_date);
            dueDt.setHours(0, 0, 0, 0);

            const graceDays = parseInt(b.lease_records?.grace_period || 0);
            dueDt.setDate(dueDt.getDate() + graceDays);

            if (today > dueDt) {
                const lateFee = parseFloat(b.lease_records?.late_fee_amount || 0);
                const isAlreadyOverdue = b.billing_status === 'overdue' && parseFloat(b.penalty_amount || 0) === lateFee;

                if (!isAlreadyOverdue && lateFee > 0) {
                    const subtotal = parseFloat(b.rent_amount || 0) + parseFloat(b.water || 0) + parseFloat(b.electricity || 0) + parseFloat(b.internet || 0) + parseFloat(b.parking || 0) + parseFloat(b.other_charges || 0);
                    const newTotal = subtotal + lateFee;

                    await supabase
                        .from('billing_records')
                        .update({
                            billing_status: 'overdue',
                            penalty_amount: lateFee,
                            total_amount: newTotal,
                            updated_at: new Date()
                        })
                        .eq('id', b.id);
                }
            }
        }
    } catch (err) {
        console.error('Error auto-applying overdue penalties:', err);
    }
}

const billingController = {
    async createBilling(req, res) {
        try {
            const { 
                lease_id, billing_month, rent_amount, 
                water, electricity, internet, parking, other_charges,
                penalty_amount, due_date, billing_status, remarks 
            } = req.body;
            
            const landlordId = req.user.id;

            // 1. Validate inputs
            if (!lease_id || !billing_month || rent_amount === undefined || !due_date) {
                return responseHelper.error(res, 'Lease, month, rent amount, and due date are required.');
            }

            // 2. Verify lease ownership & fetch utilities configuration & lease start date
            const { data: lease, error: leaseErr } = await supabase
                .from('lease_records')
                .select('id, tenant_id, property_id, landlord_id, lease_status, lease_start_date, lease_end_date, utilities_covered')
                .eq('id', lease_id)
                .maybeSingle();

            if (leaseErr) throw leaseErr;
            if (!lease || lease.landlord_id !== landlordId) {
                return responseHelper.error(res, 'Lease record not found or access denied.', null, 404);
            }

            // Ensure lease is active
            if (lease.lease_status !== 'active') {
                return responseHelper.error(res, 'Cannot generate billing for inactive or pending leases.');
            }

            // Validation: Cannot bill for periods prior to or equal to lease start month (covered by Move-In bill) or after lease end date
            const targetMonthPrefix = billing_month.slice(0, 7); // e.g. "2026-08"
            const leaseStartMonthPrefix = lease.lease_start_date ? lease.lease_start_date.slice(0, 7) : '';

            if (leaseStartMonthPrefix && targetMonthPrefix < leaseStartMonthPrefix) {
                return responseHelper.error(res, `You cannot create a bill for a month earlier than the lease start date (${lease.lease_start_date}).`);
            }

            // Uniqueness validation: Only one billing statement per lease/tenant for a given month (pending, paid, overdue, or move-in)
            const { data: existingBills, error: billCheckErr } = await supabase
                .from('billing_records')
                .select('id, billing_month, billing_status')
                .eq('lease_id', lease_id);

            if (billCheckErr) throw billCheckErr;

            const duplicateBill = (existingBills || []).find(b => 
                b.billing_month === billing_month || 
                (b.billing_month && b.billing_month.startsWith(targetMonthPrefix))
            );

            if (duplicateBill) {
                const statusStr = (duplicateBill.billing_status || 'existing').toUpperCase();
                if (targetMonthPrefix === leaseStartMonthPrefix) {
                    return responseHelper.error(res, `The month ${targetMonthPrefix} is already included in the tenant's move-in bill. You cannot generate another bill for the same month.`);
                }
                return responseHelper.error(res, `A billing statement already exists for ${targetMonthPrefix} with status ${statusStr}. You cannot generate a second bill for the same month.`);
            }

            // Read utilities configuration from lease
            const parseUtilConfig = (raw) => {
                if (!raw) return {};
                if (typeof raw === 'object') return raw;
                if (typeof raw === 'string') {
                    try { return JSON.parse(raw); } catch (e) { return {}; }
                }
                return {};
            };

            const uConfig = parseUtilConfig(lease.utilities_covered);
            const isUtilIncluded = (type) => {
                if (typeof uConfig === 'object' && uConfig !== null && !Array.isArray(uConfig)) {
                    return uConfig[type] === 'included';
                }
                if (Array.isArray(uConfig)) {
                    return uConfig.includes(type);
                }
                return false;
            };

            const rent = parseFloat(rent_amount) || 0;
            // If utility is included in rent, utility charge is 0
            const w = isUtilIncluded('water') ? 0 : (parseFloat(water) || 0);
            const e = isUtilIncluded('electricity') ? 0 : (parseFloat(electricity) || 0);
            const i = isUtilIncluded('internet') ? 0 : (parseFloat(internet) || 0);
            const p = parseFloat(parking) || 0;
            const other = isUtilIncluded('association_fee') ? 0 : (parseFloat(other_charges) || 0);
            const penalty = parseFloat(penalty_amount) || 0;

            const totalAmount = rent + w + e + i + p + other + penalty;
            const utilitySum = w + e + i + p + other;

            // 3. Save billing record
            const billing = await billingModel.createBilling({
                lease_id,
                tenant_id: lease.tenant_id,
                landlord_id: landlordId,
                property_id: lease.property_id,
                billing_month,
                rent_amount: rent,
                utility_amount: utilitySum,
                water: w,
                electricity: e,
                internet: i,
                parking: p,
                other_charges: other,
                penalty_amount: penalty,
                total_amount: totalAmount,
                due_date,
                billing_status: billing_status || 'pending_payment',
                remarks: remarks || ''
            });

            // 4. Audit log
            await auditLogModel.log(landlordId, 'GENERATE_BILLING', `Landlord generated billing record ${billing.id} for lease ${lease_id}`);

            return responseHelper.success(res, 'Billing statement generated successfully.', billing, 201);

        } catch (error) {
            console.error('Create billing error:', error);
            return responseHelper.error(res, 'Failed to generate billing statement', error, 500);
        }
    },

    async updateBillingDetails(req, res) {
        try {
            const { id } = req.params;
            const { 
                rent_amount, water, electricity, internet, parking, other_charges,
                penalty_amount, due_date, billing_status, remarks 
            } = req.body;
            
            const landlordId = req.user.id;

            // 1. Validate inputs
            if (rent_amount === undefined || !due_date) {
                return responseHelper.error(res, 'Rent amount and due date are required.');
            }

            // Fetch existing billing record and associated lease
            const existingBill = await billingModel.findById(id);
            if (!existingBill || existingBill.landlord_id !== landlordId) {
                return responseHelper.error(res, 'Billing record not found or access denied.', null, 404);
            }

            // Protect Move-In billing statement from manual edits
            if (existingBill.billing_month && existingBill.billing_month.includes('Move-In')) {
                return responseHelper.error(res, 'The Initial Move-In Billing Statement is legally auto-generated based on signed lease terms (Rent + Deposit + Advance) and cannot be edited.');
            }

            const { data: lease } = await supabase
                .from('lease_records')
                .select('utilities_covered')
                .eq('id', existingBill.lease_id)
                .maybeSingle();

            const parseUtilConfig = (raw) => {
                if (!raw) return {};
                if (typeof raw === 'object') return raw;
                if (typeof raw === 'string') {
                    try { return JSON.parse(raw); } catch (e) { return {}; }
                }
                return {};
            };

            const uConfig = parseUtilConfig(lease?.utilities_covered);
            const isUtilIncluded = (type) => {
                if (typeof uConfig === 'object' && uConfig !== null && !Array.isArray(uConfig)) {
                    return uConfig[type] === 'included';
                }
                if (Array.isArray(uConfig)) {
                    return uConfig.includes(type);
                }
                return false;
            };

            const rent = parseFloat(rent_amount) || 0;
            const w = isUtilIncluded('water') ? 0 : (parseFloat(water) || 0);
            const e = isUtilIncluded('electricity') ? 0 : (parseFloat(electricity) || 0);
            const i = isUtilIncluded('internet') ? 0 : (parseFloat(internet) || 0);
            const p = parseFloat(parking) || 0;
            const other = isUtilIncluded('association_fee') ? 0 : (parseFloat(other_charges) || 0);
            const penalty = parseFloat(penalty_amount) || 0;

            const totalAmount = rent + w + e + i + p + other + penalty;
            const utilitySum = w + e + i + p + other;

            const updateData = {
                rent_amount: rent,
                utility_amount: utilitySum,
                water: w,
                electricity: e,
                internet: i,
                parking: p,
                other_charges: other,
                penalty_amount: penalty,
                total_amount: totalAmount,
                due_date,
                remarks: remarks || ''
            };

            // If target billing status is specified, validate it
            if (billing_status) {
                const allowedStatusTransitions = ['draft', 'pending_payment', 'cancelled'];
                if (!allowedStatusTransitions.includes(billing_status)) {
                    return responseHelper.error(res, 'Invalid target billing status. Can only set to draft, pending_payment, or cancelled.');
                }
                updateData.billing_status = billing_status;
            }

            const updated = await billingModel.updateBilling(id, landlordId, updateData);

            if (!updated) {
                return responseHelper.error(res, 'Billing statement not found or unauthorized access.', null, 404);
            }

            // Audit log
            await auditLogModel.log(landlordId, 'UPDATE_BILLING', `Landlord updated details of billing ${id}`);

            return responseHelper.success(res, 'Billing details updated successfully.', updated);

        } catch (error) {
            console.error('Update billing details error:', error);
            return responseHelper.error(res, error.message || 'Failed to update billing details', error, 500);
        }
    },

    async deleteBilling(req, res) {
        try {
            const { id } = req.params;
            const landlordId = req.user.id;

            const existingBill = await billingModel.findById(id);
            if (!existingBill || existingBill.landlord_id !== landlordId) {
                return responseHelper.error(res, 'Billing record not found or unauthorized access.', null, 404);
            }

            // Move-In bills CANNOT be deleted
            if (existingBill.billing_month && existingBill.billing_month.includes('Move-In')) {
                return responseHelper.error(res, 'Initial Move-In Billing Statements cannot be deleted as they are bound to the active lease agreement.');
            }

            // Only pending, unpaid, or draft bills can be deleted
            if (['paid', 'waiting_verification'].includes(existingBill.billing_status)) {
                return responseHelper.error(res, `Cannot delete billing statement with status ${existingBill.billing_status.toUpperCase()}. Only pending or unpaid statements can be deleted.`);
            }

            await billingModel.deleteBilling(id);
            await auditLogModel.log(landlordId, 'DELETE_BILLING', `Landlord deleted billing statement ${id} (${existingBill.billing_month})`);

            return responseHelper.success(res, 'Billing statement deleted successfully.');
        } catch (error) {
            console.error('Delete billing error:', error);
            return responseHelper.error(res, error.message || 'Failed to delete billing statement', error, 500);
        }
    },

    async getLandlordBillings(req, res) {
        try {
            await checkAndApplyOverduePenalties(req.user.id, true);
            const list = await billingModel.findByLandlordId(req.user.id);
            return responseHelper.success(res, 'Landlord billings retrieved successfully', list);
        } catch (error) {
            console.error('Get landlord billings error:', error);
            return responseHelper.error(res, 'Failed to fetch billing statements', error, 500);
        }
    },

    async getTenantBillings(req, res) {
        try {
            const tenantId = req.user.id;
            await checkAndApplyOverduePenalties(tenantId, false);

            // Auto-check if tenant has active leases missing initial move-in billing statements
            const { data: activeLeases } = await supabase
                .from('lease_records')
                .select('*')
                .eq('tenant_id', tenantId)
                .eq('lease_status', 'active');

            if (activeLeases && activeLeases.length > 0) {
                for (const lease of activeLeases) {
                    const { data: existingBills } = await supabase
                        .from('billing_records')
                        .select('id')
                        .eq('lease_id', lease.id)
                        .limit(1);

                    const existingBill = existingBills && existingBills.length > 0 ? existingBills[0] : null;

                    if (!existingBill) {
                        const leaseStartDt = new Date(lease.lease_start_date || new Date());
                        const monthStr = leaseStartDt.toISOString().slice(0, 7);
                        const initMonth = `${monthStr} (Move-In)`;
                        const rentAmt = parseFloat(lease.monthly_rent || 0);
                        const secDep  = parseFloat(lease.security_deposit || 0);
                        const advPay  = parseFloat(lease.advance_payment || 0);
                        const totalAmt = rentAmt + secDep + advPay;

                        await billingModel.createBilling({
                            lease_id: lease.id,
                            tenant_id: lease.tenant_id,
                            landlord_id: lease.landlord_id,
                            property_id: lease.property_id,
                            unit_id: lease.unit_id || null,
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
                            due_date: lease.lease_start_date || new Date().toISOString().slice(0, 10),
                            billing_status: 'pending_payment',
                            remarks: `Initial Move-In Billing: Monthly Rent (₱${rentAmt.toLocaleString()}) + Security Deposit (₱${secDep.toLocaleString()}) + Advance Payment (₱${advPay.toLocaleString()})`
                        });
                    }
                }
            }

            const list = await billingModel.findByTenantId(tenantId);
            return responseHelper.success(res, 'Tenant billings retrieved successfully', list);
        } catch (error) {
            console.error('Get tenant billings error:', error);
            return responseHelper.error(res, 'Failed to fetch billing statements', error, 500);
        }
    },

    async getBillingById(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const role = req.user.role;

            const billing = await billingModel.findById(id);
            if (!billing) {
                return responseHelper.error(res, 'Billing statement not found.', null, 404);
            }

            // Authorization check
            if (role === 'landlord' && billing.landlord_id !== userId) {
                return responseHelper.error(res, 'Access denied.', null, 403);
            }
            if (role === 'tenant' && billing.tenant_id !== userId) {
                return responseHelper.error(res, 'Access denied.', null, 403);
            }

            return responseHelper.success(res, 'Billing details retrieved successfully', billing);
        } catch (error) {
            console.error('Get billing details error:', error);
            return responseHelper.error(res, 'Failed to fetch billing details', error, 500);
        }
    },

    async getLandlordOverdueBillings(req, res) {
        try {
            const list = await billingModel.findOverdueByLandlordId(req.user.id);
            return responseHelper.success(res, 'Landlord overdue billings retrieved successfully', list);
        } catch (error) {
            console.error('Get landlord overdue billings error:', error);
            return responseHelper.error(res, 'Failed to retrieve overdue listings', error, 500);
        }
    },

    async getTenantOverdueBillings(req, res) {
        try {
            const list = await billingModel.findOverdueByTenantId(req.user.id);
            return responseHelper.success(res, 'Tenant overdue billings retrieved successfully', list);
        } catch (error) {
            console.error('Get tenant overdue billings error:', error);
            return responseHelper.error(res, 'Failed to retrieve overdue bills', error, 500);
        }
    }
};

module.exports = billingController;
