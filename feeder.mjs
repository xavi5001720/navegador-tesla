/**
 * OPEN SKY DYNAMIC HOME FEEDER — DETECTIVE DE CASA V2.3
 * Polling adaptativo: ajusta el intervalo por zona según la proximidad
 * de los aviones al radio de detección del usuario (25 km).
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

const POLL_INTERVAL_MS   = 10_000;   // ciclo de comprobación de pedidos
const REPORT_INTERVAL_MS = 3_600_000; // informe horario
const REQUEST_STALE_MS   = 300_000;  // zona activa si fue pedida en los últimos 5 min
const USER_DETECT_RADIUS_M = 100_000; // radio de detección del usuario (100 km)
const MIN_POLL_MS        = 45_000;   // mínimo entre llamadas a OpenSky
const MAX_POLL_MS        = 300_000;  // máximo (5 min sin aviones cercanos)
const SAFETY_FACTOR      = 0.70;     // actuamos al 70% del tiempo estimado
const CREDITS_PER_CALL   = 1;
const DAILY_CREDIT_LIMIT = ACCOUNTS.length * 4_000;

// ── Contadores de sesión ───────────────────────────────────────────────────────
const sessionStart = Date.now();
let callsThisHour  = 0;
let callsToday     = 0;

// ── Mapa de próximo poll adaptativo por zona ──────────────────────────────────
// Map<bboxKey, { nextPollAt: number, lastInterval: number }>
const zonePollMap = new Map();

// ── Física ────────────────────────────────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6_371_000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Dado un avión (lat, lon, track, velocity) y la posición del usuario,
 * estima en segundos cuánto tardará el avión en entrar en el radio de detección.
 * Devuelve 0 si ya está dentro.
 */
function timeToEnterRadius(acLat, acLon, acTrack, acVelocity, userLat, userLon) {
  const dist = haversine(acLat, acLon, userLat, userLon);
  if (dist <= USER_DETECT_RADIUS_M) return 0; // ya dentro
  if (!acVelocity || acVelocity < 10) return Infinity; // parado o sin datos

  // Proyectamos el movimiento del avión 1 segundo hacia adelante
  // y estimamos si se está acercando (simplificación: usamos distancia directa)
  const trackRad = acTrack * Math.PI / 180;
  const cosLat = Math.cos(acLat * Math.PI / 180);
  const projLat = acLat + (acVelocity * Math.cos(trackRad)) / 111_111;
  const projLon = acLon + (acVelocity * Math.sin(trackRad)) / (111_111 * (cosLat || 1));
  const distAfter1s = haversine(projLat, projLon, userLat, userLon);

  if (distAfter1s >= dist) return Infinity; // alejándose, ignorar

  // Velocidad de aproximación (m/s)
  const approachSpeed = dist - distAfter1s;
  if (approachSpeed <= 0) return Infinity;

  return (dist - USER_DETECT_RADIUS_M) / approachSpeed; // segundos hasta entrar
}

/**
 * Calcula el intervalo óptimo de polling para una zona dado:
 * - los estados de aeronaves en caché (array OpenSky raw)
 * - la posición del usuario de esta zona (ulat, ulon)
 */
function calcAdaptiveInterval(states, userLat, userLon) {
  if (!userLat || !userLon || !states || states.length === 0) {
    return MAX_POLL_MS; // sin usuarios o sin aviones → máxima espera
  }

  let minTimeToEnter = Infinity;

  for (const s of states) {
    const lat = s[6], lon = s[5];
    const track = s[10] ?? 0;
    const velocity = s[9] ?? 0;
    const onGround = s[8] === true;

    if (lat == null || lon == null || onGround) continue;

    const t = timeToEnterRadius(lat, lon, track, velocity, userLat, userLon);
    if (t < minTimeToEnter) minTimeToEnter = t;
  }

  if (minTimeToEnter === 0) {
    // Avión ya dentro del radio → polling mínimo
    return MIN_POLL_MS;
  }
  if (minTimeToEnter === Infinity) {
    // Todos los aviones se alejan o zona vacía
    return MAX_POLL_MS;
  }

  // Aplicar factor de seguridad y convertir a ms, luego clampear
  const proposed = minTimeToEnter * SAFETY_FACTOR * 1_000;
  return Math.max(MIN_POLL_MS, Math.min(MAX_POLL_MS, proposed));
}

// ── API helpers ───────────────────────────────────────────────────────────────
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

