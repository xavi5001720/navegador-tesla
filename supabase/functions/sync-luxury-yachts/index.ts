import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  console.log(`[Sync] Request received: ${req.method} ${new URL(req.url).pathname}`);

  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    // 1. Obtener todos los MMSIs registrados en nuestra lista
    const { data: yachts, error: listError } = await supabase
      .from('luxury_yacht_list')
      .select('mmsi')

    if (listError) throw listError
    if (!yachts || yachts.length === 0) {
      return new Response(JSON.stringify({ message: 'No hay yates registrados' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const mmsis = yachts.map(y => y.mmsi).join(',')
    const apiKey = Deno.env.get('VESSEL_API_KEY')

    if (!apiKey) throw new Error('VESSEL_API_KEY no configurada')

    // 2. Llamar a la API de VesselAPI (Bulk positions)
    const apiUrl = `https://api.vesselapi.com/v1/vessels/positions?filter.ids=${mmsis}&filter.idType=mmsi`
    console.log(`[Sync] Consultando VesselAPI para ${yachts.length} yates...`)

    const response = await fetch(apiUrl, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API Error (${response.status}): ${errorText}`)
    }

    const data = await response.json()
    const vessels = data.vesselPositions || []

    if (vessels.length === 0) {
      return new Response(JSON.stringify({ success: true, count: 0, message: 'La API no devolvió posiciones activas', debug: data }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // 3. Deduplicar por MMSI (VesselAPI puede devolver múltiples posiciones históricas, necesitamos la más reciente)
    const latestVesselMap = new Map();
    vessels.forEach((v: any) => {
      const existing = latestVesselMap.get(String(v.mmsi));
      const currentTS = v.timestamp ? new Date(v.timestamp).getTime() : 0;
      const existingTS = existing?.timestamp ? new Date(existing.timestamp).getTime() : 0;
      
      if (!existing || currentTS > existingTS) {
        latestVesselMap.set(String(v.mmsi), v);
      }
    });

    const dedupedVessels = Array.from(latestVesselMap.values());

    // 4. Preparar datos para Upsert
    const positions = dedupedVessels.map((v: any) => ({
      mmsi: String(v.mmsi),
      latitude: v.latitude,
      longitude: v.longitude,
      speed: v.sog,
      course: v.cog,
      heading: v.heading,
      nav_status: v.nav_status !== null ? String(v.nav_status) : null,
      last_update: v.timestamp ? new Date(v.timestamp).toISOString() : new Date().toISOString(),
      destination: v.destination || null
    }))

    // 4. Guardar en la tabla luxury_yacht_positions
    const { error: upsertError } = await supabase
      .from('luxury_yacht_positions')
      .upsert(positions, { onConflict: 'mmsi' })

    if (upsertError) throw upsertError

    console.log(`[Sync] Sincronizados ${positions.length} yates correctamente.`)

    return new Response(
      JSON.stringify({ success: true, count: positions.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error('[Sync Error]', error)
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
