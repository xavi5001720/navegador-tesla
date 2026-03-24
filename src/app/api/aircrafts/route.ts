import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ── Cuenta única (la más limpia) ──────────────────────────────────────────────
const ACCOUNT = { clientId: 'luliloqui-api-client', clientSecret: 'YEXtTfBwCd5w2Kxhvp57W4C0s6f4Pb5n' };

// ── Aerolíneas comerciales — se filtran en servidor ───────────────────────────
const COMMERCIAL_RE = /^(EAX|IBE|RYR|VLG|EZY|AFR|DLH|KLM|BAW)/i;

// ── Caché de zonas compartida entre todos los usuarios ────────────────────────
// Clave: "lamin_lomin_lamax_lomax" normalizado a tiles de 0.5°
// Esto agrupa consultas cercanas y las comparte entre usuarios concurrentes.
interface ZoneCache {
  states: any[];
  ts: number;
  inFlight: boolean;
}
const zoneCache = new Map<string, ZoneCache>();
const ZONE_TTL_MS      = 30_000;  // 30 s — zona activa
const ZONE_COLD_TTL_MS = 5 * 60_000; // 5 min — zona fría (sin sospechosos)
const TILE_SIZE        = 0.5; // grados (~50 km)

// ── Token con caché en memoria ────────────────────────────────────────────────
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string | null> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.token;
  try {
    const res = await fetch(
      'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: ACCOUNT.clientId,
          client_secret: ACCOUNT.clientSecret,
        }),
        cache: 'no-store',
      }
    );
    if (res.ok) {
      const d = await res.json();
      if (d.access_token) {
        cachedToken = { token: d.access_token, expiresAt: now + 25 * 60_000 };
        return d.access_token;
      }
    }
  } catch (e) {
    console.error('[aircrafts API] Token error:', e);
  }
  return null;
}

// ── Normaliza una coordenada al tile de 0.5° que la contiene ─────────────────
function toTile(v: number): number {
  return Math.floor(v / TILE_SIZE) * TILE_SIZE;
}

// ── Genera todas las claves de tile que cubren la bbox solicitada ─────────────
function getTileKeys(lamin: number, lomin: number, lamax: number, lomax: number): string[] {
  const keys: string[] = [];
  for (let lat = toTile(lamin); lat < lamax; lat += TILE_SIZE) {
    for (let lon = toTile(lomin); lon < lomax; lon += TILE_SIZE) {
      const la1 = +lat.toFixed(1);
      const lo1 = +lon.toFixed(1);
      const la2 = +(lat + TILE_SIZE).toFixed(1);
      const lo2 = +(lon + TILE_SIZE).toFixed(1);
      keys.push(`${la1}_${lo1}_${la2}_${lo2}`);
    }
  }
  return keys;
}

// ── Trae datos de OpenSky para una tile concreta ──────────────────────────────
async function fetchTile(key: string): Promise<any[]> {
  const [lamin, lomin, lamax, lomax] = key.split('_').map(Number);
  const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { headers, cache: 'no-store' });
  if (res.status === 429) {
    console.warn('[aircrafts API] 429 rate limited from OpenSky');
    throw new Error('rate_limited');
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data?.states ?? [];
}

// ── Obtiene estados de una tile, usando caché si está vigente ─────────────────
async function getTileStates(key: string): Promise<any[]> {
  const now = Date.now();
  const cached = zoneCache.get(key);

  if (cached) {
    const age = now - cached.ts;
    const ttl = cached.states.length > 0 ? ZONE_TTL_MS : ZONE_COLD_TTL_MS;
    if (age < ttl) {
      console.log(`[aircrafts API] CACHE HIT  ${key} (${Math.round(age / 1000)}s old)`);
      return cached.states;
    }
    // Si ya hay un fetch en vuelo, devolvemos los datos viejos para no duplicar
    if (cached.inFlight) {
      console.log(`[aircrafts API] IN-FLIGHT   ${key} — returning stale`);
      return cached.states;
    }
  }

  // Marca como in-flight para evitar peticiones duplicadas concurrentes
  zoneCache.set(key, { states: cached?.states ?? [], ts: cached?.ts ?? 0, inFlight: true });
  console.log(`[aircrafts API] CACHE MISS  ${key} — fetching OpenSky`);

  try {
    const states = await fetchTile(key);
    zoneCache.set(key, { states, ts: now, inFlight: false });
    return states;
  } catch (e) {
    // En error, marcamos como no-in-flight y devolvemos caché vieja
    zoneCache.set(key, { states: cached?.states ?? [], ts: cached?.ts ?? 0, inFlight: false });
    throw e;
  }
}

