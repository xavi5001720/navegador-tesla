import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// ── Constantes ────────────────────────────────────────────────────────────────
const OPENSKY_BASE = 'https://opensky-network.org/api';
const TOKEN_URL    = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';

// Tamaño del snap al grid: 0.5° ≈ 55 km. Cualquier usuario dentro del mismo
// cuadrante comparte la misma clave de caché, eliminando peticiones redundantes.
const SNAP_SIZE = 0.5; // grados

// Caché activa: 10 s (OpenSky actualiza datos cada 5-10 s para autenticados).
// Este valor mantiene los datos frescos sin duplicar peticiones entre clientes.
const CACHE_TTL_MS = 10_000;

// ── Credenciales (solo en servidor — nunca llegan al navegador) ───────────────
const ACCOUNTS = [
  { id: 'luliloqui-api-client', secret: 'YEXtTfBwCd5w2Kxhvp57W4C0s6f4Pb5n' },
  { id: 'pepinperez-api-client', secret: 'K922tGbRbq0DsrudGDVKQOJv3tYtnO6A' },
  { id: 'saracruzhortelana-api-client', secret: 'o7FsNtYuca4K6xSHBCb3x4zKo3yiwBS1' }
];

// ── Aerolíneas comerciales — se excluyen de las alertas sospechosas ───────────
const COMMERCIAL_RE = /^(EAX|IBE|RYR|VLG|EZY|AFR|DLH|KLM|BAW)/i;

// ── Aeropuertos principales de España ─────────────────────────────────────────
const AIRPORTS: [number, number][] = [
  [40.4936, -3.5668], [41.2971, 2.0785], [37.4274, -5.8931],
  [36.6749, -4.4990], [39.5526, 2.7388], [28.4527, -13.8655],
  [27.9319, -15.3866], [28.0445, -16.5725], [28.4827, -16.3415],
  [38.8722, 1.3731],  [43.3011, -8.3777], [43.3565, -5.8603],
  [43.3010, -1.7921], [43.3011, -3.8257], [39.4926, -0.4815],
  [38.1814, -1.0014], [38.2816, -0.5582], [36.7878, -2.3696],
];
const AIRPORT_RADIUS_M = 5_000;

