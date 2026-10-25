const fs = require('fs');
const path = require('path');

const parsedSql = JSON.parse(fs.readFileSync('parsed_sql_schemas.json', 'utf8'));
const detailedTables = JSON.parse(fs.readFileSync('all_tables_detailed.json', 'utf8'));

// List of all active tables
const allTables = [
  'users',
  'email_verifications',
  'audit_logs',
  'properties',
  'property_amenities',
  'property_documents',
  'property_images',
  'property_reservations',
  'property_units',
  'unit_amenities',
  'unit_images',
  'unit_beds',
  'recommendation_runs',
  'recommendation_candidates',
  'recommendation_exclusions',
  'tenant_applications',
  'tenant_application_documents',
  'tenant_screening',
  'lease_records',
  'utility_records',
  'billing_records',
  'payment_records',
  'maintenance_requests',
  'maintenance_categories',
  'maintenance_assignments',
  'maintenance_updates',
  'maintenance_task_updates',
  'maintenance_photos',
  'maintenance_materials',
  'maintenance_reports',
  'complaints',
  'complaint_status_logs',
  'disputes',
  'policy_violations',
  'tenant_reports',
  'tenant_report_evidence',
  'landlord_reports',
  'landlord_report_evidence',
  'user_reports',
  'report_messages',
  'property_ratings',
  'landlord_ratings_v2',
  'landlord_ratings',
  'ratings_feedback',
  'property_feedback_summary',
  'notifications'
];

