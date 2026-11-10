require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const supabase = require('../server/config/supabaseClient');
const maintenanceComplianceService = require('../server/services/maintenanceComplianceService');
const maintenancePersonnelModel = require('../server/models/maintenancePersonnelModel');

const SAMPLE_BEFORE_PHOTO = 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=800&q=80';
const SAMPLE_AFTER_PHOTO = 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80';

async function seedMaintenanceWorkflowDemo() {
    console.log('=== Starting Maintenance Workflow & Compliance Demo Seed ===');

    // 1. Fetch users
    const { data: users, error: uErr } = await supabase
        .from('users')
        .select('id, full_name, email, role');
    if (uErr) throw uErr;

    const userByEmail = {};
    users.forEach(u => {
        if (u.email) userByEmail[u.email.toLowerCase()] = u;
    });

    const adminUser = users.find(u => u.role === 'admin') || users[0];

    // 2. Certify and configure the 5 Demo Maintenance Workers from DEMO_ACCOUNTS.txt
    const demoWorkersConfig = [
        {
            email: 'khaha4221@gmail.com',
            employee_number: 'EMP-202601',
            department: 'Plumbing & General Maintenance',
            certifications: 'TESDA NC II Plumbing, OSHA Safety Certified',
            service_area: 'Siniloan, Laguna (All Properties)',
            skills: ['Plumbing & Pipe Fitting', 'Leak & Drain Repair', 'Water Heater & Valve Repair', 'General Handyman']
        },
        {
            email: 'worker01@domiknow.com',
            employee_number: 'EMP-202602',
            department: 'Electrical & HVAC Services',
            certifications: 'Registered Master Electrician (RME), TESDA NC II RAC Servicing',
            service_area: 'Siniloan, Laguna (All Properties)',
            skills: ['Electrical Wiring & Breaker Panel', 'Aircon & HVAC Servicing', 'Lighting & Outlets', 'General Maintenance']
        },
        {
            email: 'worker02@domiknow.com',
            employee_number: 'EMP-202603',
            department: 'Carpentry, Structural & Roofing',
            certifications: 'TESDA NC II Carpentry & Masonry, Working at Heights Certified',
            service_area: 'Siniloan, Laguna (All Properties)',
            skills: ['Door & Locksmith Carpentry', 'Roofing & Waterproofing', 'Gutter & Ceiling Repair', 'Plumbing', 'General Handyman']
        },
        {
            email: 'worker03@domiknow.com',
            employee_number: 'EMP-202604',
            department: 'Appliance, Telecom & Electrical',
            certifications: 'TESDA NC II Consumer Electronics & Fiber Optic Cabling',
            service_area: 'Siniloan, Laguna (All Properties)',
            skills: ['Appliance Diagnostics & Repair', 'Internet, WiFi & Fiber Cabling', 'Electrical & Fixtures', 'General Maintenance']
        },
        {
            email: 'worker04@domiknow.com',
            employee_number: 'EMP-202605',
            department: 'Multi-Trade Facility Maintenance',
            certifications: 'TESDA NC II Facilities Maintenance, HVAC & Plumbing Accredited',
            service_area: 'Siniloan, Laguna (All Properties)',
            skills: ['Aircon & Cooling Systems', 'Plumbing & Drainage', 'Electrical Repair', 'Door & Carpentry', 'General Handyman']
        }
    ];

    await maintenanceComplianceService.initDefaultRequirements();
    const requirements = await maintenancePersonnelModel.getScreeningRequirements('maintenance');
    const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    for (const cfg of demoWorkersConfig) {
        const worker = userByEmail[cfg.email];
        if (!worker) {
            console.warn(`Worker account ${cfg.email} not found, skipping.`);
            continue;
        }

        // Ensure user is active and verified
        await supabase
            .from('users')
            .update({ account_status: 'active', is_verified: true })
            .eq('id', worker.id);

        // Initialize profile & records
        await maintenanceComplianceService.initStaffRecords(worker.id, {
            employee_number: cfg.employee_number,
            department: cfg.department,
            certifications: cfg.certifications,
            service_area: cfg.service_area,
            created_by: adminUser.id
        });

        // Update profile to active & available
        await maintenancePersonnelModel.upsertProfile(worker.id, {
            employee_number: cfg.employee_number,
            department: cfg.department,
            certifications: cfg.certifications,
            service_area: cfg.service_area,
            availability_status: 'available',
            is_active: true
        });

        // Approve maintenance access
        await maintenancePersonnelModel.upsertAccess(worker.id, {
            access_status: 'approved',
            granted_by: adminUser.id,
            granted_at: nowIso,
            expires_at: oneYearFromNow,
            restriction_reason: null
        });

        // Approve all required screening records
        const records = await maintenancePersonnelModel.getScreeningRecordsByUserId(worker.id);
        for (const rec of records) {
            await maintenancePersonnelModel.updateScreeningRecord(rec.id, {
                status: 'approved',
                submitted_at: nowIso,
                reviewed_at: nowIso,
                reviewed_by: adminUser.id,
                expires_at: oneYearFromNow,
                notes: `Verified and certified by Administrator (${cfg.certifications})`
            });
        }

        // Sync skills
        await maintenancePersonnelModel.syncSkills(worker.id, cfg.skills);

        const check = await maintenanceComplianceService.checkEligibility(worker.id);
        console.log(`✔ Certified worker ${worker.full_name} (${cfg.email}): eligible=${check.eligible}`);
    }

    // 3. Fetch active leases for demo tenants
    const { data: activeLeases, error: lErr } = await supabase
        .from('lease_records')
        .select('id, tenant_id, landlord_id, property_id, lease_status')
        .eq('lease_status', 'active');
    if (lErr) throw lErr;

    const leaseByTenantEmail = {};
    for (const l of activeLeases) {
        const tenantUser = users.find(u => u.id === l.tenant_id);
        if (tenantUser && tenantUser.email) {
            leaseByTenantEmail[tenantUser.email.toLowerCase()] = l;
        }
    }

    // 4. Clean up old placeholder maintenance requests ("adawdwawadaawdwadawd", "sefsefsef", "DADA", or previous demo seeds)
    const { data: existingReqs } = await supabase
        .from('maintenance_requests')
        .select('id, issue_title');

    const demoTitles = new Set([
        'adawdwawadaawdwadawd',
        'sefsefsef',
        'DADA',
        'Bathroom Shower Head & Faucet Low Water Pressure',
        'Flickering Fluorescent Light & Loose Wall Outlet',
        '2nd Floor Hallway Emergency Light & Breaker Inspection',
        'Kitchen Sink P-Trap Pipe Leak Under Cabinet',
        'Window-Type Aircon Not Cooling & Making Rattling Noise',
        'Circuit Breaker Tripping When Using Kitchen Outlet',
        'Main Entry Door Deadbolt Jammed & Frame Misaligned',
        'Fiber Internet Wall Jack Damaged & Patch Cord Cut',
        'Ceiling Flashing Water Seepage Near Bedroom Window',
        'Toilet Flush Valve & Fill Mechanism Replacement',
        'Refrigerator Thermostat & Door Gasket Replacement',
        'Split-Type Aircon Deep Chemical Cleaning & Drain Flush'
    ]);

    const idsToDelete = (existingReqs || [])
        .filter(r => demoTitles.has(r.issue_title))
        .map(r => r.id);

    if (idsToDelete.length > 0) {
        await supabase.from('maintenance_requests').delete().in('id', idsToDelete);
        console.log(`Cleaned up ${idsToDelete.length} existing placeholder/demo maintenance requests.`);
    }

    // Helper for relative dates
    const daysAgo = (d) => new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();
    const daysFromNow = (d) => new Date(Date.now() + d * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const roque = userByEmail['khaha4221@gmail.com'];
    const allan = userByEmail['worker01@domiknow.com'];
    const ramon = userByEmail['worker02@domiknow.com'];
    const danilo = userByEmail['worker03@domiknow.com'];
    const victor = userByEmail['worker04@domiknow.com'];

    // 5. Define 12 realistic maintenance requests across all workflow stages
    const scenarios = [
        // 1. PENDING (New request from Tenant #1 awaiting review)
        {
            tenantEmail: 'tenant01@domiknow.com',
            unit_number: 'Unit 101',
            issue_title: 'Bathroom Shower Head & Faucet Low Water Pressure',
            issue_description: 'Water flow from the bathroom shower head and lavatory faucet has dropped significantly over the past three days. Possible sediment blockage in the aerator or supply valve.',
            issue_category: 'plumbing',
            priority_level: 'medium',
            status: 'pending',
            preferred_schedule: 'Weekdays 9:00 AM - 12:00 PM',
            created_at: daysAgo(1),
            worker: null,
            updates: [
                { status_update: 'pending', notes: 'Maintenance request submitted by tenant Juan dela Cruz.', created_at: daysAgo(1) }
            ]
        },

        // 2. APPROVED (Approved by Landlord #1, ready for Admin/Landlord Technician Dispatch)
        {
            tenantEmail: 'tenant02@domiknow.com',
            unit_number: 'Unit 102',
            issue_title: 'Flickering Fluorescent Light & Loose Wall Outlet',
            issue_description: 'The main ceiling LED tube light in the study area flickers constantly and the duplex convenience outlet near the desk feels loose when plugging in a laptop charger.',
            issue_category: 'electrical',
            priority_level: 'high',
            status: 'approved',
            preferred_schedule: 'Anytime between 1:00 PM - 5:00 PM',
            landlord_remarks: 'Approved by property owner. Ready for certified electrician dispatch.',
            created_at: daysAgo(2),
            worker: null,
            updates: [
                { status_update: 'pending', notes: 'Maintenance request submitted by tenant Maria Santos.', created_at: daysAgo(2) },
                { status_update: 'approved', notes: 'Landlord Ricardo Dela Torre approved the request for technician dispatch.', created_at: daysAgo(1.5) }
            ]
        },

        // 3. APPROVED - Landlord-Initiated Common Area Work Order (Landlord #2)
        {
            tenantEmail: 'tenant05@domiknow.com',
            unit_number: 'Common Area / 2F Hallway',
            issue_title: '2nd Floor Hallway Emergency Light & Breaker Inspection',
            issue_description: 'Routine preventive inspection and battery test for the 2nd floor hallway emergency lighting units and sub-panel circuit breakers.',
            issue_category: 'electrical',
            priority_level: 'medium',
            status: 'approved',
            preferred_schedule: daysFromNow(2),
            recommendations: '[INITIATED_BY:LANDLORD][SCOPE:COMMON_AREA][LIABILITY:PENDING_ADMIN_DETERMINATION][BASIS:ART_1654_MAINTENANCE] Work order initiated by property owner under Civil Code Art. 1654.',
            landlord_remarks: 'Preventive facility work order initiated by Maricel Ocampo.',
            created_at: daysAgo(2),
            worker: null,
            updates: [
                { status_update: 'approved', notes: 'Work order submitted directly by Property Owner (Ocampo Student Bedspace). Pre-approved for technician dispatch under Civil Code Art. 1654.', created_at: daysAgo(2) }
            ]
        },

        // 4. ASSIGNED (Dispatched to Roque Mendoza - awaiting technician acceptance)
        {
            tenantEmail: 'tenant03@domiknow.com',
            unit_number: 'Studio 201',
            issue_title: 'Kitchen Sink P-Trap Pipe Leak Under Cabinet',
            issue_description: 'Water is dripping from the PVC P-trap union underneath the kitchen sink whenever dishes are washed. Cabinet floor is getting damp.',
            issue_category: 'plumbing',
            priority_level: 'high',
            status: 'assigned',
            preferred_schedule: daysFromNow(1),
            landlord_remarks: 'Dispatched to Roque Mendoza. Please bring replacement 1-1/2 inch PVC trap fittings and Teflon tape.',
            screening_status: 'approved',
            created_at: daysAgo(3),
            worker: roque,
            due_date: daysFromNow(1),
            instructions: 'Inspect P-trap slip joint nuts and washer seal under kitchen sink; replace assembly if threads are stripped.',
            updates: [
                { status_update: 'pending', notes: 'Maintenance request submitted by tenant Carlo Reyes.', created_at: daysAgo(3) },
                { status_update: 'approved', notes: 'Landlord approved request.', created_at: daysAgo(2.5) },
                { status_update: 'assigned', notes: 'Assigned to Roque Mendoza with verified compliance by Administrator.', created_at: daysAgo(1) }
            ]
        },

        // 5. ASSIGNED (Dispatched to Allan Bautista - awaiting technician acceptance)
        {
            tenantEmail: 'tenant05@domiknow.com',
            unit_number: 'Bedspace Room B2',
            issue_title: 'Window-Type Aircon Not Cooling & Making Rattling Noise',
            issue_description: 'The 1.0 HP window-type aircon blows warm air even at thermostat setting 16°C and makes a metallic rattling sound when the compressor kicks in.',
            issue_category: 'aircon',
            priority_level: 'high',
            status: 'assigned',
            preferred_schedule: daysFromNow(2),
            landlord_remarks: 'Assigned to certified HVAC technician Allan Bautista for diagnostic check.',
            screening_status: 'approved',
            created_at: daysAgo(2.5),
            worker: allan,
            due_date: daysFromNow(2),
            instructions: 'Check blower wheel alignment, capacitor rating, and evaporator coil cleanliness.',
            updates: [
                { status_update: 'pending', notes: 'Maintenance request submitted by tenant Kevin Bautista.', created_at: daysAgo(2.5) },
                { status_update: 'approved', notes: 'Landlord Maricel Ocampo approved request.', created_at: daysAgo(2) },
                { status_update: 'assigned', notes: 'Assigned to Allan Bautista with verified compliance by Administrator.', created_at: daysAgo(0.8) }
            ]
        },

        // 6. TRAVELLING (Accepted by Allan Bautista & currently en route to property)
        {
            tenantEmail: 'tenant07@domiknow.com',
            unit_number: 'Apt 3A',
            issue_title: 'Circuit Breaker Tripping When Using Kitchen Outlet',
            issue_description: 'The 20A branch circuit breaker trips whenever the microwave and rice cooker are plugged into the kitchen counter receptacle.',
            issue_category: 'electrical',
            priority_level: 'emergency',
            status: 'travelling',
            travel_started_at: daysAgo(0.1),
            preferred_schedule: daysFromNow(0),
            landlord_remarks: 'Urgent electrical safety check dispatched to Allan Bautista.',
            screening_status: 'approved',
            created_at: daysAgo(2),
            worker: allan,
            due_date: daysFromNow(0),
            instructions: 'Perform load test and inspect kitchen GFCI outlet wiring for short or ground fault.',
            updates: [
                { status_update: 'pending', notes: 'Emergency electrical request reported by Mark Villanueva.', created_at: daysAgo(2) },
                { status_update: 'approved', notes: 'Approved immediately for urgent electrical dispatch.', created_at: daysAgo(1.8) },
                { status_update: 'assigned', notes: 'Dispatched to Allan Bautista.', created_at: daysAgo(1) },
                { status_update: 'accepted', notes: 'Technician accepted the job assignment.', created_at: daysAgo(0.4) },
                { status_update: 'travelling', notes: 'Technician is travelling / on the way to the property.', created_at: daysAgo(0.1) }
            ]
        },

        // 7. INSPECTION_SUBMITTED (Ramon Cruz arrived & submitted ocular diagnosis + quote; awaiting Admin Liability Ruling)
        {
            tenantEmail: 'tenant09@domiknow.com',
            unit_number: 'Room 104',
            issue_title: 'Main Entry Door Deadbolt Jammed & Frame Misaligned',
            issue_description: 'The solid wood entry door sags slightly on the top hinge, causing the deadbolt latch to bind against the strike plate.',
            issue_category: 'door',
            priority_level: 'high',
            status: 'arrived', // resolved to 'inspection_submitted' via tags
            travel_started_at: daysAgo(1.5),
            arrived_at: daysAgo(1.4),
            problem_found: 'Top butt hinge screws stripped due to natural wood expansion and wear; Cylindrical deadbolt latch mechanism worn out.',
            recommendations: '[TECH_FINDINGS:Top butt hinge screws stripped due to natural wood expansion and wear; Cylindrical deadbolt latch mechanism worn out.][TECH_RECOMMENDED_LIABILITY:LANDLORD][TECH_BASIS:ART_1654_WEAR_AND_TEAR][LIABILITY:PENDING_ADMIN_DETERMINATION][QUOTE:PENDING_ADMIN_VALIDATION] Replace heavy-duty deadbolt lockset and reinforce top hinge with 3-inch anchor screws.',
            before_photo_url: SAMPLE_BEFORE_PHOTO,
            labor_cost: 450.00,
            material_cost: 680.00,
            preferred_schedule: daysFromNow(1),
            landlord_remarks: 'Dispatched to Ramon Cruz for ocular inspection.',
            screening_status: 'approved',
            created_at: daysAgo(4),
            worker: ramon,
            due_date: daysFromNow(1),
            instructions: 'Inspect door alignment and lock mechanism; submit ocular quotation.',
            materials: [
                { material_name: 'Heavy-Duty Cylindrical Deadbolt Lockset', quantity: 1, cost: 520.00 },
                { material_name: 'Stainless Steel Ball-Bearing Hinge Pair (4x4)', quantity: 1, cost: 160.00 }
            ],
            updates: [
                { status_update: 'pending', notes: 'Submitted by Paolo Ramos.', created_at: daysAgo(4) },
                { status_update: 'assigned', notes: 'Dispatched to Ramon Cruz.', created_at: daysAgo(2) },
                { status_update: 'accepted', notes: 'Technician accepted the job assignment.', created_at: daysAgo(1.7) },
                { status_update: 'travelling', notes: 'Technician is travelling to the property.', created_at: daysAgo(1.5) },
                { status_update: 'arrived', notes: 'Technician arrived at unit Room 104.', created_at: daysAgo(1.4) },
                { status_update: 'inspection_submitted', notes: 'Technician submitted diagnostic assessment. Findings: Top butt hinge screws stripped due to natural wood expansion and wear. Proposed liability: LANDLORD (ART_1654_WEAR_AND_TEAR). Quote: ₱1130.00.', created_at: daysAgo(1.2) }
            ]
        },

        // 8. QUOTE_PENDING (Admin ruled Tenant Liability Art. 1657; awaiting Tenant #11 quote approval)
        {
            tenantEmail: 'tenant11@domiknow.com',
            unit_number: 'Room 202',
            issue_title: 'Fiber Internet Wall Jack Damaged & Patch Cord Cut',
            issue_description: 'The fiber optic terminal box on the wall was accidentally pulled loose while moving furniture, snapping the SC/APC fiber patch cord.',
            issue_category: 'internet',
            priority_level: 'medium',
            status: 'arrived', // resolved to 'quote_pending' via tags
            travel_started_at: daysAgo(2.4),
            arrived_at: daysAgo(2.3),
            problem_found: 'Surface-mount fiber optic faceplate cracked from physical pull and SC/APC patch cable severed.',
            recommendations: '[LIABILITY:TENANT][BASIS:ART_1657_NEGLIGENCE][QUOTE:PENDING_APPROVAL][ADMIN_ADJUDICATED:TRUE] Replace SC/APC simplex fiber patch cord and re-terminate wall optical outlet box. (Admin notes: Physical damage during furniture movement falls under tenant care obligations per Civil Code Art. 1657.)',
            before_photo_url: SAMPLE_BEFORE_PHOTO,
            labor_cost: 400.00,
            material_cost: 550.00,
            preferred_schedule: daysFromNow(1),
            landlord_remarks: 'Admin adjudicated Tenant liability under Art. 1657. Awaiting tenant quotation approval.',
            screening_status: 'approved',
            created_at: daysAgo(5),
            worker: danilo,
            due_date: daysFromNow(1),
            instructions: 'Test optical signal attenuation (dBm) and replace damaged wall terminal and patch cord.',
            materials: [
                { material_name: 'SC/APC to SC/APC Simplex Fiber Optic Patch Cord (3m)', quantity: 1, cost: 320.00 },
                { material_name: 'Surface-Mount Optical Terminal Rosette Box', quantity: 1, cost: 230.00 }
            ],
            updates: [
                { status_update: 'pending', notes: 'Submitted by Ryan Torres.', created_at: daysAgo(5) },
                { status_update: 'assigned', notes: 'Dispatched to Danilo Reyes.', created_at: daysAgo(3) },
                { status_update: 'arrived', notes: 'Technician arrived on-site and inspected fiber terminal.', created_at: daysAgo(2.3) },
                { status_update: 'inspection_submitted', notes: 'Technician submitted diagnostic assessment. Proposed liability: TENANT (ART_1657_NEGLIGENCE). Quote: ₱950.00.', created_at: daysAgo(2.1) },
                { status_update: 'quote_pending', notes: 'Administrator verified liability as TENANT (ART 1657 NEGLIGENCE). Total Quote: ₱950.00.', created_at: daysAgo(1.5) }
            ]
        },

        // 9. REPAIRING (Quote Approved by Landlord #3; Ramon Cruz actively performing repair on-site)
        {
            tenantEmail: 'tenant10@domiknow.com',
            unit_number: 'Room 205',
            issue_title: 'Ceiling Flashing Water Seepage Near Bedroom Window',
            issue_description: 'During heavy rain, water stains appear along the ceiling corner above the bedroom window frame.',
            issue_category: 'roof',
            priority_level: 'high',
            status: 'repairing',
            travel_started_at: daysAgo(2.0),
            arrived_at: daysAgo(1.9),
            repair_started_at: daysAgo(0.5),
            problem_found: 'Weathered exterior roof-to-wall metal flashing sealant cracked from sun exposure, allowing rainwater ingress.',
            recommendations: '[LIABILITY:LANDLORD][BASIS:ART_1654_WEAR_AND_TEAR][QUOTE:APPROVED][ADMIN_ADJUDICATED:TRUE] Apply elastomeric waterproofing membrane, reseal GI flashing with polyurethane sealant, and repaint interior ceiling corner.',
            before_photo_url: SAMPLE_BEFORE_PHOTO,
            labor_cost: 800.00,
            material_cost: 1050.00,
            preferred_schedule: daysFromNow(0),
            landlord_remarks: 'Quotation approved by Landlord Eduardo Espiritu. Proceed with waterproofing repair.',
            screening_status: 'approved',
            created_at: daysAgo(6),
            worker: ramon,
            due_date: daysFromNow(0),
            instructions: 'Reseal roof flashing exterior joint and apply 2 coats of elastomeric waterproofing.',
            materials: [
                { material_name: 'Elastomeric Waterproofing Roof Sealant (1 Gallon)', quantity: 1, cost: 680.00 },
                { material_name: 'Polyurethane Construction Joint Sealant Tube', quantity: 2, cost: 185.00 }
            ],
            updates: [
                { status_update: 'pending', notes: 'Submitted by Claire Mendoza.', created_at: daysAgo(6) },
                { status_update: 'assigned', notes: 'Dispatched to Ramon Cruz.', created_at: daysAgo(3) },
                { status_update: 'arrived', notes: 'Technician arrived at unit Room 205.', created_at: daysAgo(1.9) },
                { status_update: 'quote_pending', notes: 'Administrator verified liability as LANDLORD (ART 1654 WEAR AND TEAR). Total Quote: ₱1850.00.', created_at: daysAgo(1.2) },
                { status_update: 'quote_approved', notes: 'LANDLORD approved the repair quotation of ₱1850.00. Technician is authorized to begin repairs.', created_at: daysAgo(0.8) },
                { status_update: 'repairing', notes: 'Technician has started repairing the issue.', created_at: daysAgo(0.5) }
            ]
        },

        // 10. COMPLETED (Roque Mendoza finished repair & submitted report; awaiting Landlord #1 verification)
        {
            tenantEmail: 'tenant04@domiknow.com',
            unit_number: 'Studio 202',
            issue_title: 'Toilet Flush Valve & Fill Mechanism Replacement',
            issue_description: 'The toilet tank continuously runs water into the bowl after flushing and takes over 15 minutes to refill.',
            issue_category: 'plumbing',
            priority_level: 'medium',
            status: 'completed',
            travel_started_at: daysAgo(3.5),
            arrived_at: daysAgo(3.4),
            repair_started_at: daysAgo(3.0),
            completed_at: daysAgo(1.0),
            problem_found: ' Deteriorated rubber flapper seal and calcified float fill valve inside the toilet cistern.',
            repair_performed: 'Shut off angle supply valve, drained cistern, replaced complete universal dual-flush valve and fill mechanism, and tested 10 flush cycles with zero leakage.',
            recommendations: '[LIABILITY:LANDLORD][BASIS:ART_1654_WEAR_AND_TEAR][QUOTE:APPROVED][ADMIN_ADJUDICATED:TRUE] Avoid dropping chlorine bleach tablets directly into the cistern tank to preserve rubber seals.',
            before_photo_url: SAMPLE_BEFORE_PHOTO,
            after_photo_url: SAMPLE_AFTER_PHOTO,
            labor_cost: 500.00,
            material_cost: 750.00,
            preferred_schedule: daysAgo(3).split('T')[0],
            landlord_remarks: 'Completed by Roque Mendoza. Pending owner inspection sign-off.',
            screening_status: 'approved',
            created_at: daysAgo(7),
            worker: roque,
            due_date: daysAgo(1).split('T')[0],
            instructions: 'Replace worn cistern fill and flush valve kit; verify no water waste.',
            materials: [
                { material_name: 'Universal Toilet Tank Fill & Dual-Flush Valve Kit', quantity: 1, cost: 580.00 },
                { material_name: 'Braided Stainless Flexible Supply Hose (1/2 x 1/2)', quantity: 1, cost: 170.00 }
            ],
            report: true,
            updates: [
                { status_update: 'pending', notes: 'Submitted by Ana Flores.', created_at: daysAgo(7) },
                { status_update: 'assigned', notes: 'Dispatched to Roque Mendoza.', created_at: daysAgo(4) },
                { status_update: 'accepted', notes: 'Technician accepted the job assignment.', created_at: daysAgo(3.8) },
                { status_update: 'repairing', notes: 'Technician started replacing flush valve assembly.', created_at: daysAgo(3.0) },
                { status_update: 'completed', notes: 'Technician completed the repair and submitted final maintenance report. Total cost: ₱1250.00.', created_at: daysAgo(1.0) }
            ]
        },

        // 11. VERIFIED (Danilo Reyes completed repair, Landlord #4 verified work, payment submitted awaiting final settlement)
        {
            tenantEmail: 'tenant13@domiknow.com',
            unit_number: 'Apt 1B',
            issue_title: 'Refrigerator Thermostat & Door Gasket Replacement',
            issue_description: 'Unit-provided refrigerator forms excessive frost at the back panel and magnetic door gasket no longer seals tightly at the bottom corner.',
            issue_category: 'appliance',
            priority_level: 'medium',
            status: 'verified',
            travel_started_at: daysAgo(8.5),
            arrived_at: daysAgo(8.4),
            repair_started_at: daysAgo(7.5),
            completed_at: daysAgo(5.0),
            problem_found: 'Bimetal defrost thermostat sticking and torn lower magnetic door gasket.',
            repair_performed: 'Replaced defrost thermostat sensor and installed new molded magnetic door gasket; verified stable 4°C cabinet temperature.',
            recommendations: '[LIABILITY:SHARED][BASIS:ART_1654_WEAR_AND_TEAR][QUOTE:APPROVED][ADMIN_ADJUDICATED:TRUE][PAYMENT:WAITING_VERIFICATION][PAID_BY:LANDLORD][METHOD:GCash][REF:GC-20261108-88412][PAY_AMOUNT:1600.00] Keep door seal clean from food residue.',
            before_photo_url: SAMPLE_BEFORE_PHOTO,
            after_photo_url: SAMPLE_AFTER_PHOTO,
            labor_cost: 650.00,
            material_cost: 950.00,
            preferred_schedule: daysAgo(8).split('T')[0],
            landlord_remarks: 'Repair verified by Rosario Manalo. Payment reference GC-20261108-88412 logged.',
            screening_status: 'approved',
            created_at: daysAgo(10),
            worker: danilo,
            due_date: daysAgo(5).split('T')[0],
            instructions: 'Replace thermostat and door gasket on unit refrigerator.',
            materials: [
                { material_name: 'Refrigerator Defrost Thermostat Assembly', quantity: 1, cost: 350.00 },
                { material_name: 'Replacement Magnetic Refrigerator Door Gasket', quantity: 1, cost: 600.00 }
            ],
            report: true,
            updates: [
                { status_update: 'pending', notes: 'Submitted by Ben Soriano.', created_at: daysAgo(10) },
                { status_update: 'assigned', notes: 'Dispatched to Danilo Reyes.', created_at: daysAgo(9) },
                { status_update: 'repairing', notes: 'Technician started appliance repair.', created_at: daysAgo(7.5) },
                { status_update: 'completed', notes: 'Technician completed the repair and submitted report. Total: ₱1600.00.', created_at: daysAgo(5.0) },
                { status_update: 'verified', notes: 'Landlord Rosario Manalo verified repair completion and submitted payment reference GC-20261108-88412.', created_at: daysAgo(3.0) }
            ]
        },

        // 12. CLOSED (Victor Santos completed repair at Landlord #5 property, verified, paid & fully archived)
        {
            tenantEmail: 'tenant15@domiknow.com',
            unit_number: 'Room 101',
            issue_title: 'Split-Type Aircon Deep Chemical Cleaning & Drain Flush',
            issue_description: 'Water droplets condensing along the indoor fan coil louvre and reduced airflow after 6 months of continuous use.',
            issue_category: 'aircon',
            priority_level: 'low',
            status: 'closed',
            travel_started_at: daysAgo(14.5),
            arrived_at: daysAgo(14.4),
            repair_started_at: daysAgo(14.0),
            completed_at: daysAgo(13.5),
            problem_found: 'Clogged condensate drain pan and dust buildup on evaporator coil fins and cross-flow fan.',
            repair_performed: 'Performed full bag-wash chemical cleaning of indoor evaporator unit, nitrogen-flushed condensate drain line, and sanitized air filters.',
            recommendations: '[LIABILITY:LANDLORD][BASIS:ART_1654_WEAR_AND_TEAR][QUOTE:APPROVED][ADMIN_ADJUDICATED:TRUE][PAYMENT:VERIFIED][PAID_BY:LANDLORD][METHOD:GCash][REF:GC-20261028-55190][PAY_AMOUNT:1200.00] Clean mesh filters every 3 weeks and schedule next full servicing in 6 months.',
            before_photo_url: SAMPLE_BEFORE_PHOTO,
            after_photo_url: SAMPLE_AFTER_PHOTO,
            labor_cost: 850.00,
            material_cost: 350.00,
            preferred_schedule: daysAgo(14).split('T')[0],
            landlord_remarks: 'Completed by Victor Santos, verified by Dante Villareal, and payment settled.',
            screening_status: 'approved',
            created_at: daysAgo(16),
            worker: victor,
            due_date: daysAgo(13).split('T')[0],
            instructions: 'Perform preventive split-type AC chemical wash and drain line clearing.',
            materials: [
                { material_name: 'Foaming Coil Cleaner & Antibacterial Sanitizer Solution', quantity: 1, cost: 350.00 }
            ],
            report: true,
            updates: [
                { status_update: 'pending', notes: 'Submitted by Felix Navarro.', created_at: daysAgo(16) },
                { status_update: 'assigned', notes: 'Dispatched to Victor Santos.', created_at: daysAgo(15) },
                { status_update: 'repairing', notes: 'Technician started split-type aircon servicing.', created_at: daysAgo(14.0) },
                { status_update: 'completed', notes: 'Technician completed servicing and submitted report. Total: ₱1200.00.', created_at: daysAgo(13.5) },
                { status_update: 'verified', notes: 'Landlord Dante Villareal verified completion.', created_at: daysAgo(12.5) },
                { status_update: 'closed', notes: 'Payment verified (Ref: GC-20261028-55190) and work order closed.', created_at: daysAgo(12.0) }
            ]
        }
    ];

    let insertedCount = 0;

    for (const item of scenarios) {
        const lease = leaseByTenantEmail[item.tenantEmail];
        if (!lease) {
            console.warn(`No active lease found for ${item.tenantEmail}, skipping scenario "${item.issue_title}"`);
            continue;
        }

        const reqPayload = {
            tenant_id: lease.tenant_id,
            landlord_id: lease.landlord_id,
            property_id: lease.property_id,
            lease_id: lease.id,
            assigned_maintenance_id: item.worker ? item.worker.id : null,
            issue_title: item.issue_title,
            issue_description: item.issue_description,
            issue_category: item.issue_category,
            priority_level: item.priority_level,
            status: item.status,
            unit_number: item.unit_number,
            preferred_schedule: item.preferred_schedule || null,
            landlord_remarks: item.landlord_remarks || null,
            recommendations: item.recommendations || null,
            problem_found: item.problem_found || null,
            repair_performed: item.repair_performed || null,
            before_photo_url: item.before_photo_url || null,
            after_photo_url: item.after_photo_url || null,
            labor_cost: item.labor_cost || 0,
            material_cost: item.material_cost || 0,
            screening_status: item.screening_status || null,
            travel_started_at: item.travel_started_at || null,
            arrived_at: item.arrived_at || null,
            repair_started_at: item.repair_started_at || null,
            completed_at: item.completed_at || null,
            created_at: item.created_at,
            updated_at: item.completed_at || item.arrived_at || item.created_at
        };

        const { data: createdReq, error: reqErr } = await supabase
            .from('maintenance_requests')
            .insert([reqPayload])
            .select()
            .single();

        if (reqErr) {
            console.error(`Failed to insert "${item.issue_title}":`, reqErr.message);
            continue;
        }

        insertedCount++;

        // Insert assignment record if worker assigned
        if (item.worker) {
            try {
                await maintenancePersonnelModel.createVerifiedAssignment({
                    maintenance_request_id: createdReq.id,
                    maintenance_personnel_id: item.worker.id,
                    due_date: item.due_date,
                    instructions: item.instructions,
                    compliance_verified_by: adminUser.id
                });
            } catch (_) {}
        }

        // Insert materials if any
        if (Array.isArray(item.materials) && item.materials.length > 0) {
            const matRows = item.materials.map(m => ({
                maintenance_request_id: createdReq.id,
                material_name: m.material_name,
                quantity: m.quantity,
                cost: m.cost
            }));
            await supabase.from('maintenance_materials').insert(matRows);
        }

        // Insert formal maintenance_reports row if completed/verified/closed
        if (item.report && item.worker) {
            const matSummary = (item.materials || []).map(m => `${m.quantity}x ${m.material_name}`).join(', ');
            await supabase.from('maintenance_reports').insert([{
                maintenance_request_id: createdReq.id,
                maintenance_personnel_id: item.worker.id,
                problem_found: item.problem_found,
                repair_performed: item.repair_performed,
                materials_used: matSummary,
                recommendations: item.recommendations,
                labor_cost: item.labor_cost || 0,
                material_cost: item.material_cost || 0,
                created_at: item.completed_at || nowIso
            }]);
        }

        // Insert progress updates
        if (Array.isArray(item.updates) && item.updates.length > 0) {
            const updateRows = item.updates.map(u => ({
                maintenance_request_id: createdReq.id,
                status_update: u.status_update,
                notes: u.notes,
                created_at: u.created_at
            }));
            await supabase.from('maintenance_updates').insert(updateRows);
        }

        console.log(`✔ Seeded [${item.status.toUpperCase()}] "${item.issue_title}" (${item.tenantEmail} -> ${item.worker ? item.worker.full_name : 'Unassigned'})`);
    }

    console.log(`\n=== Completed! Seeded ${insertedCount} maintenance workflow requests across all stages ===`);
}

seedMaintenanceWorkflowDemo()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Seed error:', err);
        process.exit(1);
    });

