import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service key (full access)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const today = new Date()
    const currentDay = today.getDate()
    
    // Calculate billing month and due date based on your 5-day advance rule
    let billingMonth: string
    let targetMonth: Date
    
    // If today is 26th-31st, we're generating bills for next month
    if (currentDay >= 26) {
      targetMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)
      billingMonth = targetMonth.toISOString().slice(0, 7) // Next month YYYY-MM
    } else {
      // If today is 1st-25th, we're generating bills for current month
      targetMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      billingMonth = targetMonth.toISOString().slice(0, 7) // Current month YYYY-MM
    }

    const dueDate = today.toISOString().slice(0, 10) // Today's date YYYY-MM-DD

    console.log(`Starting billing generation for day ${currentDay}`)
    console.log(`Billing month: ${billingMonth}, Due date: ${dueDate}`)

    // 1. Find all active leases with payment_due_day = currentDay
    const { data: leases, error: leasesError } = await supabase
      .from('lease_records')
      .select(`
        id,
        tenant_id,
        landlord_id,
        property_id,
        unit_id,
        bed_id,
        monthly_rent,
        payment_due_day,
        utilities_covered,
        lease_start_date,
        lease_end_date,
        lease_status
      `)
      .eq('lease_status', 'active')
      .eq('payment_due_day', currentDay)
      .lte('lease_start_date', dueDate)  // Lease has started
      .gte('lease_end_date', targetMonth.toISOString().slice(0, 10))    // Lease active for target month

    if (leasesError) throw leasesError

    let created = 0
    let skipped = 0
    const results = []

    console.log(`Found ${leases?.length || 0} active leases with payment_due_day = ${currentDay}`)

    // 2. Process each lease
    for (const lease of leases || []) {
      try {
        // Check if bill already exists for this lease + month
        const { data: existing } = await supabase
          .from('billing_records')
          .select('id')
          .eq('lease_id', lease.id)
          .eq('billing_month', billingMonth)
          .maybeSingle()

        if (existing) {
          console.log(`Bill already exists for lease ${lease.id}, month ${billingMonth}`)
          skipped++
          results.push({ lease_id: lease.id, status: 'skipped', reason: 'already_exists' })
          continue
        }

        // Parse utilities configuration from lease
        const utilitiesCovered = lease.utilities_covered || {}

        // 3. Create the billing record
        const billingData = {
          lease_id: lease.id,
          tenant_id: lease.tenant_id,
          landlord_id: lease.landlord_id,
          property_id: lease.property_id,
          unit_id: lease.unit_id,
          bed_id: lease.bed_id,
          billing_month: billingMonth,
          billing_type: 'monthly_rent',
          rent_amount: lease.monthly_rent,
          due_date: dueDate,
          billing_status: 'pending_payment',
          
          // Set utility amounts based on lease configuration
          // 0 = included in rent, null = needs separate billing input
          water: utilitiesCovered.water === 'included' ? 0 : null,
          electricity: utilitiesCovered.electricity === 'included' ? 0 : null,
          internet: utilitiesCovered.internet === 'included' ? 0 : null,
          parking: utilitiesCovered.parking === 'included' ? 0 : null,
          association_fee: utilitiesCovered.assoc_fee === 'included' ? 0 : null,
          
          total_amount: lease.monthly_rent, // Start with rent amount, utilities added later
          
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        const { data: newBill, error: billError } = await supabase
          .from('billing_records')
          .insert(billingData)
          .select('id, lease_id, tenant_id, billing_month, rent_amount, due_date')
          .single()

        if (billError) throw billError

        created++
        results.push({ 
          lease_id: lease.id, 
          status: 'created', 
          bill_id: newBill.id,
          amount: lease.monthly_rent,
          due_date: dueDate,
          billing_month: billingMonth
        })

        console.log(`Created bill for lease ${lease.id}: ₱${lease.monthly_rent}, due ${dueDate}, for month ${billingMonth}`)

      } catch (error) {
        console.error(`Error processing lease ${lease.id}:`, error)
        skipped++
        results.push({ 
          lease_id: lease.id, 
          status: 'error', 
          error: error.message 
        })
      }
    }

    // 4. Return summary
    const summary = {
      success: true,
      execution_date: today.toISOString(),
      billing_month: billingMonth,
      payment_due_day: currentDay,
      advance_payment_rule: "5 days before month start",
      total_leases_processed: leases?.length || 0,
      bills_created: created,
      bills_skipped: skipped,
      details: results
    }

    console.log('Billing generation completed:', summary)

    return new Response(
      JSON.stringify(summary),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Billing generation failed:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})