// Helper to determine field metadata
function getFieldMetadata(tableName, colName, rawLine = '') {
  const col = colName.toLowerCase();
  const raw = rawLine.toLowerCase();

  let dataType = 'varchar(255)';
  let dataFormat = 'text';
  let fieldSize = '255';
  let description = '';
  let example = '';
  let relationship = '-';

  // Primary Key
  if (col === 'id') {
    dataType = 'uuid';
    dataFormat = 'UUID';
    fieldSize = '16 bytes';
    description = 'Primary key';
    example = 'd3b07384-d113-4696-9812-70b9eb0f3b0e';
    relationship = 'PK';
    return { fieldName: colName, dataType, dataFormat, fieldSize, description, example, relationship };
  }

  // Parse type from SQL line if available
  if (rawLine) {
    const typeMatch = rawLine.match(/^[a-zA-Z0-9_]+\s+([a-zA-Z0-9_]+(?:\([0-9,\s]+\))?)/i);
    if (typeMatch) {
      dataType = typeMatch[1].toLowerCase();
    }
  }

  // Determine relationship
  if (rawLine.includes('references')) {
    const refMatch = rawLine.match(/references\s+([a-zA-Z0-9_]+)\s*\(([a-zA-Z0-9_]+)\)/i);
    if (refMatch) {
      relationship = `FK (${refMatch[1]}.${refMatch[2]})`;
    } else {
      relationship = 'FK';
    }
  } else if (col.endsWith('_id')) {
    const target = col.replace(/_id$/, '');
    if (target === 'user' || target === 'landlord' || target === 'tenant' || target === 'worker' || target === 'reporter' || target === 'reported_user' || target === 'created_by_landlord' || target === 'admin_reviewed_by' || target === 'screened_by' || target === 'changed_by' || target === 'assigned_by' || target === 'updated_by' || target === 'mediator' || target === 'verified_by' || target === 'sender') {
      relationship = 'FK (users.id)';
    } else if (target === 'property') {
      relationship = 'FK (properties.id)';
    } else if (target === 'unit') {
      relationship = 'FK (property_units.id)';
    } else if (target === 'bed') {
      relationship = 'FK (unit_beds.id)';
    } else if (target === 'lease') {
      relationship = 'FK (lease_records.id)';
    } else if (target === 'billing') {
      relationship = 'FK (billing_records.id)';
    } else if (target === 'request') {
      relationship = 'FK (maintenance_requests.id)';
    } else if (target === 'complaint') {
      relationship = 'FK (complaints.id)';
    } else if (target === 'report') {
      relationship = 'FK (reports.id)';
    } else if (target === 'application') {
      relationship = 'FK (tenant_applications.id)';
    } else if (target === 'run') {
      relationship = 'FK (recommendation_runs.id)';
    }
  }

  // Map data format, size, and example based on dataType and column name
  if (dataType.startsWith('uuid') || col.endsWith('_id')) {
    dataType = 'uuid';
    dataFormat = 'UUID';
    fieldSize = '16 bytes';
    example = 'c7a19e52-192e-4b48-8df0-4b2a8d672801';
  } else if (dataType.startsWith('varchar')) {
    const sizeMatch = dataType.match(/\((\d+)\)/);
    fieldSize = sizeMatch ? sizeMatch[1] : '255';
    dataFormat = 'text';
    example = 'Sample text';
  } else if (dataType.startsWith('decimal') || dataType.startsWith('numeric')) {
    const sizeMatch = dataType.match(/\(([\d,\s]+)\)/);
    fieldSize = sizeMatch ? sizeMatch[1] : '10,2';
    dataFormat = 'decimal';
    example = fieldSize.includes('3,2') ? '4.50' : '5000.00';
  } else if (dataType.startsWith('int') || dataType === 'integer' || dataType === 'serial') {
    dataType = 'integer';
    dataFormat = 'integer';
    fieldSize = '4 bytes';
    example = '1';
  } else if (dataType.startsWith('bool')) {
    dataType = 'boolean';
    dataFormat = 'boolean';
    fieldSize = '1 byte';
    example = 'true';
  } else if (dataType.includes('time') || dataType.includes('date')) {
    dataType = dataType.includes('time') ? 'timestamptz' : 'date';
    dataFormat = dataType.includes('time') ? 'timestamp' : 'date';
    fieldSize = '-';
    example = '2026-10-13 08:30:00';
  } else if (dataType === 'text') {
    dataFormat = 'text';
    fieldSize = '-';
    example = 'Detailed text content';
  } else if (dataType === 'json' || dataType === 'jsonb') {
    dataType = 'jsonb';
    dataFormat = 'JSON';
    fieldSize = '-';
    example = '{"key": "value"}';
  }

  // Descriptions & Examples for common fields
  const descMap = {
    // Users
    'full_name': { desc: 'Full legal name of the user', ex: 'Juan Dela Cruz', fmt: 'text' },
    'email': { desc: 'Unique email address for authentication', ex: 'juan.delacruz@gmail.com', fmt: 'email' },
    'password_hash': { desc: 'Bcrypt hashed password', ex: '$2a$12$K8yR2uK4...', fmt: 'hashed password' },
    'role': { desc: 'User system role (tenant, landlord, maintenance, admin)', ex: 'tenant', fmt: 'text' },
    'contact_number': { desc: 'Mobile contact number', ex: '09171234567', fmt: 'string' },
    'address': { desc: 'Physical home or billing address', ex: '123 Rizal St., Dagupan City', fmt: 'text' },
    'profile_image_url': { desc: 'Cloud URL for user profile picture', ex: 'https://storage.../profiles/user1.png', fmt: 'URL' },
    'is_verified': { desc: 'Whether user email has been verified', ex: 'true', fmt: 'boolean' },
    'account_status': { desc: 'Account standing (pending, active, disabled, rejected)', ex: 'active', fmt: 'text' },
    'landlord_average_rating': { desc: 'Average rating score of landlord', ex: '4.85', fmt: 'decimal' },
    'landlord_rating_count': { desc: 'Total number of ratings received', ex: '24', fmt: 'integer' },
    'landlord_trust_score': { desc: 'Calculated platform trust score (0-100)', ex: '95', fmt: 'integer' },
    'created_by_landlord_id': { desc: 'Landlord who created this worker account', ex: 'a12e3456-...', fmt: 'UUID' },

    // Properties
    'property_name': { desc: 'Listing title or boarding house name', ex: 'Villa Milagros Dormitory', fmt: 'text' },
    'property_type': { desc: 'Type of property (apartment, boarding_house, etc.)', ex: 'boarding_house', fmt: 'text' },
    'description': { desc: 'Detailed description of the property or request', ex: 'Spacious student dorm near university', fmt: 'text' },
    'barangay': { desc: 'Barangay location', ex: 'Poblacion', fmt: 'text' },
    'municipality': { desc: 'City or municipality location', ex: 'Dagupan City', fmt: 'text' },
    'province': { desc: 'Province location', ex: 'Pangasinan', fmt: 'text' },
    'latitude': { desc: 'GPS latitude coordinate', ex: '16.04330000', fmt: 'decimal' },
    'longitude': { desc: 'GPS longitude coordinate', ex: '120.33330000', fmt: 'decimal' },
    'monthly_rent': { desc: 'Monthly rental price in PHP', ex: '3500.00', fmt: 'currency' },
    'max_occupants': { desc: 'Maximum allowable occupants', ex: '4', fmt: 'integer' },
    'tenant_type_suitability': { desc: 'Target demographic (student, worker, family, general)', ex: 'student', fmt: 'text' },
    'house_rules': { desc: 'Rules and regulations for residents', ex: 'Curfew at 10:00 PM, no smoking', fmt: 'text' },
    'status': { desc: 'Current workflow or availability status', ex: 'approved', fmt: 'text' },
    'average_rating': { desc: 'Overall average rating score', ex: '4.80', fmt: 'decimal' },
    'rating_count': { desc: 'Total ratings submitted', ex: '18', fmt: 'integer' },
    'total_floors': { desc: 'Total building floors', ex: '3', fmt: 'integer' },
    'total_capacity': { desc: 'Total bed or tenant capacity', ex: '24', fmt: 'integer' },
    'landmark': { desc: 'Nearest prominent landmark', ex: 'Near University Main Gate', fmt: 'text' },
    'main_image_url': { desc: 'Cover photo URL of property listing', ex: 'https://storage.../prop1_main.jpg', fmt: 'URL' },

    // Units & Beds
    'unit_number': { desc: 'Designated room or unit identifier', ex: 'Room 204', fmt: 'text' },
    'room_name': { desc: 'Room label or custom name', ex: 'Deluxe Quad Room', fmt: 'text' },
    'floor': { desc: 'Building floor level', ex: '2nd Floor', fmt: 'text' },
    'gender_restriction': { desc: 'Gender exclusivity (female_only, male_only, mixed)', ex: 'female_only', fmt: 'text' },
    'rental_style': { desc: 'Rental arrangement (bedspace, whole_room)', ex: 'bedspace', fmt: 'text' },
    'bed_number': { desc: 'Specific bed designation inside unit', ex: 'Bed 2-B', fmt: 'text' },
    'rental_price': { desc: 'Rental fee per bed in PHP', ex: '1800.00', fmt: 'currency' },

    // Lease
    'lease_number': { desc: 'Unique legal contract reference number', ex: 'LEASE-2026-0042', fmt: 'text' },
    'start_date': { desc: 'Official tenancy start date', ex: '2026-06-01', fmt: 'date' },
    'end_date': { desc: 'Official tenancy expiration date', ex: '2027-05-31', fmt: 'date' },
    'security_deposit': { desc: 'Required advance security deposit in PHP', ex: '7000.00', fmt: 'currency' },
    'advance_payment': { desc: 'Advance rental payment credited', ex: '3500.00', fmt: 'currency' },
    'payment_due_day': { desc: 'Calendar day of month rent is due', ex: '5', fmt: 'integer' },
    'lease_status': { desc: 'Lease state (pending_tenant_acceptance, active, etc.)', ex: 'active', fmt: 'text' },
    'landlord_signature_name': { desc: 'Electronic signer name for landlord', ex: 'Juan Dela Cruz', fmt: 'text' },
    'tenant_signature_name': { desc: 'Electronic signer name for tenant', ex: 'Maria Santos', fmt: 'text' },
    'utilities_covered': { desc: 'JSON list of utilities covered in rent', ex: '["water", "wifi"]', fmt: 'JSON' },

    // Billing & Payments
    'billing_month': { desc: 'Target billing cycle (YYYY-MM)', ex: '2026-06', fmt: 'string' },
    'due_date': { desc: 'Payment due deadline', ex: '2026-06-05', fmt: 'date' },
    'base_rent': { desc: 'Base monthly room rent in PHP', ex: '3500.00', fmt: 'currency' },
    'water': { desc: 'Sub-metered water billing charge', ex: '250.00', fmt: 'currency' },
    'electricity': { desc: 'Sub-metered power billing charge', ex: '620.00', fmt: 'currency' },
    'internet': { desc: 'Monthly shared WiFi fee', ex: '150.00', fmt: 'currency' },
    'total_amount_due': { desc: 'Final calculated sum of all charges', ex: '4520.00', fmt: 'currency' },
    'billing_status': { desc: 'Invoice state (pending_payment, paid, overdue)', ex: 'pending_payment', fmt: 'text' },
    'amount_paid': { desc: 'Actual amount remitted by tenant', ex: '4520.00', fmt: 'currency' },
    'payment_method': { desc: 'Remittance channel (GCash, Maya, Bank, Cash)', ex: 'GCash', fmt: 'text' },
    'reference_number': { desc: 'Payment transaction reference number', ex: 'REF-982341094', fmt: 'string' },
    'payment_status': { desc: 'Verification status (pending_verification, verified)', ex: 'verified', fmt: 'text' },

    // Maintenance
    'issue_category': { desc: 'Category of defect (plumbing, electrical, aircon, etc.)', ex: 'plumbing', fmt: 'text' },
    'issue_title': { desc: 'Brief title of the reported fault', ex: 'Leaking bathroom faucet', fmt: 'text' },
    'priority_level': { desc: 'Urgency rating (low, medium, high, emergency)', ex: 'medium', fmt: 'text' },
    'preferred_schedule': { desc: 'Tenant preferred repair time slot', ex: 'Saturday 2:00 PM', fmt: 'text' },
    'labor_cost': { desc: 'Technician labor compensation', ex: '350.00', fmt: 'currency' },
    'material_cost': { desc: 'Total cost of replacement parts', ex: '180.00', fmt: 'currency' },
    'before_photo_url': { desc: 'URL of damage photo before repair', ex: 'https://storage.../before.jpg', fmt: 'URL' },
    'after_photo_url': { desc: 'URL of photo verifying completed repair', ex: 'https://storage.../after.jpg', fmt: 'URL' },

    // Audits & timestamps
    'created_at': { desc: 'Timestamp record was created', ex: '2026-10-13 08:30:00', fmt: 'timestamp' },
    'updated_at': { desc: 'Timestamp record was last modified', ex: '2026-10-13 09:15:00', fmt: 'timestamp' }
  };

  if (descMap[col]) {
    description = descMap[col].desc;
    example = descMap[col].ex;
    dataFormat = descMap[col].fmt;
  } else {
    // Generate intelligent default
    description = `Field storing ${col.replace(/_/g, ' ')} for ${tableName}`;
    if (dataFormat === 'text') example = 'Sample value';
    else if (dataFormat === 'integer') example = '1';
    else if (dataFormat === 'boolean') example = 'false';
  }

  return {
    fieldName: colName,
    dataType,
    dataFormat,
    fieldSize,
    description,
    example,
    relationship
  };
}

