import { NextRequest, NextResponse } from 'next/server';

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
const CLIENT_ID     = 'luliloqui-api-client';
const CLIENT_SECRET = 'YEXtTfBwCd5w2Kxhvp57W4C0s6f4Pb5n';

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
// TOKEN MANAGER — renovación automática; token válido 30 min, refrescamos a 25
// ─────────────────────────────────────────────────────────────────────────────
let _token: string | null        = null;
let _tokenExpiresAt: number      = 0;
let _tokenInflight: Promise<string | null> | null = null;

async function getToken(): Promise<string | null> {
  const now = Date.now();
  if (_token && _tokenExpiresAt > now) return _token;

  // Deduplicamos: si ya hay una petición en vuelo, la compartimos
  if (_tokenInflight) return _tokenInflight;

  _tokenInflight = (async () => {
    try {
      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type   : 'client_credentials',
          client_id    : CLIENT_ID,
          client_secret: CLIENT_SECRET,
        }),
        cache: 'no-store',
      });
      if (!res.ok) {
        console.error('[aircrafts] Token HTTP error:', res.status);
        return null;
      }
      const d = await res.json();
      if (d.access_token) {
        _token          = d.access_token;
        // Renovamos 5 min antes de que expire (expire_in suele ser 1800 s)
        _tokenExpiresAt = Date.now() + (d.expires_in ?? 1800) * 1_000 - 5 * 60_000;
        console.log('[aircrafts] ✅ Token renovado, expira en', Math.round((d.expires_in ?? 1800) / 60), 'min');
        return _token;
      }
    } catch (e) {
      console.error('[aircrafts] Error obteniendo token:', e);
    }
    return null;
  })().finally(() => { _tokenInflight = null; });

  return _tokenInflight;
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
// CACHÉ IN-MEMORY — una entrada por bbox snapped
// ─────────────────────────────────────────────────────────────────────────────
interface CacheEntry {
  states    : any[];
  ts        : number;
  rateLimited: boolean;
  // Promesa en vuelo — evita que N clientes simultáneos abran N conexiones
  inflight  : Promise<CacheEntry> | null;
}
const cache = new Map<string, CacheEntry>();

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
// FETCH RAW — petición única a OpenSky para un bbox snapped
// ─────────────────────────────────────────────────────────────────────────────
async function fetchFromOpenSky(bbox: SnappedBbox): Promise<{ states: any[]; rateLimited: boolean }> {
  const { lamin, lomin, lamax, lomax, sqDeg } = bbox;
  const url = `${OPENSKY_BASE}/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;

  // Coste estimado de créditos
  const creditCost = sqDeg <= 25 ? 1 : sqDeg <= 100 ? 2 : sqDeg <= 400 ? 3 : 4;
  console.log(`[aircrafts] → OpenSky  bbox=${bbox.key}  área=${sqDeg.toFixed(1)}°²  coste≈${creditCost} crédito(s)`);

  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { headers, cache: 'no-store' });
  const remaining = res.headers.get('X-Rate-Limit-Remaining');
  if (remaining) console.log(`[aircrafts]   créditos restantes: ${remaining}`);

  if (res.status === 429) {
    const retry = res.headers.get('X-Rate-Limit-Retry-After-Seconds') ?? '?';
    console.warn(`[aircrafts] ⚠️  Rate limited — reintentar en ${retry}s`);
    return { states: [], rateLimited: true };
  }
  if (!res.ok) {
    console.error('[aircrafts] HTTP error:', res.status);
    return { states: [], rateLimited: false };
  }

  const data = await res.json();
  const states: any[] = data?.states ?? [];
  console.log(`[aircrafts] ✅ ${states.length} aeronaves recibidas`);
  return { states, rateLimited: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET FROM CACHE — sirve desde caché o lanza una petición deduplicada
// ─────────────────────────────────────────────────────────────────────────────
async function getCachedStates(bbox: SnappedBbox): Promise<CacheEntry> {
  const now     = Date.now();
  const existing = cache.get(bbox.key);

  // Caché válida → devolvemos directamente
  if (existing && (now - existing.ts) < CACHE_TTL_MS) {
    console.log(`[aircrafts] CACHE HIT  ${bbox.key}  (${Math.round((now - existing.ts) / 1000)}s antiguo)`);
    return existing;
  }

  // Ya hay una petición en vuelo para este bbox → nos unimos a ella
  if (existing?.inflight) {
    console.log(`[aircrafts] IN-FLIGHT  ${bbox.key} — esperando resultado compartido`);
    return existing.inflight;
  }

  // Lanzamos una nueva petición y la registramos para deduplicar
  console.log(`[aircrafts] CACHE MISS ${bbox.key} — consultando OpenSky`);

  const inflight: Promise<CacheEntry> = fetchFromOpenSky(bbox).then(({ states, rateLimited }) => {
    const entry: CacheEntry = { states, ts: Date.now(), rateLimited, inflight: null };
    cache.set(bbox.key, entry);
    return entry;
  }).catch(err => {
    console.error('[aircrafts] Error en fetch:', err);
    const fallback: CacheEntry = {
      states     : existing?.states ?? [],
      ts         : existing?.ts ?? 0,
      rateLimited: false,
      inflight   : null,
    };
    cache.set(bbox.key, fallback);
    return fallback;
  });

  // Guardamos la promesa en la entrada para deduplicar clientes concurrentes
  cache.set(bbox.key, { states: existing?.states ?? [], ts: existing?.ts ?? 0, rateLimited: false, inflight });
  return inflight;
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

  // ── 2. Obtener datos (caché o fetch deduplicado) ──────────────────────────
  const { states: rawStates, rateLimited, ts } = await getCachedStates(bbox);

  // ── 3. Filtrar nulos de posición + enriquecer ─────────────────────────────
  const withPos  = rawStates.filter(s => s[6] != null && s[5] != null);
  const enriched = withPos.map(s => enrichState(s, ulat, ulon)).filter(Boolean);

  const suspects = enriched.filter(a => a!.isSuspect && a!.altitude >= 100 && a!.altitude <= 2_000 && a!.velocity <= 83.33);

  console.log(`[aircrafts] → cliente: ${enriched.length} aeronaves | ${suspects.length} sospechosas | rateLimited=${rateLimited}`);

  return NextResponse.json({
    states     : enriched,       // todas (comerciales + sospechosas) para visualización en mapa
    totalRaw   : rawStates.length,
    rateLimited,
    cachedAt   : ts,             // timestamp del dato (útil para debug en cliente)
    snappedBbox: { lamin: bbox.lamin, lomin: bbox.lomin, lamax: bbox.lamax, lomax: bbox.lomax },
  }, {
    headers: {
      // Cache-Control para el propio proxy de Next.js
      'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=5',
    },
  });
}
