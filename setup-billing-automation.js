const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupBillingAutomation() {
  try {
    console.log('Setting up billing automation...');
    
    // 1. Enable required extensions
    console.log('Enabling extensions...');
    
    const enableExtensions = `
      CREATE EXTENSION IF NOT EXISTS pg_cron;
      CREATE EXTENSION IF NOT EXISTS http;
    `;
    
    const { error: extensionError } = await supabase.rpc('exec_sql', { 
      sql: enableExtensions 
    });
    
    if (extensionError && !extensionError.message.includes('already exists')) {
      console.error('Extension setup error:', extensionError);
      throw extensionError;
    }
    
    console.log('Extensions enabled successfully');
    
    // 2. Set up the cron job
    console.log('Setting up cron job...');
    
    const cronJobSQL = `
      SELECT cron.schedule(
        'daily-billing-generation',
        '0 9 * * *',
        $$
          SELECT
            net.http_post(
              url := '${supabaseUrl}/functions/v1/generate-monthly-bills',
              headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ${supabaseKey}'
              ),
              body := jsonb_build_object()
            ) as request_id;
        $$
      );
    `;
    
    const { error: cronError } = await supabase.rpc('exec_sql', { 
      sql: cronJobSQL 
    });
    
    if (cronError) {
      console.error('Cron job setup error:', cronError);
      // Continue even if cron setup fails - we can set it up manually later
    } else {
      console.log('Cron job set up successfully');
    }
    
    // 3. Create manual trigger function
    console.log('Creating manual trigger function...');
    
    const manualTriggerSQL = `
      CREATE OR REPLACE FUNCTION trigger_manual_billing()
      RETURNS json
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
        result json;
      BEGIN
        SELECT INTO result
          net.http_post(
            url := '${supabaseUrl}/functions/v1/generate-monthly-bills',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ${supabaseKey}'
            ),
            body := jsonb_build_object()
          );
          
        RETURN result;
      END;
      $$;
    `;
    
    const { error: functionError } = await supabase.rpc('exec_sql', { 
      sql: manualTriggerSQL 
    });
    
    if (functionError) {
      console.error('Function setup error:', functionError);
      throw functionError;
    }
    
    console.log('Manual trigger function created successfully');
    
    // 4. Test the setup by checking existing leases
    console.log('Testing setup - checking for active leases...');
    
    const { data: leases, error: leaseError } = await supabase
      .from('lease_records')
      .select('id, monthly_rent, payment_due_day, lease_status')
      .eq('lease_status', 'active')
      .limit(5);
    
    if (leaseError) {
      console.error('Lease check error:', leaseError);
    } else {
      console.log(`Found ${leases?.length || 0} active leases`);
      if (leases && leases.length > 0) {
        console.log('Sample lease data:', leases[0]);
      }
    }
    
    console.log('\n✅ Billing automation setup complete!');
    console.log('\nNext steps:');
    console.log('1. Deploy Supabase Edge Functions (generate-monthly-bills and generate-manual-bill)');
    console.log('2. Test manual billing generation');
    console.log('3. Verify cron job is scheduled properly');
    
    return true;
    
  } catch (error) {
    console.error('Setup failed:', error);
    return false;
  }
}

// Helper function to execute raw SQL (if needed)
async function createExecSQLFunction() {
  try {
    // Create a helper function to execute raw SQL
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION exec_sql(sql text)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        EXECUTE sql;
      END;
      $$;
    `;
    
    // Note: This might need to be run directly in Supabase SQL editor
    console.log('SQL Function to create manually in Supabase SQL Editor:');
    console.log(createFunctionSQL);
    
  } catch (error) {
    console.error('Error creating exec function:', error);
  }
}

// Run setup
if (require.main === module) {
  setupBillingAutomation().then(success => {
    if (success) {
      console.log('Setup completed successfully');
      process.exit(0);
    } else {
      console.log('Setup failed');
      process.exit(1);
    }
  });
}

module.exports = { setupBillingAutomation };