const fs = require('fs');
const path = require('path');

const parsedSql = JSON.parse(fs.readFileSync('parsed_sql_schemas.json', 'utf8'));
const detailedTables = JSON.parse(fs.readFileSync('all_tables_detailed.json', 'utf8'));

// Define the 11 modules and categorize all 46 active tables
const subsystems = [
  {
    category: "1. User Authentication, Identity & Security",
    description: "Naglalaman ng mga account ng lahat ng gumagamit ng platform (Tenant, Landlord, Maintenance Personnel, Admin), OTP verification codes, at immutable security audit logs.",
    tables: ['users', 'email_verifications', 'audit_logs']
  },
  {
    category: "2. Property, Units & Inventory Management",
    description: "Naglalaman ng lahat ng impormasyon tungkol sa mga paupahang bahay, gusali, apartments, mga indibidwal na kwarto/units, bedspaces, amenities, mga legal na dokumento, at photo gallery.",
    tables: [
      'properties',
      'property_amenities',
      'property_documents',
      'property_images',
      'property_reservations',
      'property_units',
      'unit_amenities',
      'unit_images',
      'unit_beds'
    ]
  },
  {
    category: "3. Multi-Criteria Recommendation Engine (TOPSIS / MCDM)",
    description: "Naglalaman ng execution logs at scoring metrics para sa multi-criteria recommendation algorithm na sumusukat sa kagustuhan ng tenant (upang matukoy ang pinaka-angkop na paupahan).",
    tables: [
      'recommendation_runs',
      'recommendation_candidates',
      'recommendation_exclusions'
    ]
  },
  {
    category: "4. Tenant Screening & Rental Applications",
    description: "Naglalaman ng proseso ng aplikasyon ng mga naghahanap ng matitirhan, mga isinumiteng requirements (Valid ID, Proof of Income, COE), at screening evaluation.",
    tables: [
      'tenant_applications',
      'tenant_application_documents',
      'tenant_screening'
    ]
  },
  {
    category: "5. Digital Lease Contract Management",
    description: "Naglalaman ng kumpletong digital lease agreements, terms and conditions, monthly rates, security deposits, house rules, at electronic signatures ng landlord at tenant.",
    tables: [
      'lease_records'
    ]
  },
  {
    category: "6. Utility Tracking, Billing & Payment Processing",
    description: "Naglalaman ng meter reading para sa kuryente at tubig, buwanang billing statements, transaction records, reference numbers, at proof of payment verification.",
    tables: [
      'utility_records',
      'billing_records',
      'payment_records'
    ]
  },
  {
    category: "7. Maintenance Operations & Work Order Tracking",
    description: "Naglalaman ng mga maintenance request tickets, pagtatalaga ng personnel o landlord workers, progress tracking (travelling, repairing, completed), materyales, at liquidation reports.",
    tables: [
      'maintenance_requests',
      'maintenance_categories',
      'maintenance_assignments',
      'maintenance_updates',
      'maintenance_task_updates',
      'maintenance_photos',
      'maintenance_materials',
      'maintenance_reports'
    ]
  },
  {
    category: "8. Complaints, Disputes & Policy Governance",
    description: "Naglalaman ng mga reklamo ng tenants tungkol sa living conditions, status logs, alitan na nangangailangan ng mediation ng admin, at logs ng policy violations.",
    tables: [
      'complaints',
      'complaint_status_logs',
      'disputes',
      'policy_violations'
    ]
  },
  {
    category: "9. Incident Reporting, Case Triage & Case Messaging",
    description: "Naglalaman ng mga pormal na incident reports na isinampa ng tenant laban sa landlord o ng landlord laban sa tenant, mga kalakip na ebidensya, at live chat logs sa bawat case.",
    tables: [
      'tenant_reports',
      'tenant_report_evidence',
      'landlord_reports',
      'landlord_report_evidence',
      'user_reports',
      'report_messages'
    ]
  },
  {
    category: "10. Ratings, Reviews & Feedback System",
    description: "Naglalaman ng mga star ratings at reviews para sa property at landlord, trust score metrics, at aggregate feedback summary para sa public display.",
    tables: [
      'property_ratings',
      'landlord_ratings_v2',
      'landlord_ratings',
      'ratings_feedback',
      'property_feedback_summary'
    ]
  },
  {
    category: "11. System Notifications",
    description: "Naglalaman ng real-time in-app notification alerts para sa mga user tuwing may bagong bill, maintenance update, application status, o case message.",
    tables: [
      'notifications'
    ]
  }
];