// ── Aeropuertos principales de España ─────────────────────────────────────────
const AIRPORTS: [number, number][] = [
  [40.4936, -3.5668], [41.2971, 2.0785], [37.4274, -5.8931],
  [36.6749, -4.4990], [39.5526, 2.7388], [28.4527, -13.8655],
  [27.9319, -15.3866], [28.0445, -16.5725], [28.4827, -16.3415],
  [38.8722, 1.3731], [43.3011, -8.3777], [43.3565, -5.8603],
  [43.3010, -1.7921], [43.3011, -3.8257], [39.4926, -0.4815],
  [38.1814, -1.0014], [38.2816, -0.5582], [36.7878, -2.3696],
];
const AIRPORT_RADIUS_M = 5000;

function haversine(p1: [number, number], p2: [number, number]): number {
  const R = 6371e3;
  const dLat = (p2[0] - p1[0]) * Math.PI / 180;
  const dLon = (p2[1] - p1[1]) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isNearAirport(lat: number, lon: number): boolean {
  return AIRPORTS.some(ap => haversine([lat, lon], ap) < AIRPORT_RADIUS_M);
}

// ── Filtra sospechosos en servidor ────────────────────────────────────────────
function filterSuspects(states: any[]): any[] {
  const withPos = states.filter(s => s[6] !== null && s[5] !== null);
  return withPos.filter(s => {
    const callsign = (s[1] || '').trim();
    if (COMMERCIAL_RE.test(callsign)) return false;
    const altitude = s[7] ?? s[13] ?? 0;
    const velocity = s[9] ?? 0;
    const lat = s[6], lon = s[5];
    const icao24 = s[0] || '';

    const hasWatchCallsign = /DGT|PESG|SAER|POLIC|GUARDIA|GC|POL/i.test(callsign);
    const isDGT = icao24.startsWith('34');
    const isLow = altitude < 1000;
    const isSlow = velocity < 60;
    const nearAirport = isNearAirport(lat, lon);
    const isSuspect = hasWatchCallsign || isDGT || ((isLow && isSlow) && !nearAirport);

    // Filtro absoluto: altitud 100–2000m, velocidad ≤300 km/h
    return isSuspect && altitude >= 100 && altitude <= 2000 && velocity <= 83.33;
  });
}

// ── Handler principal ─────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lamin = parseFloat(searchParams.get('lamin') ?? '');
  const lomin = parseFloat(searchParams.get('lomin') ?? '');
  const lamax = parseFloat(searchParams.get('lamax') ?? '');
  const lomax = parseFloat(searchParams.get('lomax') ?? '');

  if ([lamin, lomin, lamax, lomax].some(isNaN)) {
    return NextResponse.json({ error: 'Missing bbox params: lamin, lomin, lamax, lomax' }, { status: 400 });
  }

  const tileKeys = getTileKeys(lamin, lomin, lamax, lomax);
  console.log(`[aircrafts API] bbox request → ${tileKeys.length} tiles`);

  let allStates: any[] = [];
  let rateLimited = false;

  await Promise.all(tileKeys.map(async key => {
    try {
      const states = await getTileStates(key);
      allStates = allStates.concat(states);
    } catch (e: any) {
      if (e.message === 'rate_limited') rateLimited = true;
    }
  }));

  // Deduplicar por icao24 (puede aparecer en tiles adyacentes)
  const seen = new Set<string>();
  const unique = allStates.filter(s => {
    const id = s[0];
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const suspects = filterSuspects(unique);
  console.log(`[aircrafts API] Total: ${unique.length} | Sospechosos: ${suspects.length}${rateLimited ? ' | ⚠️ rate limited' : ''}`);

  return NextResponse.json({
    states: suspects,
    totalRaw: unique.length,
    rateLimited,
    tiles: tileKeys.length,
  });
}
