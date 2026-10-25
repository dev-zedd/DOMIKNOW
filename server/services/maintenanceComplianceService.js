const supabase = require('../config/supabaseClient');
const userModel = require('../models/userModel');
const maintenanceModel = require('../models/maintenanceModel');
const maintenancePersonnelModel = require('../models/maintenancePersonnelModel');
const auditLogModel = require('../models/auditLogModel');
const notificationModel = require('../models/notificationModel');

const DEFAULT_REQUIREMENTS = [
    {
        code: 'background_check',
        name: 'Background Check',
        description: 'Employment and criminal background screening for maintenance personnel.',
        applies_to_role: 'maintenance',
        required_for_assignment: true,
        valid_for_days: 365,
        is_active: true
    },
    {
        code: 'safety_training',
        name: 'Safety Training',
        description: 'Mandatory workplace safety, hazardous materials, and site compliance induction.',
        applies_to_role: 'maintenance',
        required_for_assignment: true,
        valid_for_days: 365,
        is_active: true
    },
    {
        code: 'certifications',
        name: 'Certification Verification',
        description: 'Required trade licenses, government certifications, and technical qualifications check.',
        applies_to_role: 'maintenance',
        required_for_assignment: true,
        valid_for_days: 365,
        is_active: true
    },
    {
        code: 'site_access_training',
        name: 'Site Access Training',
        description: 'Site-specific security protocol, tenant privacy, and facility induction training.',
        applies_to_role: 'maintenance',
        required_for_assignment: true,
        valid_for_days: 180,
        is_active: true
    }
];

