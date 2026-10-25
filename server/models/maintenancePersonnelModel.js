const supabase = require('../config/supabaseClient');

const maintenancePersonnelModel = {
    // ── Personnel Profiles ──────────────────────────────────────────────────
    async findProfileByUserId(userId) {
        const { data, error } = await supabase
            .from('maintenance_personnel_profiles')
            .select(`
                *,
                supervisor:users!maintenance_personnel_profiles_supervisor_user_id_fkey (
                    id,
                    full_name,
                    email
                )
            `)
            .eq('user_id', userId)
            .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;
        if (!data) return null;

        // Parse packed certifications if storing JSON metadata for service_area & availability_status
        let parsedCertifications = data.certifications || '';
        let serviceArea = '';
        let availabilityStatus = 'available';

        if (data.certifications && data.certifications.trim().startsWith('{')) {
            try {
                const parsed = JSON.parse(data.certifications);
                parsedCertifications = parsed.certifications || '';
                serviceArea = parsed.service_area || '';
                availabilityStatus = parsed.availability_status || 'available';
            } catch (e) {
                // Keep raw string if not JSON
            }
        }

        return {
            ...data,
            raw_certifications: data.certifications,
            certifications: parsedCertifications,
            service_area: serviceArea,
            availability_status: availabilityStatus
        };
    },

    async upsertProfile(userId, profileData) {
        const {
            employee_number,
            department,
            supervisor_user_id,
            hire_date,
            site_id,
            certifications,
            service_area,
            availability_status,
            is_active
        } = profileData;

        // Pack certifications, service_area, and availability_status into certifications JSON
        // to maintain database schema integrity without missing column errors
        const certificationsPayload = JSON.stringify({
            certifications: certifications || '',
            service_area: service_area || '',
            availability_status: availability_status || 'available'
        });

        // Check if profile exists
        const existing = await this.findProfileByUserId(userId);

        const payload = {
            user_id: userId,
            employee_number: employee_number !== undefined ? employee_number : (existing?.employee_number || null),
            department: department !== undefined ? department : (existing?.department || null),
            supervisor_user_id: supervisor_user_id !== undefined ? supervisor_user_id : (existing?.supervisor_user_id || null),
            hire_date: hire_date !== undefined ? hire_date : (existing?.hire_date || null),
            site_id: site_id !== undefined ? site_id : (existing?.site_id || null),
            certifications: certificationsPayload,
            is_active: is_active !== undefined ? is_active : (existing ? existing.is_active : true),
            updated_at: new Date().toISOString()
        };

        let result;
        if (existing) {
            const { data, error } = await supabase
                .from('maintenance_personnel_profiles')
                .update(payload)
                .eq('id', existing.id)
                .select()
                .single();
            if (error) throw error;
            result = data;
        } else {
            const { data, error } = await supabase
                .from('maintenance_personnel_profiles')
                .insert([payload])
                .select()
                .single();
            if (error) throw error;
            result = data;
        }

        // Also sync address in users table if service_area provided
        if (service_area) {
            await supabase
                .from('users')
                .update({ address: service_area, updated_at: new Date().toISOString() })
                .eq('id', userId);
        }

        return {
            ...result,
            certifications: certifications || '',
            service_area: service_area || '',
            availability_status: availability_status || 'available'
        };
    },

    // ── Maintenance Access ──────────────────────────────────────────────────
    async findAccessByUserId(userId) {
        const { data, error } = await supabase
            .from('maintenance_access')
            .select(`
                *,
                granter:users!maintenance_access_granted_by_fkey (
                    id,
                    full_name,
                    email
                )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;
        return data || null;
    },

    async upsertAccess(userId, accessData) {
        const {
            access_status,
            site_id,
            granted_by,
            granted_at,
            expires_at,
            restriction_reason
        } = accessData;

        const existing = await this.findAccessByUserId(userId);

        const payload = {
            user_id: userId,
            site_id: site_id !== undefined ? site_id : (existing?.site_id || null),
            access_status: access_status || (existing?.access_status || 'pending'),
            granted_by: granted_by !== undefined ? granted_by : (existing?.granted_by || null),
            granted_at: granted_at !== undefined ? granted_at : (existing?.granted_at || new Date().toISOString()),
            expires_at: expires_at !== undefined ? expires_at : (existing?.expires_at || null),
            restriction_reason: restriction_reason !== undefined ? restriction_reason : (existing?.restriction_reason || null),
            updated_at: new Date().toISOString()
        };

        if (existing) {
            const { data, error } = await supabase
                .from('maintenance_access')
                .update(payload)
                .eq('id', existing.id)
                .select()
                .single();
            if (error) throw error;
            return data;
        } else {
            const { data, error } = await supabase
                .from('maintenance_access')
                .insert([payload])
                .select()
                .single();
            if (error) throw error;
            return data;
        }
    },

    // ── Screening Requirements ──────────────────────────────────────────────
    async getScreeningRequirements(role = 'maintenance') {
        let query = supabase
            .from('screening_requirements')
            .select('*')
            .order('created_at', { ascending: true });

        if (role) {
            query = query.eq('applies_to_role', role);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    async findRequirementById(id) {
        const { data, error } = await supabase
            .from('screening_requirements')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (error && error.code !== 'PGRST116') throw error;
        return data || null;
    },

    async upsertScreeningRequirement(reqData) {
        const { id, code, name, description, applies_to_role, required_for_assignment, valid_for_days, is_active } = reqData;

        if (id) {
            const updates = {
                ...(code !== undefined && { code }),
                ...(name !== undefined && { name }),
                ...(description !== undefined && { description }),
                ...(applies_to_role !== undefined && { applies_to_role }),
                ...(required_for_assignment !== undefined && { required_for_assignment }),
                ...(valid_for_days !== undefined && { valid_for_days }),
                ...(is_active !== undefined && { is_active })
            };
            const { data, error } = await supabase
                .from('screening_requirements')
                .update(updates)
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return data;
        } else {
            const { data, error } = await supabase
                .from('screening_requirements')
                .insert([{
                    code: code || name.toLowerCase().replace(/\s+/g, '_'),
                    name,
                    description: description || null,
                    applies_to_role: applies_to_role || 'maintenance',
                    required_for_assignment: required_for_assignment !== undefined ? required_for_assignment : true,
                    valid_for_days: valid_for_days !== undefined ? parseInt(valid_for_days, 10) : 365,
                    is_active: is_active !== undefined ? is_active : true
                }])
                .select()
                .single();
            if (error) throw error;
            return data;
        }
    },

    // ── Screening Records ───────────────────────────────────────────────────
    async getScreeningRecordsByUserId(userId) {
        const { data, error } = await supabase
            .from('screening_records')
            .select(`
                *,
                requirement:screening_requirements (
                    id,
                    code,
                    name,
                    description,
                    required_for_assignment,
                    valid_for_days,
                    is_active
                ),
                reviewer:users!screening_records_reviewed_by_fkey (
                    id,
                    full_name,
                    email
                )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data || [];
    },

    async getAllScreeningRecords() {
        const { data, error } = await supabase
            .from('screening_records')
            .select(`
                *,
                user:users!screening_records_user_id_fkey (
                    id,
                    full_name,
                    email,
                    role,
                    account_status,
                    contact_number
                ),
                requirement:screening_requirements (
                    id,
                    code,
                    name,
                    description,
                    required_for_assignment,
                    valid_for_days
                ),
                reviewer:users!screening_records_reviewed_by_fkey (
                    id,
                    full_name,
                    email
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async findScreeningRecordById(id) {
        const { data, error } = await supabase
            .from('screening_records')
            .select(`
                *,
                requirement:screening_requirements (
                    id,
                    code,
                    name,
                    valid_for_days,
                    required_for_assignment
                )
            `)
            .eq('id', id)
            .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;
        return data || null;
    },

    async findScreeningRecordByUserAndRequirement(userId, requirementId) {
        const { data, error } = await supabase
            .from('screening_records')
            .select('*')
            .eq('user_id', userId)
            .eq('requirement_id', requirementId)
            .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;
        return data || null;
    },

    async createScreeningRecord(recordData) {
        const { data, error } = await supabase
            .from('screening_records')
            .insert([{
                ...recordData,
                status: recordData.status || 'pending',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async updateScreeningRecord(id, updateData) {
        const { data, error } = await supabase
            .from('screening_records')
            .update({
                ...updateData,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // ── Skills ──────────────────────────────────────────────────────────────
    async getSkillsByUserId(userId) {
        const { data, error } = await supabase
            .from('maintenance_personnel_skills')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data || [];
    },

    async syncSkills(userId, skillsArray = []) {
        // Delete existing skills
        await supabase
            .from('maintenance_personnel_skills')
            .delete()
            .eq('user_id', userId);

        if (!skillsArray || skillsArray.length === 0) return [];

        const rows = skillsArray.map(s => {
            if (typeof s === 'string') {
                return {
                    user_id: userId,
                    skill_name: s.trim(),
                    proficiency_level: 'proficient'
                };
            }
            return {
                user_id: userId,
                skill_name: s.skill_name || s.name || '',
                proficiency_level: s.proficiency_level || 'proficient'
            };
        }).filter(r => r.skill_name);

        if (rows.length === 0) return [];

        const { data, error } = await supabase
            .from('maintenance_personnel_skills')
            .insert(rows)
            .select();

        if (error) throw error;
        return data || [];
    },

    // ── Global Maintenance Pool Users ───────────────────────────────────────
    async findAllMaintenanceUsers() {
        const { data, error } = await supabase
            .from('users')
            .select(`
                id,
                full_name,
                email,
                role,
                contact_number,
                address,
                profile_image_url,
                is_verified,
                account_status,
                created_at,
                updated_at
            `)
            .eq('role', 'maintenance')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    // ── Assignment with Compliance Verification ─────────────────────────────
    async createVerifiedAssignment(assignmentData) {
        const {
            maintenance_request_id,
            maintenance_personnel_id,
            due_date,
            instructions,
            compliance_verified_by
        } = assignmentData;

        const { data, error } = await supabase
            .from('maintenance_assignments')
            .insert([{
                maintenance_request_id,
                maintenance_personnel_id,
                due_date,
                instructions: instructions || null,
                assigned_at: new Date().toISOString(),
                compliance_verified: true,
                compliance_verified_at: new Date().toISOString(),
                compliance_verified_by
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // ── Open Maintenance Requests for Global Pool Assignment ────────────────
    async getOpenRequests() {
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
                properties:properties (
                    id,
                    property_name
                )
            `)
            .in('status', ['pending', 'approved'])
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    }
};

module.exports = maintenancePersonnelModel;
