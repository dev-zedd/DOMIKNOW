const supabase = require('./server/config/supabaseClient');
const fs = require('fs');

async function testTables() {
  const allSqlTables = [
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
    'leases',
    'utility_records',
    'billing_records',
    'payment_records',
    'statements',
    'maintenance_requests',
    'maintenance_categories',
    'maintenance_personnel',
    'maintenance_assignments',
    'maintenance_updates',
    'maintenance_task_updates',
    'maintenance_photos',
    'maintenance_materials',
    'maintenance_reports',
    'landlord_workers',
    'complaints',
    'complaint_status_logs',
    'disputes',
    'policy_violations',
    'policies',
    'platform_policies',
    'tenant_reports',
    'tenant_report_evidence',
    'landlord_reports',
    'landlord_report_evidence',
    'user_reports',
    'reports',
    'report_messages',
    'messages',
    'property_ratings',
    'landlord_ratings_v2',
    'landlord_ratings',
    'ratings_feedback',
    'property_feedback_summary',
    'notifications'
  ];

  const results = {};
  for (const table of allSqlTables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        results[table] = { exists: false, error: error.message };
      } else {
        const cols = data && data.length > 0 ? Object.keys(data[0]) : [];
        results[table] = { exists: true, colsSample: cols };
      }
    } catch (e) {
      results[table] = { exists: false, error: e.message };
    }
  }

  fs.writeFileSync('supabase_verified_tables.json', JSON.stringify(results, null, 2));
  console.log('Results written to supabase_verified_tables.json');
  
  const existing = Object.entries(results).filter(([k, v]) => v.exists).map(([k]) => k);
  const missing = Object.entries(results).filter(([k, v]) => !v.exists).map(([k]) => k);
  console.log('Verified existing tables in Supabase (' + existing.length + '):', existing);
  console.log('Missing/Not created in Supabase (' + missing.length + '):', missing);
}

testTables();