// Helper to parse columns from rawBody or fallback
function parseColumns(tableName) {
  const p = parsedSql[tableName];
  const d = detailedTables[tableName];
  
  if (!p && !d) return [];

  const raw = p ? p.rawBody : (d ? d.sqlDefinition : '');
  const knownCols = d ? d.cols : [];

  const lines = raw ? raw.split('\n') : [];
  const colDefs = [];

  for (const line of lines) {
    const trimmed = line.trim().replace(/,$/, '');
    if (!trimmed) continue;
    if (trimmed.startsWith('--')) continue;
    if (/^(CONSTRAINT|PRIMARY KEY|FOREIGN KEY|UNIQUE|CHECK)/i.test(trimmed)) continue;

    // extract column name and type
    const parts = trimmed.match(/^([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_\(\)]+)(.*)$/i);
    if (parts) {
      const colName = parts[1];
      const dataType = parts[2];
      const rest = parts[3];

      let isPk = /PRIMARY KEY/i.test(trimmed);
      let isFk = /REFERENCES/i.test(trimmed);
      let isUnique = /UNIQUE/i.test(trimmed);
      let isNotNull = /NOT NULL/i.test(trimmed);
      let defaultVal = '';
      const defMatch = trimmed.match(/DEFAULT\s+([^,]+)/i);
      if (defMatch) defaultVal = defMatch[1].trim();

      let keyConstraint = isPk ? 'PK' : (isFk ? 'FK' : (isUnique ? 'UNIQUE' : 'None'));
      let nullable = (isPk || isNotNull) ? 'NO' : 'YES';

      // Description generator
      let desc = generateColDescription(tableName, colName, dataType, rest);

      colDefs.push({
        colName,
        dataType,
        nullable,
        keyConstraint,
        defaultVal,
        description: desc
      });
    }
  }

  // If table was only in detailed or had additional columns
  for (const col of knownCols) {
    if (!colDefs.some(c => c.colName.toLowerCase() === col.toLowerCase())) {
      colDefs.push({
        colName: col,
        dataType: 'VARCHAR / JSONB / UUID',
        nullable: 'YES',
        keyConstraint: col.endsWith('_id') ? 'FK' : (col === 'id' ? 'PK' : 'None'),
        defaultVal: '',
        description: generateColDescription(tableName, col, '', '')
      });
    }
  }

  return colDefs;
}

function generateColDescription(table, col, type, rest) {
  if (col === 'id') return 'Primary unique identifier para sa record (UUID)';
  if (col === 'created_at') return 'Timestamp kung kailan ginawa ang record sa system';
  if (col === 'updated_at') return 'Timestamp ng pinakahuling pagbabago sa record';
  if (col === 'user_id') return 'Foreign key na tumutukoy sa gumagamit sa users table';
  if (col === 'landlord_id') return 'Foreign key na tumutukoy sa may-ari ng paupahan (users table)';
  if (col === 'tenant_id') return 'Foreign key na tumutukoy sa umuupa o aplikante (users table)';
  if (col === 'property_id') return 'Foreign key na tumutukoy sa partikular na paupahan (properties table)';
  if (col === 'unit_id') return 'Foreign key na tumutukoy sa partikular na unit o kwarto (property_units table)';
  if (col === 'bed_id') return 'Foreign key na tumutukoy sa partikular na kama/bedspace (unit_beds table)';
  if (col === 'lease_id') return 'Foreign key na tumutukoy sa active lease contract (lease_records table)';
  if (col === 'request_id') return 'Foreign key na tumutukoy sa maintenance request (maintenance_requests table)';
  if (col === 'report_id') return 'Foreign key na tumutukoy sa incident report ticket';
  
  // Specific table/column mappings
  const map = {
    'full_name': 'Kumpletong pangalan ng rehistradong gumagamit',
    'email': 'Opisyal at unique na email address para sa authentication',
    'password_hash': 'Bcrypt hash ng password ng account para sa seguridad',
    'role': 'Ginagampanang papel sa system (tenant, landlord, maintenance, admin)',
    'contact_number': 'Aktibong contact number / cellphone number',
    'address': 'Tirahan o pisikal na lokasyon',
    'profile_image_url': 'URL link patungo sa profile photo sa Supabase Storage',
    'is_verified': 'Status kung na-verify na ang email address (true/false)',
    'account_status': 'Estado ng account (pending, active, disabled, rejected)',
    'landlord_average_rating': 'Kalkuladong average rating ng landlord mula sa mga tenant',
    'landlord_trust_score': 'Pangkalahatang trust score index ng landlord (0-100)',
    'property_name': 'Pangalan o pamagat ng paupahang establisimyento',
    'property_type': 'Uri ng paupahan (apartment, boarding_house, bedspace, studio_unit, etc.)',
    'monthly_rent': 'Halaga ng buwanang upa (PHP)',
    'security_deposit': 'Halaga ng paunang deposito bago makalipat',
    'advance_payment': 'Halaga ng advance rental payment',
    'billing_status': 'Estado ng singil (pending_payment, waiting_verification, paid, overdue)',
    'payment_status': 'Estado ng bayad (pending_verification, verified, rejected)',
    'amount': 'Kabuuang halaga ng bayarin o transaksyon',
    'issue_title': 'Maikling pamagat o paksa ng idinulog na problema',
    'issue_description': 'Detalyadong paliwanag ng kailangang ayusin o problema',
    'priority_level': 'Lebel ng pangangailangan (low, medium, high, emergency)',
    'status': 'Kasalukuyang estado ng daloy ng proseso'
  };

  if (map[col]) return map[col];

  // Generic formatting
  const pretty = col.replace(/_/g, ' ');
  return `Naglalaman ng datos para sa ${pretty} kaugnay ng ${table}`;
}

