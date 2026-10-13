-- Enable pg_cron extension for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable http extension for making HTTP requests
CREATE EXTENSION IF NOT EXISTS http;

-- Schedule daily billing generation at 9:00 AM UTC
-- This will check for leases with payment_due_day matching the current day
SELECT cron.schedule(
  'daily-billing-generation',           -- job name
  '0 9 * * *',                         -- cron expression: 9 AM daily
  $$
    SELECT
      net.http_post(
        url := 'https://lxbtoohaopokuenmdmia.supabase.co/functions/v1/generate-monthly-bills',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4YnRvb2hhb3Bva3Vlbm1kbWlhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDExNzY3MCwiZXhwIjoyMDk1NjkzNjcwfQ.CBvqI2FgCh2eUMK6sFIkhVms-RH4J0H1hY0AP2h4IFA'
        ),
        body := jsonb_build_object()
      ) as request_id;
  $$
);

-- Create a function to manually trigger billing generation (for testing)
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
      url := 'https://lxbtoohaopokuenmdmia.supabase.co/functions/v1/generate-monthly-bills',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4YnRvb2hhb3Bva3Vlbm1kbWlhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDExNzY3MCwiZXhwIjoyMDk1NjkzNjcwfQ.CBvqI2FgCh2eUMK6sFIkhVms-RH4J0H1hY0AP2h4IFA'
      ),
      body := jsonb_build_object()
    );
    
  RETURN result;
END;
$$;

-- Create a view to monitor cron jobs
CREATE OR REPLACE VIEW billing_automation_status AS
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
FROM cron.job 
WHERE jobname = 'daily-billing-generation';

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION trigger_manual_billing() TO authenticated;
GRANT SELECT ON billing_automation_status TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION trigger_manual_billing() IS 'Manually trigger billing generation for testing purposes';
COMMENT ON VIEW billing_automation_status IS 'Monitor the status of automated billing cron job';