async function getCachedStates(bboxKey) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/opensky_cache?bbox_key=eq.${bboxKey}&select=ts,states`, {
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
    });
    if (res.ok) {
      const rows = await res.json();
      if (rows.length > 0) return rows[0];
    }
  } catch (e) {}
  return null;
}

async function fulfillRequest(bboxKey, userLat, userLon, accountIndex) {
  const now = Date.now();
  const zoneState = zonePollMap.get(bboxKey);

  // 1. Comprobar si toca consultar según el intervalo adaptativo
  if (zoneState && now < zoneState.nextPollAt) {
    const waitSecs = Math.round((zoneState.nextPollAt - now) / 1000);
    const intervalSecs = Math.round(zoneState.lastInterval / 1000);
    console.log(`   ⏭️ Zona ${bboxKey} – próximo poll en ${waitSecs}s (intervalo adaptativo: ${intervalSecs}s)`);
    return true;
  }

  // 2. Consultar OpenSky
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

    callsThisHour++;
    callsToday++;

    // 3. Calcular próximo intervalo adaptativo
    const nextInterval = calcAdaptiveInterval(states, userLat, userLon);
    zonePollMap.set(bboxKey, { nextPollAt: now + nextInterval, lastInterval: nextInterval });

    const aircraftInRange = states.filter(s => {
      if (!s[6] || !s[5] || s[8] === true) return false;
      if (!userLat || !userLon) return false;
      return haversine(s[6], s[5], userLat, userLon) <= USER_DETECT_RADIUS_M;
    }).length;

    console.log(`   ✅ ${states.length} aviones (${aircraftInRange} en radio) | próximo poll: ${Math.round(nextInterval/1000)}s`);

    // 4. Subir a caché
    await fetch(`${SUPABASE_URL}/rest/v1/opensky_cache`, {
      method: 'POST',
      headers: {
        'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        bbox_key: bboxKey, states, rate_limited: false,
        account_index: (accountIndex % ACCOUNTS.length) + 1,
        ts: Date.now() + 300000, updated_at: new Date().toISOString()
      })
    });

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
    return { zones: rows.map(r => r.bbox_key), users: rows.length };
  } catch (e) {
    return { users: '?', zones: [] };
  }
}

function fmtDuration(ms) {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

async function printReport() {
  const { users, zones } = await getActiveStats();
  const uptime = Date.now() - sessionStart;
  const creditsTotal = callsToday * CREDITS_PER_CALL;
  const hoursRunning = uptime / 3_600_000;
  const projectedDaily = hoursRunning > 0 ? Math.round((creditsTotal / hoursRunning) * 24) : 0;
  const pctDailyLimit = Math.round((projectedDaily / DAILY_CREDIT_LIMIT) * 100);
  const now = new Date().toLocaleTimeString('es-ES');

  console.log('');
  console.log('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  🛰️  PEGASUS LIVE STATUS  —  ' + now);
  console.log('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  👥 Usuarios activos:          ${String(users).padStart(4)}`);
  console.log(`  🗺️  Zonas activas:             ${String(zones.length).padStart(4)}`);
  if (zones.length > 0) {
    zones.forEach(z => {
      const ps = zonePollMap.get(z);
      const nextIn = ps ? Math.max(0, Math.round((ps.nextPollAt - Date.now()) / 1000)) : '?';
      const interval = ps ? Math.round(ps.lastInterval / 1000) : '?';
      console.log(`        • ${z}  (poll cada ${interval}s, próximo en ${nextIn}s)`);
    });
  }
  console.log('');
  console.log('  💳 Créditos (API OpenSky):');
  console.log(`     Última hora:               ${String(callsThisHour).padStart(4)}  créditos`);
  console.log(`     Sesión (${fmtDuration(uptime).padEnd(6)}):         ${String(creditsTotal).padStart(4)}  créditos`);
  console.log(`     Estimación día completo:   ${String(projectedDaily).padStart(4)}  créditos  (${pctDailyLimit}% del límite)`);
  console.log(`     Límite total:              ${String(DAILY_CREDIT_LIMIT).padStart(4)}  créditos  (${ACCOUNTS.length} cuentas × 4.000)`);
  console.log('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  callsThisHour = 0;
}

async function main() {
  console.log(`[${new Date().toLocaleTimeString()}] Buscando pedidos...`);
  const now = Date.now();

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/opensky_requests?last_requested_at=gt.${now - REQUEST_STALE_MS}&select=*`,
      { headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` } }
    );
    
    if (!res.ok) throw new Error(await res.text());
    
    const requests = await res.json();
    if (requests.length === 0) return;

    for (let i = 0; i < requests.length; i++) {
      const req = requests[i];
      await fulfillRequest(req.bbox_key, req.ulat, req.ulon, i);
    }

  } catch (e) {
    console.error(`[ERR] Error en el ciclo:`, e.message);
  }
}

// ── Arranque ───────────────────────────────────────────────────────────────────
console.log('');
console.log('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  🛰️  PEGASUS HOME FEEDER  V2.3  —  Polling Adaptativo');
console.log('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  📡  Radio de detección: ${USER_DETECT_RADIUS_M / 1000} km`);
console.log(`  ⏱️  Intervalo: entre ${MIN_POLL_MS/1000}s y ${MAX_POLL_MS/1000}s según aviones cercanos`);
console.log(`  🔒  Factor de seguridad: ${SAFETY_FACTOR * 100}% del tiempo estimado`);
console.log(`  💰  Límite: ${DAILY_CREDIT_LIMIT} créditos/día (${ACCOUNTS.length} cuentas × 4.000)`);
console.log('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

main();
setInterval(main, POLL_INTERVAL_MS);
setInterval(printReport, REPORT_INTERVAL_MS);
