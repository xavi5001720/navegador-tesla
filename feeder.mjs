/**
 * OPEN SKY DYNAMIC HOME FEEDER — DETECTIVE DE CASA V2.1 (Restaurado)
 * Versión estable basada en polling cada 10s y caché de 45s.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no están configuradas en .env.local');
  process.exit(1);
}

// Para retrocompatibilidad con las funciones internas del script
const ANON_KEY = SERVICE_KEY;

const ACCOUNTS = [
  { id: 'luliloqui-api-client', secret: 'YEXtTfBwCd5w2Kxhvp57W4C0s6f4Pb5n' },
  { id: 'pepinperez-api-client', secret: 'K922tGbRbq0DsrudGDVKQOJv3tYtnO6A' },
  { id: 'saracruzhortelana-api-client', secret: 'o7FsNtYuca4K6xSHBCb3x4zKo3yiwBS1' }
];

const OPENSKY_BASE = 'https://opensky-network.org/api';
const TOKEN_URL = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';

const POLL_INTERVAL_MS = 10_000;
const YACHT_POLL_INTERVAL_MS = 3600_000 * 5; // Cada 5 horas
const REQUEST_STALE_MS = 300_000;

const VESSEL_API_KEY = process.env.VESSEL_API_KEY;

// Distancia entre dos puntos (lat, lon) en metros
function haversine(p1, p2) {
  const R = 6371e3;
  const dLat = (p2[0] - p1[0]) * Math.PI / 180;
  const dLon = (p2[1] - p1[1]) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateDynamicInterval(planes = [], userPositions = []) {
    if (planes.length === 0) return 300_000; // 5 min si no hay nada
    if (userPositions.length === 0) return 300_000;

    let minDistance = Infinity;
    let closestVelocity = 100; // m/s por defecto

    for (const user of userPositions) {
        for (const plane of planes) {
            // Un plane en caché tiene formato: [icao24, callsign, country, ts, last_contact, lon, lat, alt, on_ground, velocity, track, ...]
            // (Ajustar según formato real guardado en opensky_cache.data.states)
            const pLat = plane[6];
            const pLon = plane[5];
            const pVel = plane[9] || 10;
            
            if (pLat != null && pLon != null) {
                const dist = haversine([user.lat, user.lon], [pLat, pLon]);
                if (dist < minDistance) {
                    minDistance = dist;
                    closestVelocity = Math.max(pVel, 10);
                }
            }
        }
    }

    const distKm = minDistance / 1000;
    
    // Reglas solicitadas
    if (distKm < 50) return 45_000; 
    if (distKm < 150) return 60_000 + Math.random() * 60_000; // 60-120s

    // > 150 km: usar ETI / 2 (tiempo estimado de llegada)
    const etiSeconds = minDistance / closestVelocity;
    const intervalMs = (etiSeconds / 2) * 1000;
    
    return Math.max(120_000, Math.min(300_000, intervalMs));
}

// ── Estadísticas Globales ───────────────────────────────────────────────────
let sessionStartTime = Date.now();
let totalCreditsSession = 0;
let creditsLastHour = 0;
let lastHourResetTime = Date.now();
let maxActiveUsers = 0;
let maxActiveZones = 0;
let currentActiveUsers = 0;
let currentActiveZones = 0;

function printLiveStatus(activeUsers = null, activeZones = null) {
  // Si no se pasan valores, usamos los últimos detectados en el ciclo
  const users = activeUsers !== null ? activeUsers : currentActiveUsers;
  const zones = activeZones !== null ? activeZones : currentActiveZones;

  const now = Date.now();
  const uptimeMs = now - sessionStartTime;
  
  // Actualizar récords
  if (users > maxActiveUsers) maxActiveUsers = users;
  if (zones > maxActiveZones) maxActiveZones = zones;
  const hoursUptime = uptimeMs / (1000 * 60 * 60);
  const timeStr = new Date().toLocaleTimeString();
  
  // Limpiar contador de hora si ha pasado 1 hora
  if (now - lastHourResetTime > 3600000) {
    creditsLastHour = 0;
    lastHourResetTime = now;
  }

  // Estimación diaria
  const estDaily = hoursUptime > 0 ? Math.round((totalCreditsSession / hoursUptime) * 24) : 0;
  const limitTotal = ACCOUNTS.length * 4000;
  const percentLimit = limitTotal > 0 ? Math.round((estDaily / limitTotal) * 100) : 0;
  
  const h = Math.floor(hoursUptime);
  const m = Math.floor((hoursUptime - h) * 60);

  console.log(`\n  🛰️ PEGASUS LIVE STATUS — ${timeStr}`);
  console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  👥 Usuarios activos:             ${users}  (Máx: ${maxActiveUsers})`);
  console.log(`  🗺️ Zonas activas:                ${zones}  (Máx: ${maxActiveZones})`);
  console.log(``);
  console.log(`  💳 Créditos (API OpenSky):`);
  console.log(`     Última hora:                  ${creditsLastHour} créditos`);
  console.log(`     Sesión (${h}h ${m}m):              ${totalCreditsSession} créditos`);
  console.log(`     Estimación día completo:    ${estDaily} créditos (${percentLimit}% del límite)`);
  console.log(`     Límite total:              ${limitTotal} créditos (${ACCOUNTS.length} cuentas × 4.000)`);
  console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

async function getAccessToken(acc) {
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: acc.id, client_secret: acc.secret })
    });
    return (await res.json()).access_token;
  } catch (e) { return null; }
}

async function fulfillRequest(bboxKey, userPositions, accountIndex) {
  const now = Date.now();
  const acc = ACCOUNTS[accountIndex % ACCOUNTS.length];
  
  // 1. Verificar si ya tenemos datos frescos en caché (DINÁMICO)
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/opensky_cache?bbox_key=eq.${bboxKey}&select=updated_at,states&order=updated_at.desc&limit=1`, {
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
    });

    if (res.ok) {
      const cached = await res.json();
      if (cached && cached.length > 0) {
        const lastUpdate = new Date(cached[0].updated_at || Date.now()).getTime();
        const planes = cached[0].states || [];
        
        // Calculamos cuánto debería durar la "frescura" de esta zona ahora
        const dynamicFreshness = calculateDynamicInterval(planes, userPositions);
        const elapsed = now - lastUpdate;

        if (elapsed < dynamicFreshness) {
          console.log(`   ⏳ [${bboxKey}]: PAUSA INTELIGENTE (${Math.round((dynamicFreshness - elapsed)/1000)}s restantes). Intervalo: ${Math.round(dynamicFreshness/1000)}s.`);
          return true;
        }
        console.log(`   🚀 [${bboxKey}]: REFRESCO NECESARIO (Pasaron ${Math.round(elapsed/1000)}s > ${Math.round(dynamicFreshness/1000)}s).`);
      }
    }
  } catch (e) { 
    console.warn(`   ⚠️ Error consultando SmartPoll para ${bboxKey}:`, e.message); 
  }

  // 2. Si no hay caché o es vieja, consultar OpenSky
  const parts = bboxKey.split('_').map(Number);
  if (parts.length < 4) return false;
  const [lamin, lomin, lamax, lomax] = parts;

  console.log(`   📡 Llamando a OpenSky [Cuenta ${accountIndex+1}] para ${bboxKey}...`);
  
  const token = await getAccessToken(acc);
  if (!token) return false;

  const url = `${OPENSKY_BASE}/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
  
  try {
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) {
      if (res.status === 429) console.warn(`   ⚠️ 429 Rate Limit en cuenta ${accountIndex+1}`);
      return false;
    }

    const data = await res.json();
    const states = data.states || [];

    // 3. Subir a caché
    await fetch(`${SUPABASE_URL}/rest/v1/opensky_cache`, {
      method: 'POST',
      headers: {
        'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        bbox_key: bboxKey, states: states, rate_limited: false,
        account_index: (accountIndex % ACCOUNTS.length) + 1,
        ts: Date.now() + 300000, updated_at: new Date().toISOString()
      })
    });

    console.log(`   ✅ OK: ${states.length} aviones subidos para ${bboxKey}`);
    totalCreditsSession++;
    creditsLastHour++;
    return true;
  } catch (e) {
    console.error(`   ❌ Error: ${e.message}`);
    return false;
  }
}

async function main() {
  const now = Date.now();
  console.log(`[${new Date().toLocaleTimeString()}] Buscando pedidos...`);

  try {
    // Buscamos peticiones activas de los últimos 5 minutos
    const res = await fetch(`${SUPABASE_URL}/rest/v1/opensky_requests?last_requested_at=gt.${now - REQUEST_STALE_MS}&select=*`, {
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
    });
    
    if (!res.ok) throw new Error(await res.text());
    
    const requests = await res.json();
    const currentActiveUsers = new Set(requests.map(r => `${r.ulat?.toFixed(2)}_${r.ulon?.toFixed(2)}`)).size;
    currentActiveZones = new Set(requests.map(r => r.bbox_key)).size;

    // Actualizar picos en silencio
    if (currentActiveUsers > maxActiveUsers) maxActiveUsers = currentActiveUsers;
    if (currentActiveZones > maxActiveZones) maxActiveZones = currentActiveZones;

    // Agrupar peticiones por zona
    const zones = {};
    for (const r of requests) {
        if (!zones[r.bbox_key]) zones[r.bbox_key] = [];
        zones[r.bbox_key].push({ lat: r.ulat, lon: r.ulon });
    }

    const zoneKeys = Object.keys(zones);
    for (let i = 0; i < zoneKeys.length; i++) {
        const bboxKey = zoneKeys[i];
        await fulfillRequest(bboxKey, zones[bboxKey], i);
    }

  } catch (e) {
    console.error(`[ERR] Error en el ciclo:`, e.message);
  }
}

async function syncYachts() {
  console.log(`[${new Date().toLocaleTimeString()}] ⛴️ Sincronizando posiciones de Yates...`);
  if (!VESSEL_API_KEY) {
    console.warn('   ⚠️ VESSEL_API_KEY no configurada. Saltando barcos.');
    return;
  }

  // OPTIMIZACIÓN: No consultar si los datos están frescos en Supabase (Ahorro de créditos)
  try {
    const resCheck = await fetch(`${SUPABASE_URL}/rest/v1/luxury_yacht_positions?select=last_update&order=last_update.desc&limit=1`, {
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
    });
    if (resCheck.ok) {
      const lastPos = await resCheck.json();
      if (lastPos && lastPos.length > 0) {
        const lastUpdate = new Date(lastPos[0].last_update).getTime();
        const elapsed = Date.now() - lastUpdate;
        if (elapsed < YACHT_POLL_INTERVAL_MS) {
          const remaining = Math.round((YACHT_POLL_INTERVAL_MS - elapsed) / 60000);
          console.log(`   ⏳ [Barcos]: Datos frescos (${Math.round(elapsed/60000)}m de antigüedad). Faltan ${remaining}m para el próximo refresco.`);
          return;
        }
      }
    }
  } catch (e) {
    console.warn('   ⚠️ Error verificando caché de barcos:', e.message);
  }

  try {
    // 1. Obtener MMSIs
    const resList = await fetch(`${SUPABASE_URL}/rest/v1/luxury_yacht_list?select=mmsi`, {
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
    });
    if (!resList.ok) throw new Error(`Error lista: ${resList.statusText}`);
    const yachts = await resList.json();
    if (!yachts || yachts.length === 0) return;

    const mmsis = yachts.map(y => y.mmsi).join(',');
    const vesselUrl = `https://api.vesselapi.com/v1/vessels/positions?filter.ids=${mmsis}&filter.idType=mmsi`;

    // 2. Consultar VesselAPI (El servidor exige prefijo Bearer)
    const cleanKey = VESSEL_API_KEY.trim();
    const resVessel = await fetch(vesselUrl, { 
      headers: { 
        'Authorization': `Bearer ${cleanKey}`,
        'Content-Type': 'application/json'
      } 
    });

    if (!resVessel.ok) {
        const errText = await resVessel.text();
        console.error(`   ❌ Fallo en VesselAPI (${resVessel.status}): ${errText}`);
        throw new Error(`Auth failed (HTTP ${resVessel.status})`);
    }

    const data = await resVessel.json();
    const vessels = data.vesselPositions || [];
    
    // Deduplicar: Mantener solo la posición más reciente por cada MMSI
    const latestVesselMap = new Map();
    vessels.forEach(v => {
      const existing = latestVesselMap.get(String(v.mmsi));
      const currentTS = v.timestamp ? new Date(v.timestamp).getTime() : 0;
      const existingTS = existing?.timestamp ? new Date(existing.timestamp).getTime() : 0;
      
      if (!existing || currentTS > existingTS) {
        latestVesselMap.set(String(v.mmsi), v);
      }
    });

    const positions = Array.from(latestVesselMap.values()).map(v => ({
      mmsi: String(v.mmsi),
      latitude: v.latitude ? parseFloat(v.latitude) : null,
      longitude: v.longitude ? parseFloat(v.longitude) : null,
      speed: v.sog ? parseFloat(v.sog) : 0,
      course: v.cog ? parseFloat(v.cog) : 0,
      heading: v.heading ? parseFloat(v.heading) : null,
      nav_status: v.nav_status !== null ? String(v.nav_status) : null,
      last_update: v.timestamp ? new Date(v.timestamp).toISOString() : new Date().toISOString(),
      destination: v.destination || null
    }));

    // 3. Upsert a Supabase
    const resUpsert = await fetch(`${SUPABASE_URL}/rest/v1/luxury_yacht_positions`, {
      method: 'POST',
      headers: {
        'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(positions)
    });

    if (!resUpsert.ok) {
        const body = await resUpsert.text();
        throw new Error(`Upsert (${resUpsert.status}): ${body}`);
    }
    console.log(`   ✅ OK: ${positions.length} yates actualizados.`);
  } catch (e) {
    console.error(`   ❌ Error en barcos:`, e.message);
  }
}

console.log(`-----------------------------------------`);
console.log(`DETECTIVE DINÁMICO (V2.1 RESTAURADO)`);
console.log(`Estado: Estable (Polling Periódico)`);
console.log(`-----------------------------------------`);

main();
syncYachts(); // Primera carga de barcos al arrancar

setInterval(main, POLL_INTERVAL_MS);
setInterval(syncYachts, YACHT_POLL_INTERVAL_MS); // Cada 5 horas

// Informe de estado cada 1 hora (automático)
setInterval(() => {
  printLiveStatus();
}, 3600000);
