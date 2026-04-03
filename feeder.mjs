/**
 * OPEN SKY DYNAMIC HOME FEEDER — DETECTIVE DE CASA V2.1 (Restaurado)
 * Versión estable basada en polling cada 10s y caché de 45s.
 */

const SUPABASE_URL = 'https://uhvwptagewswfiluqgmc.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVodndwdGFnZXdzd2ZpbHVxZ21jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MDI4NTEsImV4cCI6MjA5MDM3ODg1MX0.LEygUxMX0zzrkRVv8MJivhPDmy6yp2KIlaU3oICjyAk';

const ACCOUNTS = [
  { id: 'luliloqui-api-client', secret: 'YEXtTfBwCd5w2Kxhvp57W4C0s6f4Pb5n' },
  { id: 'pepinperez-api-client', secret: 'K922tGbRbq0DsrudGDVKQOJv3tYtnO6A' },
  { id: 'saracruzhortelana-api-client', secret: 'o7FsNtYuca4K6xSHBCb3x4zKo3yiwBS1' }
];

const OPENSKY_BASE = 'https://opensky-network.org/api';
const TOKEN_URL = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';

const POLL_INTERVAL_MS = 10_000;
const REQUEST_STALE_MS = 300_000;
const CACHE_FRESH_MS   = 45_000; // Si el dato tiene menos de 45s, NO llamamos a la API

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

async function fulfillRequest(bboxKey, accountIndex) {
  const now = Date.now();
  
  // 1. Verificar si ya tenemos datos frescos en caché
  try {
    const cacheCheck = await fetch(`${SUPABASE_URL}/rest/v1/opensky_cache?bbox_key=eq.${bboxKey}&select=ts`, {
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
    });
    if (cacheCheck.ok) {
      const cached = await cacheCheck.json();
      if (cached.length > 0) {
        // En la base de datos, ts tiene un offset de +5min para sincronización
        const realTs = cached[0].ts - 300000;
        if ((now - realTs) < CACHE_FRESH_MS) {
          console.log(`   ⏭️ Zona ${bboxKey} ya tiene datos frescos (${Math.round((now - realTs)/1000)}s). Saltando...`);
          return true;
        }
      }
    }
  } catch (e) { console.warn(`   ⚠️ No se pudo consultar caché previa:`, e.message); }

  // 2. Si no hay caché o es vieja, consultar OpenSky
  const parts = bboxKey.split('_').map(Number);
  if (parts.length < 4) return false;
  // Bbox de la macro-zona
  const [lamin, lomin, lamax, lomax] = parts;

  console.log(`   🚀 Consultando OpenSky para zona: ${bboxKey}...`);
  
  const token = await getAccessToken(ACCOUNTS[accountIndex % ACCOUNTS.length]);
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
    if (requests.length === 0) {
        console.log(`   😴 Sin pedidos activos.`);
        return;
    }

    for (let i = 0; i < requests.length; i++) {
      await fulfillRequest(requests[i].bbox_key, i);
    }

  } catch (e) {
    console.error(`[ERR] Error en el ciclo:`, e.message);
  }
}

console.log(`-----------------------------------------`);
console.log(`DETECTIVE DINÁMICO (V2.1 RESTAURADO)`);
console.log(`Estado: Estable (Polling Periódico)`);
console.log(`-----------------------------------------`);

main();
setInterval(main, POLL_INTERVAL_MS);