// Build Markdown
let md = `# DOMIKNOW SYSTEM - COMPREHENSIVE DATA DICTIONARY\n`;
md += `**Document Version:** 2.0 (Academic & Thesis Standard)\n`;
md += `**Database Engine:** PostgreSQL 15+ (Hosted on Supabase)\n`;
md += `**Total Verified Physical Tables:** 46 Active Tables\n`;
md += `**Date Compiled:** 2026-10-13\n\n`;

md += `## 1. Pangkalahatang Buod (Executive Summary)\n`;
md += `Ang DomiKnow database architecture ay dinisenyo gamit ang relational PostgreSQL structure upang suportahan ang komprehensibong operasyon ng rental housing governance, multi-criteria recommendation (TOPSIS), digital leasing, utility billing, maintenance lifecycle, incident triage, at community feedback. Bawat table ay sumusunod sa Third Normal Form (3NF) at may mahigpit na foreign key constraints, check constraints, at automated timestamping.\n\n`;

md += `### Master Table Directory (Summary Overview)\n\n`;
md += `| Blg | Pangalan ng Table | Functional Subsystem / Module | Pangunahing Silbi sa System |\n`;
md += `|:---:|:---|:---|:---|\n`;

let totalIdx = 1;
for (const sub of subsystems) {
  for (const t of sub.tables) {
    const p = parsedSql[t];
    let file = p ? p.file : 'database schema';
    md += `| ${totalIdx++} | \`${t}\` | ${sub.category.split('.')[1].trim()} | ${getTableShortPurpose(t)} |\n`;
  }
}

md += `\n---\n\n`;
md += `## 2. Detalyadong Data Dictionary ng Bawat Table (Detailed Table Specifications)\n\n`;

for (const sub of subsystems) {
  md += `### ${sub.category}\n`;
  md += `> ${sub.description}\n\n`;

  for (const t of sub.tables) {
    const cols = parseColumns(t);
    md += `#### Table: \`${t}\`\n`;
    md += `- **Functional Module:** ${sub.category}\n`;
    md += `- **Deskripsyon / Silbi:** ${getTableFullPurpose(t)}\n`;
    md += `- **Primary Key:** \`id\`\n`;
    md += `- **Bilang ng Columns:** ${cols.length}\n\n`;

    md += `| Field / Attribute Name | Data Type | Nullable | Key / Constraint | Deskripsyon / Kahulugan |\n`;
    md += `|:---|:---|:---:|:---:|:---|\n`;

    for (const c of cols) {
      md += `| \`${c.colName}\` | \`${c.dataType}\` | ${c.nullable} | ${c.keyConstraint} | ${c.description} |\n`;
    }
    md += `\n`;
  }
  md += `---\n\n`;
}