const maintenanceComplianceService = {
    /**
     * Ensure default screening requirements exist in database
     */
    async initDefaultRequirements() {
        const existing = await maintenancePersonnelModel.getScreeningRequirements('maintenance');
        const existingCodes = new Set((existing || []).map(r => r.code));

        for (const req of DEFAULT_REQUIREMENTS) {
            if (!existingCodes.has(req.code)) {
                await maintenancePersonnelModel.upsertScreeningRequirement(req);
            }
        }
    },

    /**
     * Initialize profile, screening records, and access record for a maintenance user
     */
    async initStaffRecords(userId, options = {}) {
        await this.initDefaultRequirements();

        // 1. Ensure profile exists
        let profile = await maintenancePersonnelModel.findProfileByUserId(userId);
        if (!profile) {
            profile = await maintenancePersonnelModel.upsertProfile(userId, {
                employee_number: options.employee_number || `EMP-${Date.now().toString().slice(-6)}`,
                department: options.department || 'General Maintenance',
                supervisor_user_id: options.supervisor_user_id || null,
                certifications: options.certifications || '',
                service_area: options.service_area || 'Global / All Properties',
                availability_status: 'available',
                is_active: true
            });
        }

        // 2. Ensure initial maintenance_access record exists
        let access = await maintenancePersonnelModel.findAccessByUserId(userId);
        if (!access) {
            access = await maintenancePersonnelModel.upsertAccess(userId, {
                access_status: 'pending',
                granted_by: options.created_by || null,
                granted_at: new Date().toISOString(),
                restriction_reason: 'Pending initial screening verification'
            });
        }

        // 3. Ensure screening_records exist for each requirement
        const requirements = await maintenancePersonnelModel.getScreeningRequirements('maintenance');
        const existingRecords = await maintenancePersonnelModel.getScreeningRecordsByUserId(userId);
        const existingReqIds = new Set((existingRecords || []).map(r => r.requirement_id));

        for (const req of requirements) {
            if (!existingReqIds.has(req.id)) {
                await maintenancePersonnelModel.createScreeningRecord({
                    user_id: userId,
                    requirement_id: req.id,
                    status: 'pending',
                    submitted_at: null,
                    reviewed_at: null,
                    reviewed_by: null,
                    expires_at: null,
                    notes: 'Initial requirement automatically assigned during onboarding'
                });
            }
        }

        return { profile, access };
    },

    /**
     * Auto-expire screening records and maintenance access if expires_at is past
     */
    async evaluateRecordExpiration(userId) {
        const now = new Date();

        // Check screening records
        const records = await maintenancePersonnelModel.getScreeningRecordsByUserId(userId);
        for (const rec of records) {
            if (rec.expires_at && new Date(rec.expires_at) < now) {
                if (rec.status === 'approved' || rec.status === 'conditional') {
                    await maintenancePersonnelModel.updateScreeningRecord(rec.id, {
                        status: 'expired',
                        notes: (rec.notes ? rec.notes + ' | ' : '') + `Automatically expired on ${now.toISOString()}`
                    });
                    await auditLogModel.log(
                        userId,
                        'SCREENING_EXPIRED',
                        `Screening record for requirement ${rec.requirement?.name || rec.requirement_id} expired.`
                    );
                }
            }
        }

        // Check maintenance access
        const access = await maintenancePersonnelModel.findAccessByUserId(userId);
        if (access && access.expires_at && new Date(access.expires_at) < now) {
            if (access.access_status === 'approved' || access.access_status === 'restricted') {
                await maintenancePersonnelModel.upsertAccess(userId, {
                    access_status: 'expired',
                    restriction_reason: `Access validity expired on ${now.toISOString()}`
                });
                await auditLogModel.log(
                    userId,
                    'ACCESS_EXPIRED',
                    `Maintenance access automatically expired for user ${userId}.`
                );
            }
        }

        // Call database RPC trigger if present
        try {
            await supabase.rpc('refresh_maintenance_access_status_for_user', { p_user_id: userId });
        } catch (rpcErr) {
            // Non-critical if RPC not available
        }
    },

    /**
     * Check technician assignment eligibility against all 6 business rules
     * Returns: { eligible: boolean, reasons: string[], ...details }
     */
    async checkEligibility(userId) {
        const reasons = [];

        // 1. Fetch user identity
        const user = await userModel.findById(userId);
        if (!user) {
            return {
                eligible: false,
                reasons: ['User not found in system database.'],
                technician: null
            };
        }

        // Run auto-expiration check
        await this.evaluateRecordExpiration(userId);

        // Fetch refreshed access, profile, records, and requirements
        const [profile, access, records, requirements, skills] = await Promise.all([
            maintenancePersonnelModel.findProfileByUserId(userId),
            maintenancePersonnelModel.findAccessByUserId(userId),
            maintenancePersonnelModel.getScreeningRecordsByUserId(userId),
            maintenancePersonnelModel.getScreeningRequirements('maintenance'),
            maintenancePersonnelModel.getSkillsByUserId(userId)
        ]);

        // Rule 1: Role must be maintenance
        if (user.role !== 'maintenance') {
            reasons.push(`User role is '${user.role}' (must be 'maintenance').`);
        }

        // Rule 2: Account status must be active
        if (user.account_status !== 'active') {
            reasons.push(`User account status is '${user.account_status}' (must be 'active').`);
        }

        // Rule 3: Email must be verified
        if (!user.is_verified) {
            reasons.push('User email is not verified.');
        }

        // Rule 4: Profile is_active must be true
        if (!profile || !profile.is_active) {
            reasons.push('Maintenance personnel profile is inactive or not initialized.');
        }

        // Rule 5: Availability status must not be on_leave or offline
        const availability = (profile?.availability_status || 'available').toLowerCase();
        if (availability === 'on_leave' || availability === 'offline') {
            reasons.push(`Technician availability is marked as '${availability}' (cannot receive assignments).`);
        }

        // Rule 6: Maintenance access access_status must be 'approved' or 'restricted'
        if (!access) {
            reasons.push('No maintenance access record has been granted.');
        } else {
            const validAccess = ['approved', 'restricted'];
            if (!validAccess.includes(access.access_status)) {
                reasons.push(`Maintenance access status is '${access.access_status}' (must be 'approved' or 'restricted').`);
            }
        }

        // Rule 7: All required screening requirements must be 'approved' or 'conditional' and unexpired
        const requiredList = requirements.filter(r => r.required_for_assignment && r.is_active);
        const recordMap = new Map();
        for (const rec of (records || [])) {
            recordMap.set(rec.requirement_id, rec);
        }

        const now = new Date();
        for (const req of requiredList) {
            const rec = recordMap.get(req.id);
            if (!rec) {
                reasons.push(`Missing required screening requirement: '${req.name}'.`);
            } else {
                const allowedStatus = ['approved', 'conditional'];
                if (!allowedStatus.includes(rec.status)) {
                    reasons.push(`Screening '${req.name}' status is '${rec.status}' (must be approved or conditional).`);
                } else if (rec.expires_at && new Date(rec.expires_at) < now) {
                    reasons.push(`Screening '${req.name}' expired on ${new Date(rec.expires_at).toLocaleDateString()}.`);
                }
            }
        }

        const eligible = reasons.length === 0;

        return {
            eligible,
            reasons,
            technician: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
                account_status: user.account_status,
                is_verified: user.is_verified,
                contact_number: user.contact_number,
                address: user.address,
                profile_image_url: user.profile_image_url
            },
            profile: profile || null,
            access: access || null,
            screeningRecords: records || [],
            requirements: requiredList,
            skills: skills || []
        };
    },

    /**
     * Get global maintenance pool with computed eligibility and reasons
     */
    async getGlobalPool(options = {}) {
        const { filterEligibleOnly = false, searchQuery = '', department = '' } = options;

        const users = await maintenancePersonnelModel.findAllMaintenanceUsers();
        const pool = [];

        for (const u of users) {
            const compliance = await this.checkEligibility(u.id);

            // Filter if requested
            if (filterEligibleOnly && !compliance.eligible) {
                continue;
            }

            // Department filter
            if (department && compliance.profile?.department) {
                if (compliance.profile.department.toLowerCase() !== department.toLowerCase()) {
                    continue;
                }
            }

            // Search query filter
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const matchName = u.full_name?.toLowerCase().includes(q);
                const matchEmail = u.email?.toLowerCase().includes(q);
                const matchDept = compliance.profile?.department?.toLowerCase().includes(q);
                const matchArea = compliance.profile?.service_area?.toLowerCase().includes(q);
                const matchSkills = compliance.skills?.some(s => s.skill_name?.toLowerCase().includes(q));

                if (!matchName && !matchEmail && !matchDept && !matchArea && !matchSkills) {
                    continue;
                }
            }

            pool.push({
                ...compliance.technician,
                is_eligible: compliance.eligible,
                eligibility_reasons: compliance.reasons,
                profile: compliance.profile,
                access: compliance.access,
                screening_records: compliance.screeningRecords,
                skills: compliance.skills
            });
        }

        return pool;
    },

    /**
     * Assign a technician to a maintenance request with strict compliance enforcement
     */
    async assignTechnician({ requestId, technicianId, dueDate, instructions, assignedByUserId }) {
        if (!requestId || !technicianId || !dueDate) {
            throw new Error('Request ID, technician ID, and due date are required for assignment.');
        }

        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!UUID_REGEX.test(requestId)) {
            throw new Error('Invalid UUID format for maintenance request ID.');
        }
        if (!UUID_REGEX.test(technicianId)) {
            throw new Error('Invalid UUID format for technician ID.');
        }

        // 1. Check request existence
        const request = await maintenanceModel.findRequestDetails(requestId);
        if (!request) {
            throw new Error('Maintenance request not found.');
        }

        // 2. Validate compliance eligibility
        const compliance = await this.checkEligibility(technicianId);
        if (!compliance.eligible) {
            const reasonText = compliance.reasons.join('; ');
            throw new Error(`Assignment Blocked: Technician is not eligible. ${reasonText}`);
        }

        // 3. Create verified assignment record
        const assignment = await maintenancePersonnelModel.createVerifiedAssignment({
            maintenance_request_id: requestId,
            maintenance_personnel_id: technicianId,
            due_date: dueDate,
            instructions: instructions || 'Perform required repair per task details.',
            compliance_verified_by: assignedByUserId
        });

        // 4. Update request status to 'assigned'
        const updatedRequest = await maintenanceModel.updateRequestStatus(requestId, {
            assigned_maintenance_id: technicianId,
            status: 'assigned',
            landlord_remarks: instructions || null,
            screening_status: 'verified'
        });

        // 5. Create progress update log
        await maintenanceModel.createProgressUpdate({
            maintenance_request_id: requestId,
            status_update: 'assigned',
            notes: `Assigned to ${compliance.technician.full_name} with verified compliance by Administrator.`
        });

        // 6. Audit log
        await auditLogModel.log(
            assignedByUserId,
            'MAINTENANCE_ASSIGNMENT',
            `Assigned technician ${compliance.technician.full_name} (${technicianId}) to request ${requestId}. Compliance verified.`
        );

        // 7. Notification for technician
        await notificationModel.create({
            user_id: technicianId,
            type: 'maintenance_assigned',
            title: 'New Maintenance Work Order Assigned',
            message: `You have been assigned to: ${request.issue_title}. Due date: ${dueDate}.`,
            reference_id: requestId
        });

        // 8. Notification for tenant
        await notificationModel.create({
            user_id: request.tenant_id,
            type: 'maintenance_assigned',
            title: 'Technician Assigned',
            message: `A certified technician (${compliance.technician.full_name}) has been assigned to your request: ${request.issue_title}.`,
            reference_id: requestId
        });

        return {
            assignment,
            request: updatedRequest,
            technician: compliance.technician
        };
    }
};

module.exports = maintenanceComplianceService;