// Generate the dictionary data
const dictionaryData = {};

for (const tableName of allTables) {
  const p = parsedSql[tableName];
  const d = detailedTables[tableName];
  const rawBody = p ? p.rawBody : (d ? d.sqlDefinition : '');
  const cols = d && d.cols.length > 0 ? d.cols : [];

  const rawLines = rawBody ? rawBody.split('\n')
    .map(l => l.trim().replace(/,$/, ''))
    .filter(l => l && !l.startsWith('--') && !/^(CONSTRAINT|PRIMARY KEY|FOREIGN KEY|UNIQUE|CHECK)/i.test(l)) : [];

  const fields = [];
  const processedCols = new Set();

  for (const line of rawLines) {
    const parts = line.match(/^([a-zA-Z0-9_]+)/i);
    if (parts) {
      const colName = parts[1];
      processedCols.add(colName.toLowerCase());
      fields.push(getFieldMetadata(tableName, colName, line));
    }
  }

  // Include any extra columns from live Supabase schema (e.g. from ALTER TABLE)
  for (const col of cols) {
    if (!processedCols.has(col.toLowerCase())) {
      fields.push(getFieldMetadata(tableName, col, ''));
    }
  }

  dictionaryData[tableName] = fields;
}

console.log('Processed tables count:', Object.keys(dictionaryData).length);
fs.writeFileSync('generated_dictionary_data.json', JSON.stringify(dictionaryData, null, 2));
