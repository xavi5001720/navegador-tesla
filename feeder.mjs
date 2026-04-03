/**
 * OPEN SKY DYNAMIC HOME FEEDER — DETECTIVE DE CASA V2.2
 * Versión optimizada: Ahorro de API activado + Informe horario de estado.
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

const POLL_INTERVAL_MS  = 10_000;
const REPORT_INTERVAL_MS = 3_600_000; // 1 hora
const REQUEST_STALE_MS  = 300_000;
const CACHE_FRESH_MS    = 45_000;
const CREDITS_PER_CALL  = 1; // bbox < 25 sq° siempre cuesta 1 crédito
const DAILY_CREDIT_LIMIT = ACCOUNTS.length * 4_000; // 4000/día/cuenta

// ── Contadores de sesión ───────────────────────────────────────────────────────
const sessionStart = Date.now();
let callsThisHour  = 0;   // llamadas reales a OpenSky en la última hora
let callsToday     = 0;   // llamadas reales a OpenSky desde que arrancó
let lastHourReset  = Date.now();

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
  if (parts.length !== 4) return false;
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

    // Contadores
    callsThisHour++;
    callsToday++;

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

async function getActiveStats() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/opensky_requests?last_requested_at=gt.${Date.now() - REQUEST_STALE_MS}&select=bbox_key`,
      { headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` } }
    );
    if (!res.ok) return { users: '?', zones: [] };
    const rows = await res.json();
    return {
      zones: rows.map(r => r.bbox_key),
      users: rows.length  // cada zona activa = al menos 1 usuario activo en ella
    };
  } catch (e) {
    return { users: '?', zones: [] };
  }
}

function fmtDuration(ms) {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

async function printReport() {
  const { users, zones } = await getActiveStats();
  const uptime = Date.now() - sessionStart;
  const creditsHour = callsThisHour * CREDITS_PER_CALL;
  const creditsTotal = callsToday * CREDITS_PER_CALL;

  // Proyección al día completo basada en el tiempo corrido
  const hoursRunning = uptime / 3_600_000;
  const projectedDaily = hoursRunning > 0
    ? Math.round((creditsTotal / hoursRunning) * 24)
    : 0;
  const pctDailyLimit = Math.round((projectedDaily / DAILY_CREDIT_LIMIT) * 100);

  const now = new Date().toLocaleTimeString('es-ES');

  console.log('');
  console.log('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  🛰️  PEGASUS LIVE STATUS  —  ' + now);
  console.log('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  👥 Usuarios activos:          ${String(users).padStart(4)}`);
  console.log(`  🗺️  Zonas activas:             ${String(zones.length).padStart(4)}`);
  if (zones.length > 0) {
    zones.forEach(z => console.log(`        • ${z}`));
  }
  console.log('');
  console.log('  💳 Créditos (API OpenSky):');
  console.log(`     Última hora:               ${String(creditsHour).padStart(4)}  créditos`);
  console.log(`     Sesión (${fmtDuration(uptime).padEnd(6)}):         ${String(creditsTotal).padStart(4)}  créditos`);
  console.log(`     Estimación día completo:   ${String(projectedDaily).padStart(4)}  créditos  (${pctDailyLimit}% del límite)`);
  console.log(`     Límite diario total:       ${String(DAILY_CREDIT_LIMIT).padStart(4)}  créditos  (${ACCOUNTS.length} cuentas × 4.000)`);
  console.log('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // Reset contador de hora
  callsThisHour = 0;
  lastHourReset = Date.now();
}

async function main() {
  const now = Date.now();
  console.log(`[${new Date().toLocaleTimeString()}] Buscando pedidos...`);

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/opensky_requests?last_requested_at=gt.${now - REQUEST_STALE_MS}&select=*`, {
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
    });
    
    if (!res.ok) throw new Error(await res.text());
    
    const requests = await res.json();
    if (requests.length === 0) return;

    for (let i = 0; i < requests.length; i++) {
      await fulfillRequest(requests[i].bbox_key, i);
    }

  } catch (e) {
    console.error(`[ERR] Error en el ciclo:`, e.message);
  }
}

// ── Arranque ───────────────────────────────────────────────────────────────────
console.log('');
console.log('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  🛰️  PEGASUS HOME FEEDER  V2.2');
console.log('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  ⏱️  Mínimo 45s entre llamadas a la API de OpenSky`);
console.log(`  📊  Informe de estado cada 1 hora`);
console.log(`  💳  Créditos cada llamada: 1 (bbox < 25 sq°)`);
console.log(`  💰  Límite total: ${DAILY_CREDIT_LIMIT} créditos/día (${ACCOUNTS.length} cuentas)`);
console.log('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

main();
setInterval(main, POLL_INTERVAL_MS);
setInterval(printReport, REPORT_INTERVAL_MS);
