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
    // REFUERZO DE SEGURIDAD MANUAL:
    // Ya que hemos desactivado verify_jwt en el Gateway para permitir llaves opacas sb_publishable,
    // verificamos manualmente que la cabecera Authorization contenga nuestra Anon Key.
    const authHeader = req.headers.get('Authorization')
    const anonKey = Deno.env.get('APP_ANON_KEY')
    
    if (!authHeader || (anonKey && !authHeader.includes(anonKey))) {
      console.error('[Security] Intento de acceso no autorizado detectado.')
      return new Response(JSON.stringify({ error: 'No autorizado: Llave de acceso inválida' }), { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
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

    const mmsis = yachts.map(y => y.mmsi).filter(Boolean).join(',')
    const apiKey = Deno.env.get('VESSEL_API_KEY')

    if (!apiKey) throw new Error('VESSEL_API_KEY no configurada en el entorno de Supabase')

    // 2. Llamar a la API de VesselAPI (Bulk positions)
    const apiUrl = `https://api.vesselapi.com/v1/vessels/positions?filter.ids=${mmsis}&filter.idType=mmsi`
    console.log(`[Sync] Consultando VesselAPI para ${yachts.length} yates... URL: ${apiUrl.substring(0, 50)}...`)

    const response = await fetch(apiUrl, {
      headers: { 
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Sync] API Error: ${response.status} - ${errorText}`)
      throw new Error(`VesselAPI Error (${response.status}): ${errorText}`)
    }

    const data = await response.json()
    const vessels = data.vesselPositions || []
    console.log(`[Sync] API recibió ${vessels.length} posiciones de barcos.`)

    if (vessels.length === 0) {
      return new Response(JSON.stringify({ success: true, count: 0, message: 'La API no devolvió posiciones activas' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // 3. Deduplicar por MMSI y limpiar datos
    const latestVesselMap = new Map();
    vessels.forEach((v: any) => {
      if (!v.mmsi) return;
      const mmsiStr = String(v.mmsi);
      
      // Solo procesar si el MMSI está en nuestra lista (Seguridad para FK)
      if (!yachts.some(y => y.mmsi === mmsiStr)) {
        console.warn(`[Sync] MMSI ${mmsiStr} no está en luxury_yacht_list. Saltando.`);
        return;
      }

      const existing = latestVesselMap.get(mmsiStr);
      const currentTS = v.timestamp ? new Date(v.timestamp).getTime() : 0;
      const existingTS = (existing && existing.timestamp) ? new Date(existing.timestamp).getTime() : 0;
      
      if (!existing || (!isNaN(currentTS) && currentTS > existingTS)) {
        latestVesselMap.set(mmsiStr, v);
      }
    });

    const dedupedVessels = Array.from(latestVesselMap.values());
    console.log(`[Sync] Preparando upsert para ${dedupedVessels.length} posiciones únicas.`);

    // 4. Preparar datos para Upsert
    const positions = dedupedVessels.map((v: any) => ({
      mmsi: String(v.mmsi),
      latitude: Number(v.latitude),
      longitude: Number(v.longitude),
      speed: Number(v.sog || 0),
      course: Number(v.cog || 0),
      heading: Number(v.heading || 0),
      nav_status: v.nav_status !== null ? String(v.nav_status) : null,
      last_update: v.timestamp ? new Date(v.timestamp).toISOString() : new Date().toISOString(),
      destination: v.destination || null
    }))

    // 5. Guardar en la tabla luxury_yacht_positions
    const { error: upsertError } = await supabase
      .from('luxury_yacht_positions')
      .upsert(positions, { onConflict: 'mmsi' })

    if (upsertError) {
      console.error('[Sync] Database Error:', upsertError);
      throw upsertError;
    }

    return new Response(
      JSON.stringify({ success: true, count: positions.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error('[Sync Error]', error)
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.details || null,
      hint: error.hint || null
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
