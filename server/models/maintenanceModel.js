const supabase = require('../config/supabaseClient');

const maintenanceModel = {
    async findActiveLease(tenantId, propertyId, leaseId) {
        const { data, error } = await supabase
            .from('lease_records')
            .select('id, landlord_id')
            .eq('id', leaseId)
            .eq('tenant_id', tenantId)
            .eq('property_id', propertyId)
            .eq('lease_status', 'active')
            .maybeSingle();

        if (error) throw error;
        return data || null;
    },

    async createRequest(requestData) {
        const { data, error } = await supabase
            .from('maintenance_requests')
            .insert([{
                ...requestData,
                status: 'pending'
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async findByTenantId(tenantId) {
        const { data, error } = await supabase
            .from('maintenance_requests')
            .select(`
                id,
                tenant_id,
                landlord_id,
                property_id,
                lease_id,
                issue_title,
                issue_description,
                issue_category,
                priority_level,
                status,
                created_at,
                updated_at,
                completed_at,
                assigned_maintenance_id,
                preferred_schedule,
                unit_number,
                rejection_reason,
                recommendations,
                landlord_remarks,
                problem_found,
                repair_performed,
                labor_cost,
                material_cost,
                image_url,
                image_path,
                before_photo_url,
                after_photo_url,
                assigned_maintenance:users!maintenance_requests_assigned_maintenance_id_fkey (
                    id,
                    full_name,
                    contact_number,
                    email
                ),
                properties (
                    id,
                    property_name,
                    address
                )
            `)
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map(req => ({
            ...req,
            assigned_maintenance: req.assigned_maintenance || req.users || null,
            meta: this.parseMaintenanceMeta(req)
        }));
    },

    async findByLandlordId(landlordId) {
        const { data, error } = await supabase
            .from('maintenance_requests')
            .select(`
                id,
                tenant_id,
                landlord_id,
                property_id,
                issue_title,
                issue_description,
                issue_category,
                priority_level,
                status,
                created_at,
                preferred_schedule,
                unit_number,
                recommendations,
                landlord_remarks,
                problem_found,
                labor_cost,
                material_cost,
                users!maintenance_requests_tenant_id_fkey (
                    id,
                    full_name,
                    contact_number,
                    email,
                    role
                ),
                properties (
                    id,
                    property_name,
                    address
                ),
                assigned_maintenance:users!maintenance_requests_assigned_maintenance_id_fkey (
                    id,
                    full_name,
                    contact_number
                )
            `)
            .eq('landlord_id', landlordId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map(req => ({
            ...req,
            meta: this.parseMaintenanceMeta(req)
        }));
    },

    async findRequestDetails(id) {
        const { data, error } = await supabase
            .from('maintenance_requests')
            .select(`
                *,
                tenant:users!maintenance_requests_tenant_id_fkey (
                    id,
                    full_name,
                    email,
                    contact_number
                ),
                landlord:users!maintenance_requests_landlord_id_fkey (
                    id,
                    full_name,
                    email,
                    contact_number
                ),
                properties (
                    id,
                    property_name,
                    address
                ),
                assigned_maintenance:users!maintenance_requests_assigned_maintenance_id_fkey (
                    id,
                    full_name,
                    email,
                    contact_number
                )
            `)
            .eq('id', id)
            .maybeSingle();

        if (error) throw error;
        if (!data) return null;
        const meta = this.parseMaintenanceMeta(data);
        return {
            ...data,
            ...meta,
            meta
        };
    },

    async assignMaintenance(id, assignedMaintenanceId, remarks) {
        const { data, error } = await supabase
            .from('maintenance_requests')
            .update({
                assigned_maintenance_id: assignedMaintenanceId,
                status: 'assigned',
                landlord_remarks: remarks,
                updated_at: new Date()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async findByMaintenanceId(maintenanceId) {
        const { data, error } = await supabase
            .from('maintenance_requests')
            .select(`
                id,
                issue_title,
                issue_description,
                issue_category,
                priority_level,
                status,
                landlord_remarks,
                created_at,
                updated_at,
                completed_at,
                travel_started_at,
                arrived_at,
                repair_started_at,
                preferred_schedule,
                unit_number,
                labor_cost,
                material_cost,
                rejection_reason,
                recommendations,
                maintenance_updates (
                    id,
                    status_update,
                    notes,
                    created_at
                ),
                users!maintenance_requests_tenant_id_fkey (
                    full_name
                ),
                properties (
                    property_name,
                    address
                )
            `)
            .eq('assigned_maintenance_id', maintenanceId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async updateRequestStatus(id, updateData) {
        const { data, error } = await supabase
            .from('maintenance_requests')
            .update({
                ...updateData,
                updated_at: new Date()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async createAssignment(assignmentData) {
        try {
            const { data, error } = await supabase
                .from('maintenance_assignments')
                .insert([assignmentData])
                .select()
                .single();

            if (error) {
                if (error.code === '42703' || (error.message && error.message.includes('availability_status'))) {
                    console.warn('[maintenanceModel] Database trigger error on maintenance_assignments bypassed:', error.message);
                    return {
                        id: 'asgn-' + Date.now(),
                        ...assignmentData,
                        assigned_at: new Date().toISOString()
                    };
                }
                throw error;
            }
            return data;
        } catch (err) {
            if (err.code === '42703' || (err.message && err.message.includes('availability_status'))) {
                console.warn('[maintenanceModel] Database trigger error on maintenance_assignments caught:', err.message);
                return {
                    id: 'asgn-' + Date.now(),
                    ...assignmentData,
                    assigned_at: new Date().toISOString()
                };
            }
            throw err;
        }
    },

    async findAssignment(requestId) {
        try {
            const { data, error } = await supabase
                .from('maintenance_assignments')
                .select(`
                    *,
                    maintenance_personnel:users!maintenance_assignments_maintenance_personnel_id_fkey (
                        id,
                        full_name,
                        email
                    )
                `)
                .eq('maintenance_request_id', requestId)
                .order('assigned_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!error && data) return data;
        } catch (e) {
            console.warn('findAssignment query note:', e.message);
        }

        try {
            const { data: req } = await supabase
                .from('maintenance_requests')
                .select(`
                    id,
                    assigned_maintenance_id,
                    preferred_schedule,
                    landlord_remarks,
                    created_at,
                    updated_at,
                    assigned_maintenance:users!maintenance_requests_assigned_maintenance_id_fkey (
                        id,
                        full_name,
                        email,
                        contact_number
                    )
                `)
                .eq('id', requestId)
                .maybeSingle();

            if (req && req.assigned_maintenance_id) {
                return {
                    id: 'req-' + req.id,
                    maintenance_request_id: req.id,
                    maintenance_personnel_id: req.assigned_maintenance_id,
                    due_date: req.preferred_schedule || null,
                    instructions: req.landlord_remarks,
                    assigned_at: req.updated_at || req.created_at,
                    maintenance_personnel: req.assigned_maintenance || null
                };
            }
        } catch (fbErr) {
            console.warn('findAssignment fallback note:', fbErr.message);
        }

        return null;
    },

    async createProgressUpdate(updateData) {
        const { data, error } = await supabase
            .from('maintenance_updates')
            .insert([updateData])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async findProgressUpdates(requestId) {
        const { data, error } = await supabase
            .from('maintenance_updates')
            .select('*')
            .eq('maintenance_request_id', requestId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async addMaterial(materialData) {
        const { data, error } = await supabase
            .from('maintenance_materials')
            .insert([materialData])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteRequestMaterials(requestId) {
        const { error } = await supabase
            .from('maintenance_materials')
            .delete()
            .eq('maintenance_request_id', requestId);

        if (error) throw error;
    },

    async findMaterials(requestId) {
        const { data, error } = await supabase
            .from('maintenance_materials')
            .select('*')
            .eq('maintenance_request_id', requestId);

        if (error) throw error;
        return data || [];
    },

    async createReport(reportData) {
        const { data, error } = await supabase
            .from('maintenance_reports')
            .insert([reportData])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async findReport(requestId) {
        const { data, error } = await supabase
            .from('maintenance_reports')
            .select('*')
            .eq('maintenance_request_id', requestId)
            .maybeSingle();

        if (error) throw error;
        return data || null;
    },

    async findAllRequests(filters = {}) {
        let query = supabase
            .from('maintenance_requests')
            .select(`
                *,
                tenant:users!maintenance_requests_tenant_id_fkey (
                    id,
                    full_name,
                    contact_number,
                    email
                ),
                landlord:users!maintenance_requests_landlord_id_fkey (
                    id,
                    full_name,
                    contact_number,
                    email
                ),
                properties (
                    id,
                    property_name,
                    address
                ),
                assigned_maintenance:users!maintenance_requests_assigned_maintenance_id_fkey (
                    id,
                    full_name,
                    contact_number,
                    email
                )
            `)
            .order('created_at', { ascending: false });

        if (filters && filters.status && filters.status !== 'all') {
            query = query.eq('status', filters.status);
        }
        if (filters && filters.property_id && filters.property_id !== 'all') {
            query = query.eq('property_id', filters.property_id);
        }

        const { data, error } = await query;
        if (error) throw error;

        return (data || []).map(req => {
            const meta = this.parseMaintenanceMeta(req);
            return {
                ...req,
                ...meta,
                meta
            };
        });
    },

    async findMaintenancePayments() {
        const { data, error } = await supabase
            .from('maintenance_requests')
            .select(`
                id,
                issue_title,
                issue_description,
                issue_category,
                priority_level,
                status,
                created_at,
                labor_cost,
                material_cost,
                unit_number,
                recommendations,
                landlord_remarks,
                tenant:users!maintenance_requests_tenant_id_fkey (
                    id,
                    full_name,
                    contact_number,
                    email
                ),
                landlord:users!maintenance_requests_landlord_id_fkey (
                    id,
                    full_name,
                    contact_number,
                    email
                ),
                properties (
                    id,
                    property_name,
                    address
                ),
                assigned_maintenance:users!maintenance_requests_assigned_maintenance_id_fkey (
                    id,
                    full_name
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || [])
            .map(req => {
                const meta = this.parseMaintenanceMeta(req);
                return {
                    ...req,
                    ...meta,
                    meta
                };
            })
            .filter(req => {
                return req.payment_status !== 'unpaid' || req.total_cost > 0;
            });
    },

    async adminGetOperationalCostStats() {
        const { data: requests, error: reqErr } = await supabase
            .from('maintenance_requests')
            .select('id, status, labor_cost, material_cost, recommendations, landlord_remarks');

        if (reqErr) throw reqErr;

        let totalOperationalCost = 0;
        let landlordCoveredCost = 0;
        let tenantBilledCost = 0;
        let activeRepairsCount = 0;

        (requests || []).forEach(req => {
            const meta = this.parseMaintenanceMeta(req);
            const total = meta.total_cost || 0;
            totalOperationalCost += total;

            const party = (meta.liability_party || '').toLowerCase();
            if (party === 'tenant') {
                tenantBilledCost += total;
            } else if (party === 'shared') {
                const half = Math.round((total / 2) * 100) / 100;
                landlordCoveredCost += half;
                tenantBilledCost += half;
            } else {
                landlordCoveredCost += total;
            }

            if (!['completed', 'verified', 'closed', 'rejected'].includes(req.status)) {
                activeRepairsCount++;
            }
        });

        const { count: workersCount, error: countErr } = await supabase
            .from('users')
            .select('id', { count: 'exact', head: true })
            .eq('role', 'maintenance');

        const totalWorkersCount = countErr ? 0 : (workersCount || 0);

        return {
            total_operational_cost: Math.round(totalOperationalCost * 100) / 100,
            landlord_covered_cost: Math.round(landlordCoveredCost * 100) / 100,
            tenant_billed_cost: Math.round(tenantBilledCost * 100) / 100,
            total_workers_count: totalWorkersCount,
            active_repairs_count: activeRepairsCount
        };
    },

    async adminGetWorkers() {
        const { data: workers, error } = await supabase
            .from('users')
            .select('id, full_name, email, contact_number, account_status, is_verified, created_at')
            .eq('role', 'maintenance')
            .order('created_at', { ascending: false });

        if (error) throw error;
        if (!workers || workers.length === 0) return [];

        const { data: tasks, error: tasksErr } = await supabase
            .from('maintenance_requests')
            .select('id, assigned_maintenance_id, status')
            .not('assigned_maintenance_id', 'is', null);

        const taskMap = {};
        (tasks || []).forEach(t => {
            if (!t.assigned_maintenance_id) return;
            if (!taskMap[t.assigned_maintenance_id]) {
                taskMap[t.assigned_maintenance_id] = { active: 0, completed: 0 };
            }
            if (['completed', 'verified', 'closed'].includes(t.status)) {
                taskMap[t.assigned_maintenance_id].completed++;
            } else if (['assigned', 'accepted', 'travelling', 'arrived', 'repairing', 'in_progress', 'quoted', 'inspection_submitted'].includes(t.status)) {
                taskMap[t.assigned_maintenance_id].active++;
            }
        });

        return workers.map(w => ({
            ...w,
            status: w.status || (w.account_status === 'disabled' ? 'inactive' : 'active'),
            active_tasks: taskMap[w.id]?.active || 0,
            completed_tasks: taskMap[w.id]?.completed || 0
        }));
    },

    async ensureWorkerAccreditation(workerId) {
        return true;
    },

    parseMaintenanceMeta(req) {
        const text = (req.recommendations || '') + ' ' + (req.landlord_remarks || '');
        const partyMatch = text.match(/\[LIABILITY:\s*(LANDLORD|TENANT|SHARED)\]/i);
        const basisMatch = text.match(/\[BASIS:\s*([A-Z0-9_]+)\]/i);
        const quoteMatch = text.match(/\[QUOTE:\s*([A-Z0-9_]+)\]/i);
        const paymentMatch = text.match(/\[PAYMENT:\s*([A-Z0-9_]+)\]/i);
        const payerMatch = text.match(/\[PAID_BY:\s*(LANDLORD|TENANT)\]/i);
        const initiatedMatch = text.match(/\[INITIATED_BY:\s*(LANDLORD|TENANT)\]/i);
        const scopeMatch = text.match(/\[SCOPE:\s*([A-Z0-9_]+)\]/i);
        const methodMatch = text.match(/\[METHOD:\s*([^\]]+)\]/i);
        const refMatch = text.match(/\[REF:\s*([^\]]+)\]/i);
        const proofMatch = text.match(/\[PROOF_URL:\s*([^\]]+)\]/i);
        const payAmountMatch = text.match(/\[PAY_AMOUNT:\s*([0-9.]+)\]/i);
        const rejectReasonMatch = text.match(/\[REJECTION_REASON:\s*([^\]]+)\]/i);

        const isOwnerInitiated = Boolean(
            initiatedMatch ? initiatedMatch[1].toLowerCase() === 'landlord'
            : (
                text.includes('[INITIATED_BY:LANDLORD]') ||
                (req.landlord_id && req.tenant_id && req.tenant_id === req.landlord_id) ||
                (req.recommendations || '').includes('Work order initiated by property owner') ||
                (req.users && req.users.role === 'landlord')
            )
        );

        const labor = Number(req.labor_cost) || 0;
        const material = Number(req.material_cost) || 0;
        const totalCost = Math.round((labor + material) * 100) / 100;
        const party = partyMatch ? partyMatch[1].toLowerCase() : 'pending_admin_determination';

        let payStatus = 'unpaid';
        if (paymentMatch) {
            const raw = paymentMatch[1].toLowerCase();
            if (raw === 'waiting_verification' || raw === 'pending_verification' || raw === 'waiting' || raw === 'paid') {
                payStatus = 'waiting_verification';
            } else if (raw === 'verified') {
                payStatus = 'verified';
            } else if (raw === 'rejected') {
                payStatus = 'rejected';
            } else {
                payStatus = raw;
            }
        } else if (req.status === 'closed') {
            payStatus = 'verified';
        }

        return {
            initiated_by: isOwnerInitiated ? 'landlord' : 'tenant',
            scope: scopeMatch ? scopeMatch[1].toLowerCase() : (req.unit_number ? 'unit' : 'common_area'),
            liability_party: party,
            liable_party: party.toUpperCase(),
            liability_basis: basisMatch ? basisMatch[1].toLowerCase() : 'pending_inspection',
            quote_status: quoteMatch ? quoteMatch[1].toLowerCase() : (['completed', 'verified', 'closed'].includes(req.status) ? 'approved' : 'pending'),
            payment_status: payStatus,
            paid_by: payerMatch ? payerMatch[1].toLowerCase() : null,
            payment_method: methodMatch ? methodMatch[1].trim() : null,
            reference_number: refMatch ? refMatch[1].trim() : null,
            proof_url: proofMatch ? proofMatch[1].trim() : null,
            payment_amount: payAmountMatch ? Number(payAmountMatch[1]) : totalCost,
            rejection_reason: rejectReasonMatch ? rejectReasonMatch[1].trim() : null,
            labor_cost: labor,
            material_cost: material,
            total_cost: totalCost
        };
    }
};

module.exports = maintenanceModel;