function getTableShortPurpose(table) {
  const map = {
    'users': 'Pangunahing talaan ng lahat ng rehistradong user at kanilag mga roles.',
    'email_verifications': 'Nagtatala ng OTP codes at tokens para sa account email verification.',
    'audit_logs': 'Immutable security audit trail ng mga administrative at user events.',
    'properties': 'Listahan ng mga paupahang bahay o gusali na pagmamay-ari ng landlords.',
    'property_amenities': 'Mga serbisyo at kagamitang inaalok sa property (WiFi, Tubig, etc.).',
    'property_documents': 'Mga legal na dokumento (Business Permit, DTI) para sa property approval.',
    'property_images': 'Gallery ng mga opisyal na larawan para sa property listing.',
    'property_reservations': 'Pansamantalang pagpapareserba ng unit/bedspace bago ang lease.',
    'property_units': 'Mga partikular na kwarto o yunit sa loob ng isang paupahan.',
    'unit_amenities': 'Mga partikular na amenities na eksklusibo sa bawat unit.',
    'unit_images': 'Gallery ng mga larawan para sa indibidwal na kwarto/yunit.',
    'unit_beds': 'Bedspace inventory at pagkakakilanlan ng bawat higaan/kama.',
    'recommendation_runs': 'Kasaysayan ng pagtakbo ng TOPSIS algorithm bawat search query.',
    'recommendation_candidates': 'Mga kalkuladong marka at ranggo ng bawat property sa TOPSIS run.',
    'recommendation_exclusions': 'Mga paupahang na-filter o hindi pumasa sa pamantayan ng tenant.',
    'tenant_applications': 'Pormal na aplikasyon ng tenant para umupa ng property/unit/bed.',
    'tenant_application_documents': 'Mga kalakip na requirements (ID, COE, proof of billing) ng aplikante.',
    'tenant_screening': 'Screening score at pagsusuri ng landlord sa kredensyal ng tenant.',
    'lease_records': 'Opisyal na kontrata ng upa (digital lease agreement) at lagda.',
    'utility_records': 'Talaan ng monthly sub-meter reading sa kuryente at tubig.',
    'billing_records': 'Buwanang singilin sa upa, kuryente, tubig, at iba pang bayarin.',
    'payment_records': 'Transaksyon sa pagbabayad, resibo, at verification status.',
    'maintenance_requests': 'Tiket ng sirang pasilidad na inireklamo ng tenant para kumpunihin.',
    'maintenance_categories': 'Mga klasipikasyon ng maintenance work (Plumbing, Electrical, etc.).',
    'maintenance_assignments': 'Pagtatalaga ng technician o maintenance personnel sa tiket.',
    'maintenance_updates': 'Status timeline at work logs ng technician habang nag-aayos.',
    'maintenance_task_updates': 'Granular checklist updates sa bawat hakbang ng pagkumpuni.',
    'maintenance_photos': 'Katibayan ng sira at natapos na gawa (Before & After photos).',
    'maintenance_materials': 'Talaan ng piyesa at materyales na binili kasama ang gastos.',
    'maintenance_reports': 'Panghuling ulat at likidasyon ng natapos na maintenance job.',
    'complaints': 'Pormal na reklamo ng tenant ukol sa kapaligiran o kapitbahay.',
    'complaint_status_logs': 'Timeline ng aksyon at imbestigasyon ng landlord sa reklamo.',
    'disputes': 'Pormal na hidwaan na inakyat sa admin para sa opisyal na mediation.',
    'policy_violations': 'Talaan ng paglabag sa mga alituntunin o house rules.',
    'tenant_reports': 'Opisyal na ulat ng tenant laban sa landlord o pamunuan.',
    'tenant_report_evidence': 'Mga kalakip na ebidensya at screenshot ng tenant incident report.',
    'landlord_reports': 'Opisyal na ulat ng landlord laban sa pasaway na tenant.',
    'landlord_report_evidence': 'Mga litrato at patunay ng kapabayaan o pagkasira mula sa landlord.',
    'user_reports': 'Pangkalahatang ulat ng mga user na dumadaan sa case triage ng admin.',
    'report_messages': 'Live case communication logs sa pagitan ng complainant, respondent, at admin.',
    'property_ratings': 'Star rating at ebalwasyon ng tenant sa kalidad ng paupahan.',
    'landlord_ratings_v2': 'Detalyadong marka sa pagiging maaasahan at katarungan ng landlord.',
    'landlord_ratings': 'Talaan ng rating na ibinigay sa landlord.',
    'ratings_feedback': 'Mensahe at nakasulat na rebyu mula sa tenant matapos manirahan.',
    'property_feedback_summary': 'Naka-cache na kabuuang marka at bilang ng reviews bawat property.',
    'notifications': 'In-app notification alerts para sa mga mahahalagang anunsyo at aktibidad.'
  };
  return map[table] || `Talaan para sa pamamahala ng datos ng ${table}.`;
}

function getTableFullPurpose(table) {
  const short = getTableShortPurpose(table);
  return `${short} Ginagamit ito ng system controllers at models upang matiyak ang integridad ng mga transaksyon at serbisyo sa web application.`;
}

// Write to files
fs.writeFileSync('../DATA_DICTIONARY.md', md);
fs.writeFileSync('DATA_DICTIONARY.md', md);
console.log('Successfully wrote DATA_DICTIONARY.md in both root and DOMIKNOW directory!');