// ─────────────────────────────────────────────────────────────────────────────
// TOKEN MANAGER — gestión multicuenta con renovación automática
// ─────────────────────────────────────────────────────────────────────────────
async function getToken(index: number): Promise<string | null> {
  const account = ACCOUNTS[index];
  if (!account) return null;

  const now = Date.now();

  const { data: dbToken } = await supabase
    .from('opensky_tokens')
    .select('token, expires_at')
    .eq('account_id', account.id)
    .single();

  if (dbToken?.token && dbToken.expires_at > now) {
    return dbToken.token;
  }

  try {
    console.log(`[aircrafts] 🔑 Obteniendo token para cuenta ${index + 1} (${account.id})`);
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type   : 'client_credentials',
        client_id    : account.id,
        client_secret: account.secret,
      }),
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error(`[aircrafts] Error token cuenta ${index + 1}:`, res.status);
      return null;
    }

    const d = await res.json();
    if (d.access_token) {
      const expiresAt = Date.now() + (d.expires_in ?? 1800) * 1_000 - 5 * 60_000;
      console.log(`[aircrafts] ✅ Token cuenta ${index + 1} renovado`);

      await supabase
        .from('opensky_tokens')
        .upsert({
          account_id: account.id,
          token: d.access_token,
          expires_at: expiresAt,
          updated_at: new Date().toISOString()
        });

      return d.access_token;
    }
  } catch (e) {
    console.error(`[aircrafts] Error token cuenta ${index + 1}:`, e);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SNAPPING — alinea el bbox a una cuadrícula global fija de SNAP_SIZE grados.
// Garantiza que usuarios próximos compartan la misma clave de caché.
// ─────────────────────────────────────────────────────────────────────────────
function snapDown(v: number): number { return Math.floor(v / SNAP_SIZE) * SNAP_SIZE; }
function snapUp  (v: number): number { return Math.ceil (v / SNAP_SIZE) * SNAP_SIZE; }

interface SnappedBbox {
  lamin: number; lomin: number; lamax: number; lomax: number;
  key  : string;           // clave canónica para la caché
  sqDeg: number;           // área en grados² (para el crédito log)
}

function snapBbox(lamin: number, lomin: number, lamax: number, lomax: number): SnappedBbox {
  const sLamin = snapDown(lamin);
  const sLomin = snapDown(lomin);
  const sLamax = snapUp  (lamax);
  const sLomax = snapUp  (lomax);
  const key   = `${sLamin.toFixed(1)}_${sLomin.toFixed(1)}_${sLamax.toFixed(1)}_${sLomax.toFixed(1)}`;
  const sqDeg = (sLamax - sLamin) * (sLomax - sLomin);
  return { lamin: sLamin, lomin: sLomin, lamax: sLamax, lomax: sLomax, key, sqDeg };
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULTADO CACHÉ — tipos para el helper
// ─────────────────────────────────────────────────────────────────────────────
interface CacheResult {
  states      : any[];
  ts          : number;
  rateLimited : boolean;
  accountIndex: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// HAVERSINE & HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function haversine(p1: [number, number], p2: [number, number]): number {
  const R    = 6_371_000;
  const dLat = (p2[0] - p1[0]) * Math.PI / 180;
  const dLon = (p2[1] - p1[1]) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
    + Math.cos(p1[0] * Math.PI / 180)
    * Math.cos(p2[0] * Math.PI / 180)
    * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isNearAirport(lat: number, lon: number): boolean {
  return AIRPORTS.some(ap => haversine([lat, lon], ap) < AIRPORT_RADIUS_M);
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH RAW — petición única con rotación de cuentas
// ─────────────────────────────────────────────────────────────────────────────
async function fetchFromOpenSkyWithRotation(bbox: SnappedBbox): Promise<{ states: any[]; rateLimited: boolean; accountIndex: number }> {
  const { lamin, lomin, lamax, lomax, sqDeg } = bbox;
  const url = `${OPENSKY_BASE}/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
  const now = Date.now();

  const { data: dbTokens } = await supabase
    .from('opensky_tokens')
    .select('account_id, cooldown_until');

  for (let i = 0; i < ACCOUNTS.length; i++) {
    const account = ACCOUNTS[i];
    const accountState = dbTokens?.find(t => t.account_id === account.id);

    if (accountState?.cooldown_until && accountState.cooldown_until > now) {
      console.log(`[aircrafts] ⏳ Cuenta ${i + 1} en cooldown, probando siguiente...`);
      continue;
    }

    const token = await getToken(i);
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    console.log(`[aircrafts] → OpenSky (Account ${i + 1}) bbox=${bbox.key} coste≈${sqDeg <= 25 ? 1 : 2}`);
    
    try {
      const res = await fetch(url, { headers, cache: 'no-store' });
      
      if (!res.ok) {
        let retrySecs = 60;
        if (res.status === 429) {
          retrySecs = parseInt(res.headers.get('X-Rate-Limit-Retry-After-Seconds') ?? '60');
          console.warn(`[aircrafts] ⚠️ Account ${i + 1} rate limited (429). Retry in ${retrySecs}s.`);
        } else {
          console.error(`[aircrafts] ⚠️ Account ${i + 1} HTTP Error ${res.status}. Cooldown 60s.`);
        }
        
        const cooldownUntil = Date.now() + (retrySecs * 1000);
        
        await supabase
          .from('opensky_tokens')
          .upsert({
            account_id: account.id,
            cooldown_until: cooldownUntil,
            updated_at: new Date().toISOString()
          });

        continue;
      }

      const data = await res.json();
      return { 
        states: data?.states ?? [], 
        rateLimited: false, 
        accountIndex: i + 1 
      };

    } catch (error) {
      console.error(`[aircrafts] Fallo crítico cuenta ${i + 1}:`, error);
      continue;
    }
  }

  return { states: [], rateLimited: true, accountIndex: -1 };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET FROM CACHE — sirve desde Supabase o lanza una petición deduplicada
// ─────────────────────────────────────────────────────────────────────────────
async function getCachedStates(bbox: SnappedBbox): Promise<CacheResult> {
  const now = Date.now();
  
  const { data: existing } = await supabase
    .from('opensky_cache')
    .select('states, rate_limited, account_index, ts')
    .eq('bbox_key', bbox.key)
    .single();

  if (existing && existing.ts && (now - existing.ts) < CACHE_TTL_MS) {
    return {
      states: existing.states ?? [],
      ts: existing.ts,
      rateLimited: existing.rate_limited ?? false,
      accountIndex: existing.account_index ?? -1
    };
  }

  const result = await fetchFromOpenSkyWithRotation(bbox);
  const ts = Date.now();

  await supabase
    .from('opensky_cache')
    .upsert({
      bbox_key: bbox.key,
      states: result.states,
      rate_limited: result.rateLimited,
      account_index: result.accountIndex,
      ts: ts,
      updated_at: new Date().toISOString()
    });

  return { ...result, ts };
}

// ─────────────────────────────────────────────────────────────────────────────
// MARCAR SOSPECHOSOS — se calcula aquí para no enviar todo al cliente
// ─────────────────────────────────────────────────────────────────────────────
function enrichState(s: any, userLat?: number, userLon?: number) {
  const callsign    = (s[1] || '').trim();
  const isCommercial = COMMERCIAL_RE.test(callsign);
  const altitude    = s[7] ?? s[13] ?? 0;
  const velocity    = s[9] ?? 0;
  const lat         = s[6], lon = s[5];
  const icao24      = s[0] || '';

  const hasWatchCallsign = /DGT|PESG|SAER|POLIC|GUARDIA|GC|POL/i.test(callsign);
  const isDGT            = icao24.startsWith('34');
  const isLow            = altitude < 1000;
  const isSlow           = velocity < 60;       // m/s → ≈ 216 km/h
  const nearAirport      = isNearAirport(lat, lon);
  const onGround         = s[8] === true;

  // Ignoramos aeronaves en tierra
  if (onGround) return null;

  const isSuspect = !isCommercial
    && (hasWatchCallsign || isDGT || ((isLow && isSlow) && !nearAirport));

  return {
    icao24,
    callsign       : callsign || 'N/A',
    origin_country : s[2] || '',
    lon, lat,
    altitude,
    velocity,
    track          : s[10] ?? 0,
    on_ground      : onGround,
    isSuspect,
    // Distancia al usuario (si se facilitó), calculada en servidor para reducir JS en cliente
    distanceToUser : (userLat != null && userLon != null)
      ? haversine([userLat, userLon], [lat, lon])
      : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER  GET /api/aircrafts?lamin=…&lomin=…&lamax=…&lomax=…
//          Parámetros opcionales: ulat, ulon (posición del usuario)
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const sp    = new URL(request.url).searchParams;
  const lamin = parseFloat(sp.get('lamin') ?? '');
  const lomin = parseFloat(sp.get('lomin') ?? '');
  const lamax = parseFloat(sp.get('lamax') ?? '');
  const lomax = parseFloat(sp.get('lomax') ?? '');

  if ([lamin, lomin, lamax, lomax].some(isNaN)) {
    return NextResponse.json(
      { error: 'Parámetros requeridos: lamin, lomin, lamax, lomax' },
      { status: 400 }
    );
  }

  // Posición del usuario (opcional — para precalcular distancias en servidor)
  const ulat = sp.get('ulat') ? parseFloat(sp.get('ulat')!) : undefined;
  const ulon = sp.get('ulon') ? parseFloat(sp.get('ulon')!) : undefined;

  // ── 1. Alinear el bbox a la rejilla global ────────────────────────────────
  const bbox = snapBbox(lamin, lomin, lamax, lomax);

  // ── 2. Obtener datos (caché con rotación o fetch deduplicado) ────────────
  const { states: rawStates, rateLimited, ts, accountIndex } = await getCachedStates(bbox);

  // ── 3. Filtrar nulos de posición + enriquecer ─────────────────────────────
  const withPos  = rawStates.filter(s => s[6] != null && s[5] != null);
  const enriched = withPos.map(s => enrichState(s, ulat, ulon)).filter(Boolean);

  const suspects = enriched.filter(a => a!.isSuspect && a!.altitude >= 100 && a!.altitude <= 2_000 && a!.velocity <= 83.33);

  console.log(`[aircrafts] → cliente: ${enriched.length} aeronaves | ${suspects.length} sospechosas | account=${accountIndex} | rateLimited=${rateLimited}`);

  return NextResponse.json({
    states     : enriched,       // todas (comerciales + sospechosas) para visualización en mapa
    totalRaw   : rawStates.length,
    rateLimited,
    accountIndex,
    cachedAt   : ts,             // timestamp del dato (útil para debug en cliente)
    snappedBbox: { lamin: bbox.lamin, lomin: bbox.lomin, lamax: bbox.lamax, lomax: bbox.lomax },
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=5',
    },
  });
}
