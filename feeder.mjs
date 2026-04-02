/**
 * OPEN SKY DYNAMIC HOME FEEDER — DETECTIVE DE CASA V2
 * Este script corre en tu ordenador local y vigila qué zonas necesita tu Tesla.
 * 
 * Ejecución: node feeder.mjs
 */

const SUPABASE_URL = 'https://uhvwptagewswfiluqgmc.supabase.co';
const ANON_KEY = 'sb_publishable_9EUX4dnQ9rqxS9Bon7SKVg_HXrII5vD';

const ACCOUNTS = [
  { id: 'luliloqui-api-client', secret: 'YEXtTfBwCd5w2Kxhvp57W4C0s6f4Pb5n' },
  { id: 'pepinperez-api-client', secret: 'K922tGbRbq0DsrudGDVKQOJv3tYtnO6A' },
  { id: 'saracruzhortelana-api-client', secret: 'o7FsNtYuca4K6xSHBCb3x4zKo3yiwBS1' }
];

const OPENSKY_BASE = 'https://opensky-network.org/api';
const TOKEN_URL = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';

const POLL_INTERVAL_MS = 10_000; // Mira si hay pedidos cada 10s
const REQUEST_STALE_MS = 300_000; // Ignora pedidos de hace más de 5 min

async function getAccessToken(acc) {
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials', client_id: acc.id, client_secret: acc.secret,
      })
    });
    return (await res.json()).access_token;
  } catch (e) { return null; }
}

async function fulfillRequest(bboxKey, accountIndex) {
  // Parsing bbox_key: "40.0_-4.5_41.0_-3.0"
  const parts = bboxKey.split('_').map(Number);
  if (parts.length !== 4) return false;
  const [lamin, lomin, lamax, lomax] = parts;

  console.log(`   → Consultando OpenSky para zona: ${bboxKey}...`);
  
  const token = await getAccessToken(ACCOUNTS[accountIndex % ACCOUNTS.length]);
  if (!token) return false;

  const url = `${OPENSKY_BASE}/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
  
  try {
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) return false;

    const data = await res.json();
    const states = data.states || [];

    // Subir a caché
    await fetch(`${SUPABASE_URL}/rest/v1/opensky_cache`, {
      method: 'POST',
      headers: {
        'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        bbox_key: bboxKey, states: states, rate_limited: false,
        account_index: (accountIndex % ACCOUNTS.length) + 1,
        ts: Date.now(), updated_at: new Date().toISOString()
      })
    });

    console.log(`   ✅ OK: ${states.length} aviones subidos.`);
    return true;
  } catch (e) {
    console.error(`   ❌ Error: ${e.message}`);
    return false;
  }
}

async function main() {
  const now = Date.now();
  console.log(`[${new Date().toLocaleTimeString()}] Buscando pedidos de dispositivos...`);

  try {
    // 1. Obtener pedidos recientes (últimos 5 minutos)
    const res = await fetch(`${SUPABASE_URL}/rest/v1/opensky_requests?last_requested_at=gt.${now - REQUEST_STALE_MS}&select=*`, {
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
    });
    
    if (!res.ok) throw new Error(await res.text());
    
    const requests = await res.json();
    
    if (requests.length === 0) {
      console.log(`   No hay dispositivos activos pidiendo datos en este momento.`);
      return;
    }

    console.log(`   Hay ${requests.length} zona(s) activa(s) que necesitan datos.`);
    
    // 2. Atender cada pedido
    for (let i = 0; i < requests.length; i++) {
      await fulfillRequest(requests[i].bbox_key, i);
    }

  } catch (e) {
    console.error(`[ERR] Error en el ciclo principal:`, e.message);
  }
}

console.log(`-----------------------------------------`);
console.log(`DETECTIVE DINÁMICO ACTIVADO (V2)`);
console.log(`Vigilando pedidos cada ${POLL_INTERVAL_MS/1000}s`);
console.log(`Usa tu Tesla y este script te seguirá allá donde vayas.`);
console.log(`-----------------------------------------`);

main();
setInterval(main, POLL_INTERVAL_MS);
