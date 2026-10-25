const billingModel = require('../models/billingModel');
const auditLogModel = require('../models/auditLogModel');
const notificationModel = require('../models/notificationModel');
const responseHelper = require('../utils/responseHelper');
const supabase = require('../config/supabaseClient');

async function checkAndApplyOverduePenalties(userId, isLandlord = true) {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let query = supabase
            .from('billing_records')
            .select('*, lease_records(id, late_fee_amount, grace_period)')
            .in('billing_status', ['pending_payment', 'unpaid', 'partially_paid', 'overdue']);

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

                    await notificationModel.create({
                        user_id: b.tenant_id,
                        type: 'billing_overdue',
                        title: 'Billing is overdue',
                        message: `Your billing statement due on ${b.due_date} is overdue. Review the updated balance and payment details.`,
                        reference_id: b.id
                    });
                }
            }
        }
    } catch (err) {
        console.error('Error auto-applying overdue penalties:', err);
    }
}

async function autoGenerateMonthlyBillings(userId, isLandlord = true) {
    try {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1; // 1-12
        const currentYearMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

        let leaseQuery = supabase
            .from('lease_records')
            .select('*')
            .eq('lease_status', 'active');

        if (isLandlord) {
            leaseQuery = leaseQuery.eq('landlord_id', userId);
        } else {
            leaseQuery = leaseQuery.eq('tenant_id', userId);
        }

        const { data: leases, error: leaseErr } = await leaseQuery;
        if (leaseErr || !leases || leases.length === 0) return;

        for (const lease of leases) {
            if (!lease.lease_start_date) continue;

            const startDt = new Date(lease.lease_start_date);
            const startYear = startDt.getFullYear();
            const startMonth = startDt.getMonth() + 1;

            const endDt = lease.lease_end_date ? new Date(lease.lease_end_date) : null;
            const endYear = endDt ? endDt.getFullYear() : currentYear;
            const endMonth = endDt ? endDt.getMonth() + 1 : currentMonth;

            // Fetch all existing bills for this lease to check which months are already billed
            const { data: existingBills } = await supabase
                .from('billing_records')
                .select('id, billing_month')
                .eq('lease_id', lease.id);

            const existingMonthPrefixes = new Set(
                (existingBills || []).map(b => (b.billing_month || '').slice(0, 7))
            );

            let iterYear = startYear;
            let iterMonth = startMonth;

            while (
                (iterYear < currentYear || (iterYear === currentYear && iterMonth <= currentMonth)) &&
                (!endDt || (iterYear < endYear || (iterYear === endYear && iterMonth <= endMonth)))
            ) {
                const iterYearMonth = `${iterYear}-${String(iterMonth).padStart(2, '0')}`;

                if (!existingMonthPrefixes.has(iterYearMonth)) {
                    const isStartMonth = (iterYear === startYear && iterMonth === startMonth);
                    const dueDay = Math.min(Math.max(parseInt(lease.payment_due_day || 5, 10), 1), 28);
                    const dueDayStr = String(dueDay).padStart(2, '0');
                    const dueDateStr = `${iterYearMonth}-${dueDayStr}`;
                    const rentAmt = parseFloat(lease.monthly_rent || 0);

                    if (isStartMonth) {
                        // Generate Initial Move-In statement
                        const secDep = parseFloat(lease.security_deposit || 0);
                        const advPay = parseFloat(lease.advance_payment || 0);
                        const totalAmt = rentAmt + secDep + advPay;

                        const moveInBill = await billingModel.createBilling({
                            lease_id: lease.id,
                            tenant_id: lease.tenant_id,
                            landlord_id: lease.landlord_id,
                            property_id: lease.property_id,
                            unit_id: lease.unit_id || null,
                            billing_month: `${iterYearMonth} (Move-In)`,
                            rent_amount: rentAmt,
                            utility_amount: 0,
                            water: 0,
                            electricity: 0,
                            internet: 0,
                            parking: 0,
                            other_charges: secDep + advPay,
                            penalty_amount: 0,
                            total_amount: totalAmt,
                            due_date: lease.lease_start_date || dueDateStr,
                            billing_status: 'pending_payment',
                            remarks: `Initial Move-In Billing: Monthly Rent (₱${rentAmt.toLocaleString()}) + Security Deposit (₱${secDep.toLocaleString()}) + Advance Payment (₱${advPay.toLocaleString()})`
                        });

                        existingMonthPrefixes.add(iterYearMonth);

                        await notificationModel.create({
                            user_id: lease.tenant_id,
                            type: 'billing_issued',
                            title: 'Move-in billing statement ready',
                            message: `Your initial move-in statement is ready. Total due: ₱${totalAmt.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
                            reference_id: moveInBill.id
                        });
                    } else {
                        // Regular monthly recurring billing
                        const monthlyBill = await billingModel.createBilling({
                            lease_id: lease.id,
                            tenant_id: lease.tenant_id,
                            landlord_id: lease.landlord_id,
                            property_id: lease.property_id,
                            unit_id: lease.unit_id || null,
                            billing_month: iterYearMonth,
                            rent_amount: rentAmt,
                            utility_amount: 0,
                            water: 0,
                            electricity: 0,
                            internet: 0,
                            parking: 0,
                            other_charges: 0,
                            penalty_amount: 0,
                            total_amount: rentAmt,
                            due_date: dueDateStr,
                            billing_status: 'pending_payment',
                            remarks: `Automatic recurring monthly billing statement for ${iterYearMonth}.`
                        });

                        existingMonthPrefixes.add(iterYearMonth);

                        await notificationModel.create({
                            user_id: lease.tenant_id,
                            type: 'billing_issued',
                            title: `New Monthly Billing Statement (${iterYearMonth})`,
                            message: `Your recurring monthly billing statement for ${iterYearMonth} is ready. Total due: ₱${rentAmt.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Due date: ${dueDateStr}.`,
                            reference_id: monthlyBill.id
                        });
                    }
                }

                iterMonth++;
                if (iterMonth > 12) {
                    iterMonth = 1;
                    iterYear++;
                }
            }
        }
    } catch (err) {
        console.error('Error auto-generating monthly billings:', err);
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

            await notificationModel.create({
                user_id: lease.tenant_id,
                type: 'billing_issued',
                title: 'New billing statement',
                message: `A billing statement for ${billing_month} was issued. Total due: ₱${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
                reference_id: billing.id
            });

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
                const allowedStatusTransitions = ['draft', 'pending_payment', 'cancelled', 'overdue'];
                if (!allowedStatusTransitions.includes(billing_status)) {
                    return responseHelper.error(res, 'Invalid target billing status. Can only set to draft, pending_payment, overdue, or cancelled.');
                }
                updateData.billing_status = billing_status;
            } else if (existingBill.billing_status === 'overdue') {
                const dueDt = new Date(due_date);
                dueDt.setHours(0, 0, 0, 0);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (dueDt >= today) {
                    updateData.billing_status = 'pending_payment';
                }
            }

            const updated = await billingModel.updateBilling(id, landlordId, updateData);

            if (!updated) {
                return responseHelper.error(res, 'Billing statement not found or unauthorized access.', null, 404);
            }

            // Audit log
            await auditLogModel.log(landlordId, 'UPDATE_BILLING', `Landlord updated details of billing ${id}`);

            await notificationModel.create({
                user_id: existingBill.tenant_id,
                type: billing_status === 'cancelled' ? 'billing_cancelled' : 'billing_updated',
                title: billing_status === 'cancelled' ? 'Billing statement cancelled' : 'Billing statement updated',
                message: billing_status === 'cancelled'
                    ? 'A billing statement was cancelled by your landlord.'
                    : 'A billing statement was updated. Review the latest amount, due date, and remarks.',
                reference_id: updated.id
            });

            return responseHelper.success(res, 'Billing details updated successfully.', updated);

        } catch (error) {
            console.error('Update billing details error:', error);
            return responseHelper.error(res, error.message || 'Failed to update billing details', error, 500);
        }
    },

    async manualOverrideBilling(req, res) {
        try {
            const { id } = req.params;
            const { 
                extended_due_date, 
                due_date, 
                waive_penalty, 
                discount_amount, 
                override_reason,
                remarks 
            } = req.body;
            
            const landlordId = req.user.id;

            const existingBill = await billingModel.findById(id);
            if (!existingBill || existingBill.landlord_id !== landlordId) {
                return responseHelper.error(res, 'Billing statement not found or unauthorized access.', null, 404);
            }

            if (existingBill.billing_status === 'paid') {
                return responseHelper.error(res, 'Cannot apply manual override to an already paid billing statement.');
            }

            const targetDueDate = extended_due_date || due_date || existingBill.due_date;
            if (!targetDueDate) {
                return responseHelper.error(res, 'Valid due date is required for manual override.');
            }

            // Penalty waiver
            const shouldWaivePenalty = waive_penalty === true || waive_penalty === 'true';
            const penalty = shouldWaivePenalty ? 0 : parseFloat(existingBill.penalty_amount || 0);

            // Concession / discount
            const discount = Math.max(0, parseFloat(discount_amount || 0));

            // Breakdown
            const rent = parseFloat(existingBill.rent_amount || 0);
            const water = parseFloat(existingBill.water || 0);
            const electricity = parseFloat(existingBill.electricity || 0);
            const internet = parseFloat(existingBill.internet || 0);
            const parking = parseFloat(existingBill.parking || 0);
            const other = parseFloat(existingBill.other_charges || 0);

            const adjustedRent = Math.max(0, rent - discount);
            const newTotal = adjustedRent + water + electricity + internet + parking + other + penalty;

            // Status transition: if overdue and due date is >= today, reset to pending_payment
            let newStatus = existingBill.billing_status;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const newDueDt = new Date(targetDueDate);
            newDueDt.setHours(0, 0, 0, 0);

            if (existingBill.billing_status === 'overdue' && newDueDt >= today) {
                newStatus = 'pending_payment';
            }

            // Clean previous leeway / override headers to avoid clutter
            const reasonText = (override_reason || remarks || '').trim() || 'Leeway accommodation granted by landlord.';
            const concessionDetails = [];
            if (targetDueDate !== existingBill.due_date) concessionDetails.push(`Extended Due Date: ${targetDueDate}`);
            if (shouldWaivePenalty && parseFloat(existingBill.penalty_amount || 0) > 0) concessionDetails.push('Waived Late Penalty (₱0.00)');
            if (discount > 0) concessionDetails.push(`Discount: ₱${discount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

            const overrideTag = `[LEEWAY GRANTED] ${concessionDetails.join(' | ')}. Reason: ${reasonText}`;
            const priorRemarksCleaned = (existingBill.remarks || '')
                .replace(/\[(LEEWAY GRANTED|PINAGBIGYAN|OVERRIDE)\][^\n]*\n?/gi, '')
                .trim();
            const updatedRemarks = priorRemarksCleaned 
                ? `${overrideTag}\n${priorRemarksCleaned}` 
                : overrideTag;

            const updateData = {
                due_date: targetDueDate,
                penalty_amount: penalty,
                total_amount: newTotal,
                billing_status: newStatus,
                remarks: updatedRemarks
            };

            const updated = await billingModel.overrideBilling(id, landlordId, updateData);

            await auditLogModel.log(
                landlordId, 
                'BILLING_OVERRIDE', 
                `Landlord applied manual leeway to billing ${id} (${existingBill.billing_month}): due_date=${targetDueDate}, waived_penalty=${shouldWaivePenalty}, discount=₱${discount}, new_total=₱${newTotal}`
            );

            await notificationModel.create({
                user_id: existingBill.tenant_id,
                type: 'billing_override',
                title: 'Billing Statement Leeway Granted',
                message: `Your landlord granted leeway on your billing statement for ${existingBill.billing_month}. New due date: ${targetDueDate}. Updated total due: ₱${newTotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
                reference_id: updated.id
            });

            return responseHelper.success(res, 'Billing statement leeway applied successfully.', updated);
        } catch (error) {
            console.error('Manual override billing error:', error);
            return responseHelper.error(res, error.message || 'Failed to apply manual override.', error, 500);
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
            await autoGenerateMonthlyBillings(req.user.id, true);
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
            await autoGenerateMonthlyBillings(tenantId, false);
            await checkAndApplyOverduePenalties(tenantId, false);

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

            // Fetch complete billing history for this lease/tenancy to power tenant billing history
            try {
                let historyQuery = supabase
                    .from('billing_records')
                    .select(`
                        id,
                        lease_id,
                        tenant_id,
                        billing_month,
                        due_date,
                        total_amount,
                        billing_status,
                        remarks,
                        created_at,
                        updated_at,
                        payment_records (
                            id,
                            payment_amount,
                            payment_method,
                            payment_reference_number,
                            payment_status,
                            submitted_at,
                            verified_at
                        )
                    `);

                if (billing.lease_id) {
                    historyQuery = historyQuery.eq('lease_id', billing.lease_id);
                } else {
                    historyQuery = historyQuery.eq('tenant_id', billing.tenant_id);
                }

                const { data: history, error: historyErr } = await historyQuery.order('created_at', { ascending: true });
                if (historyErr) {
                    console.warn('History query notice:', historyErr.message);
                    billing.tenant_billing_history = [billing];
                } else {
                    billing.tenant_billing_history = (history && history.length > 0) ? history : [billing];
                }
            } catch (histErr) {
                console.warn('History query error in getBillingById:', histErr);
                billing.tenant_billing_history = [billing];
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

billingController.autoGenerateMonthlyBillings = autoGenerateMonthlyBillings;
billingController.checkAndApplyOverduePenalties = checkAndApplyOverduePenalties;

module.exports = billingController;
