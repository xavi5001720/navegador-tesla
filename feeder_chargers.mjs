/**
 * EV CHARGERS FEEDER — ESTRATEGIA DE CARGA MASIVA (ONE-SHOT)
 * Corregido: La API OCM V3 no soporta offset. Se descarga todo España de golpe
 * y se sube a Supabase en lotes controlados para evitar errores de payload.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OCM_KEY = process.env.OPENCHARGE_API_KEY || 'fa85c4b7-19c1-4463-a71f-86936f68e0e4';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Error: Configuración de Supabase incompleta.');
  process.exit(1);
}

const DB_BATCH_SIZE = 1000; // Tamaño de lote para subir a Supabase

function checkIsFree(costStr, apiIsFree) {
  const s = (costStr || '').toLowerCase();
  const whiteList = ['gratis', 'free', '0.00', '0,00', '0€', '0 €', 'sin coste'];
  if (whiteList.some(k => s.includes(k))) return true;
  if (apiIsFree === false) return false;
  const blackList = ['€', 'kwh', 'min', 'pago', 'precio', 'tarifa'];
  if (blackList.some(k => s.includes(k))) return false;
  if (apiIsFree === true) return true;
  return false;
}

async function cleanDatabase() {
  console.log(`   🧹 Limpiando tabla ev_chargers en Supabase...`);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/clean_ev_chargers`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) throw new Error(`Error al limpiar: ${await res.text()}`);
  console.log(`   ✅ Tabla limpia.`);
}

async function updateChargers() {
  console.log(`\n🚀 INICIANDO SINCRONIZACIÓN MASIVA (ONE-SHOT)`);
  
  try {
    // 1. Limpiar base de datos
    await cleanDatabase();
    
    // 2. Descargar TODA España de golpe (OCM V3 no usa offset)
    console.log(`   📡 Descargando todos los cargadores de España (maxresults=50000)...`);
    const params = new URLSearchParams({
      key: OCM_KEY,
      countryid: '210',
      maxresults: '50000',
      compact: 'true',
      verbose: 'false'
    });
    
    const url = `https://api.openchargemap.io/v3/poi?${params.toString()}`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'NavegaPRO-Feeder-OneShot' }
    });

    if (!res.ok) throw new Error(`OCM API Error: ${res.status}`);
    const rawData = await res.json();

    if (!Array.isArray(rawData)) throw new Error('La respuesta de la API no es un array.');
    
    console.log(`   ✅ Descarga completada: ${rawData.length} cargadores encontrados.`);

    // 3. Procesar y preparar para Supabase
    const allProcessed = rawData.map(c => {
      const power = c.Connections?.reduce((max, conn) => Math.max(max, conn.PowerKW || 0), 0) || null;
      return {
        id: c.ID,
        lat: c.AddressInfo.Latitude,
        lon: c.AddressInfo.Longitude,
        title: c.AddressInfo.Title,
        address: c.AddressInfo.AddressLine1 || 'Sin dirección',
        operator: c.OperatorInfo?.Title || 'Desconocido',
        usage_cost: c.UsageCost || null,
        max_power: power,
        is_free: checkIsFree(c.UsageCost, c.UsageType?.IsPayAtLocation === false),
        connections_json: c.Connections || []
      };
    });

    // 4. Subir a Supabase en lotes (Chunks)
    console.log(`   ⬆️ Subiendo a Supabase en lotes de ${DB_BATCH_SIZE}...`);
    
    for (let i = 0; i < allProcessed.length; i += DB_BATCH_SIZE) {
      const chunk = allProcessed.slice(i, i + DB_BATCH_SIZE);
      console.log(`      📤 Subiendo lote ${Math.floor(i/DB_BATCH_SIZE) + 1} (${chunk.length} registros)...`);
      
      const resSupabase = await fetch(`${SUPABASE_URL}/rest/v1/rpc/upsert_ev_chargers`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_chargers: chunk })
      });

      if (!resSupabase.ok) throw new Error(`Error en Upsert: ${await resSupabase.text()}`);
    }

    console.log(`\n✨ ÉXITO TOTAL: ${allProcessed.length} cargadores sincronizados correctamente.\n`);

  } catch (err) {
    console.error(`\n❌ ERROR: ${err.message}\n`);
  }
}

updateChargers();
