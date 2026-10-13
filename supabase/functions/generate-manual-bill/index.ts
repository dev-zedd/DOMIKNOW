import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { lease_id, target_month, landlord_id } = await req.json()
    
    if (!lease_id) {
      return new Response(
        JSON.stringify({ error: 'lease_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get lease details and verify ownership if landlord_id provided
    let leaseQuery = supabase
      .from('lease_records')
      .select(`
        id, tenant_id, landlord_id, property_id, unit_id, bed_id,
        monthly_rent, payment_due_day, utilities_covered, lease_status,
        lease_start_date, lease_end_date
      `)
      .eq('id', lease_id)
      .eq('lease_status', 'active')

    if (landlord_id) {
      leaseQuery = leaseQuery.eq('landlord_id', landlord_id)
    }

    const { data: lease, error: leaseError } = await leaseQuery.single()

    if (leaseError || !lease) {
      return new Response(
        JSON.stringify({ error: 'Active lease not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use target month or current month
    const billDate = target_month ? new Date(target_month + '-01') : new Date()
    const billingMonth = billDate.toISOString().slice(0, 7)
    
    // For manual generation, due date can be today or specified
    const dueDate = new Date().toISOString().slice(0, 10)

    // Check for existing bill
    const { data: existing } = await supabase
      .from('billing_records')
      .select('id')
      .eq('lease_id', lease_id)
      .eq('billing_month', billingMonth)
      .maybeSingle()

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'Bill already exists for this month' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create manual bill (same logic as automatic)
    const utilitiesCovered = lease.utilities_covered || {}
    const billingData = {
      lease_id: lease.id,
      tenant_id: lease.tenant_id,
      landlord_id: lease.landlord_id,
      property_id: lease.property_id,
      unit_id: lease.unit_id,
      bed_id: lease.bed_id,
      billing_month: billingMonth,
      billing_type: 'manual_generation',
      rent_amount: lease.monthly_rent,
      due_date: dueDate,
      billing_status: 'pending_payment',
      
      water: utilitiesCovered.water === 'included' ? 0 : null,
      electricity: utilitiesCovered.electricity === 'included' ? 0 : null,
      internet: utilitiesCovered.internet === 'included' ? 0 : null,
      parking: utilitiesCovered.parking === 'included' ? 0 : null,
      association_fee: utilitiesCovered.assoc_fee === 'included' ? 0 : null,
      
      total_amount: lease.monthly_rent,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: newBill, error: billError } = await supabase
      .from('billing_records')
      .insert(billingData)
      .select()
      .single()

    if (billError) throw billError

    return new Response(
      JSON.stringify({
        success: true,
        bill: newBill,
        message: `Manual bill generated for lease ${lease_id}, month ${billingMonth}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Manual billing error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})