'use client';

import { useState, useEffect, useMemo, useRef } from 'react';

export interface Aircraft {
  icao24: string;
  callsign: string;
  origin_country: string;
  lat: number;
  lon: number;
  altitude: number;
  velocity: number;
  track: number;
  isSuspect: boolean;
  distanceToUser: number;
}

// ── Haversine ─────────────────────────────────────────────────────────────────
function getDistance(p1: [number, number], p2: [number, number]) {
  const R = 6371e3;
  const dLat = (p2[0] - p1[0]) * Math.PI / 180;
  const dLon = (p2[1] - p1[1]) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
function isNearAirport(lat: number, lon: number): boolean {
  return AIRPORTS.some(ap => getDistance([lat, lon], ap) < AIRPORT_RADIUS_M);
}

// ── Aerolíneas comerciales — se excluyen del radar ────────────────────────────
const COMMERCIAL_RE = /^(EAX|IBE|RYR|VLG|EZY|AFR|DLH|KLM|BAW)/i;

// ── Spain bbox completo (fallback sin ruta) ───────────────────────────────────
const SPAIN_BBOX = `lamin=35.0&lomin=-10.0&lamax=44.0&lomax=5.0`;

// ── Calcula bbox de la ruta ───────────────────────────────────────────────────
// Sin ruta → toda España (vista general)
// Con ruta → caja de ~50 km alrededor del coche (suficiente para la próxima media hora de viaje)
function getRouteBbox(
  userPos: [number, number],
  routeCoordinates?: [number, number][]
): string {
  const hasRoute = routeCoordinates && routeCoordinates.length > 0;
  if (!hasRoute) return SPAIN_BBOX;

  // Un grado de latitud son ~111 km. 0.45 grados son ~50 km.
  const MARGIN_DEG = 0.45; 
  const lamin = (userPos[0] - MARGIN_DEG).toFixed(4);
  const lomin = (userPos[1] - MARGIN_DEG).toFixed(4);
  const lamax = (userPos[0] + MARGIN_DEG).toFixed(4);
  const lomax = (userPos[1] + MARGIN_DEG).toFixed(4);
  
  return `lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
}

// ── Credenciales (cuenta 1: la más limpia) ────────────────────────────────────
const ACCOUNT = { clientId: 'luliloqui-api-client', clientSecret: 'YEXtTfBwCd5w2Kxhvp57W4C0s6f4Pb5n' };
const tokenCache: { token: string; expiresAt: number } | null = null;
let _tokenCache: { token: string; expiresAt: number } | null = tokenCache;

async function getToken(): Promise<string | null> {
  const now = Date.now();
  if (_tokenCache && _tokenCache.expiresAt > now) return _tokenCache.token;
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
      }
    );
    if (res.ok) {
      const d = await res.json();
      if (d.access_token) {
        _tokenCache = { token: d.access_token, expiresAt: now + 25 * 60_000 };
        return d.access_token;
      }
    }
  } catch (e) { console.error('[usePegasus] Token error:', e); }
  return null;
}

const FETCH_INTERVAL_MS = 45_000; // 45 s entre consultas

export function usePegasus(
  userPos: [number, number] | null,
  isEnabled: boolean = false,
  routeCoordinates?: [number, number][]
) {
  const [rawAircrafts, setRawAircrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);

  const routeRef = useRef(routeCoordinates);
  useEffect(() => { routeRef.current = routeCoordinates; }, [routeCoordinates]);

  useEffect(() => {
    if (!isEnabled || !userPos) {
      if (!isEnabled && rawAircrafts.length > 0) setRawAircrafts([]);
      return;
    }

    const fetchAircrafts = async (): Promise<void> => {
      setLoading(true);
      const bbox = getRouteBbox(userPos, routeRef.current);
      const url = `https://opensky-network.org/api/states/all?${bbox}`;
      console.log(`[usePegasus] Fetching OpenSky (cliente directo): ${bbox}`);

      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      try {
        const res = await fetch(url, { headers });
        console.log('[usePegasus] OpenSky status:', res.status);

        if (res.status === 429) {
          setIsRateLimited(true);
          console.warn('[usePegasus] ⚠️ Rate limited (429)');
          setLoading(false);
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        setIsRateLimited(false);
        if (data?.states) {
          console.log(`[usePegasus] ✅ ${data.states.length} aviones recibidos en bbox`);
          setRawAircrafts(data.states);
        } else {
          setRawAircrafts([]);
        }
      } catch (error) {
        console.error('[usePegasus] ❌ Fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAircrafts();
    const interval = setInterval(fetchAircrafts, FETCH_INTERVAL_MS);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnabled, !!userPos]);

  const { allAircrafts, aircrafts } = useMemo(() => {
    if (!userPos) return { allAircrafts: [], aircrafts: [] };

    const withPos = rawAircrafts.filter(s => s[6] !== null && s[5] !== null);
    console.log(`[usePegasus] Con posición: ${withPos.length}`);

    const mapped = withPos.map(s => {
      const icao24 = s[0] || '';
      const callsign = (s[1] || '').trim();
      const isCommercial = COMMERCIAL_RE.test(callsign);
      const hasCallsign = /DGT|PESG|SAER|POLIC|GUARDIA|GC|POL/i.test(callsign);
      const altitude = s[7] ?? s[13] ?? 0;
      const velocity = s[9] ?? 0;
      const lat = s[6], lon = s[5];
      const isDGT = icao24.startsWith('34');
      const isLow = altitude < 1000;
      const isSlow = velocity < 60;
      const nearAirport = isNearAirport(lat, lon);
      const isSuspect = !isCommercial && (hasCallsign || isDGT || ((isLow && isSlow) && !nearAirport));

      return {
        icao24, callsign: callsign || 'N/A',
        origin_country: s[2] || '',
        lon, lat, altitude, velocity,
        track: s[10] ?? 0,
        isSuspect,
        distanceToUser: getDistance(userPos, [lat, lon]),
      };
    });

    const hasRoute = routeCoordinates && routeCoordinates.length > 0;
    
    // Filtrar todo lo que esté muy lejos para no saturar el mapa si hay ruta
    const finalMapped = mapped.filter(a => {
      if (hasRoute && a.distanceToUser > 50000) return false;
      return true;
    });

    const suspects = finalMapped.filter(a => {
      return a.isSuspect && a.altitude >= 100 && a.altitude <= 2000 && a.velocity <= 83.33;
    });
    
    console.log(`[usePegasus] Sospechosos: ${suspects.length} de ${finalMapped.length} (total en mapa)`);
    return { allAircrafts: finalMapped, aircrafts: suspects };
  }, [rawAircrafts, userPos, routeCoordinates]);

  const isAnyPegasusNearby = useMemo(
    () => aircrafts.some(a => a.distanceToUser < 10000),
    [aircrafts]
  );

  return {
    allAircrafts,
    aircrafts,
    totalCount: rawAircrafts.length,
    isAnyPegasusNearby,
    loading,
    isRateLimited,
    activeAccount: 1,
  };
}
