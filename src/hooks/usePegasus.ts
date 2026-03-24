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

// Distancia entre dos puntos [lat, lon] en metros (Haversine)
function getDistance(p1: [number, number], p2: [number, number]) {
  const R = 6371e3;
  const dLat = (p2[0] - p1[0]) * Math.PI / 180;
  const dLon = (p2[1] - p1[1]) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Bounding box España peninsular
const SPAIN_BBOX = { lamin: 35.0, lomin: -10.0, lamax: 44.0, lomax: 5.0 };
// OpenSky ahora soporta CORS directo ('access-control-allow-origin: *').
// Ya no usamos el proxy de Next.js para evitar que la IP de Vercel sea bloqueada por límite (HTTP 429).
const OPENSKY_URL = `https://opensky-network.org/api/states/all?lamin=${SPAIN_BBOX.lamin}&lomin=${SPAIN_BBOX.lomin}&lamax=${SPAIN_BBOX.lamax}&lomax=${SPAIN_BBOX.lomax}`;

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

// Aeropuertos principales de España (para excluir falsos positivos)
const AIRPORTS: [number, number][] = [
  [40.4936, -3.5668],  // Madrid Barajas (MAD)
  [41.2971, 2.0785],   // Barcelona El Prat (BCN)
  [37.4274, -5.8931],  // Sevilla (SVQ)
  [36.6749, -4.4990],  // Málaga (AGP)
  [39.5526, 2.7388],   // Palma de Mallorca (PMI)
  [28.4527, -13.8655], // Fuerteventura (FUE)
  [27.9319, -15.3866], // Gran Canaria (LPA)
  [28.0445, -16.5725], // Tenerife Sur (TFS)
  [28.4827, -16.3415], // Tenerife Norte (TFN)
  [38.8722, 1.3731],   // Ibiza (IBZ)
  [43.3011, -8.3777],  // A Coruña (LCG)
  [43.3565, -5.8603],  // Asturias (OVD)
  [43.3010, -1.7921],  // San Sebastián (EAS)
  [43.3011, -3.8257],  // Bilbao (BIO)
  [41.4200, 2.1025],   // Sabadell (QSA)
  [39.4926, -0.4815],  // Valencia (VLC)
  [38.1814, -1.0014],  // Murcia Corvera (RMU)
  [38.2816, -0.5582],  // Alicante (ALC)
  [36.7878, -2.3696],  // Almería (LEI)
  [40.9321, -5.5012],  // Salamanca (SLM)
  [41.6602, -4.8548],  // Valladolid (VLL)
  [37.8498, -4.8448],  // Córdoba (ODB)
  [42.1364, -0.5503],  // Zaragoza (ZAZ)
  [42.0008, 2.7706],   // Girona (GRO)
  [39.8627, 4.2187],   // Menorca (MAH)
];
const AIRPORT_RADIUS_M = 5000; // 5 km de exclusión por aeropuerto (era 15km, demasiado agresivo)

function isNearAirport(lat: number, lon: number): boolean {
  return AIRPORTS.some(ap => getDistance([lat, lon], ap) < AIRPORT_RADIUS_M);
}

// Cache de tokens persistente fuera del hook para que sobreviva entre renders
const tokenCache: Record<number, { token: string; expiresAt: number }> = {};
// Cuándo fue el último 429 por cuenta (para backoff)
const rateLimitedAt: Record<number, number> = {};
const RATE_LIMIT_BACKOFF_MS = 5 * 60 * 1000; // 5 min antes de reintentar una cuenta limitada

const ACCOUNTS: Record<number, { clientId: string; clientSecret: string } | null> = {
  1: null,
  2: { clientId: 'pepinperez-api-client', clientSecret: 'K922tGbRbq0DsrudGDVKQOJv3tYtnO6A' },
  3: { clientId: 'saracruzhortelana-api-client', clientSecret: 'o7FsNtYuca4K6xSHBCb3x4zKo3yiwBS1' }
};

async function getToken(idx: number): Promise<string | null> {
  const creds = ACCOUNTS[idx];
  if (!creds) return null;
  const now = Date.now();
  // Usar token cacheado si aún es válido (25 min de margen)
  if (tokenCache[idx] && tokenCache[idx].expiresAt > now) {
    return tokenCache[idx].token;
  }
  try {
    const tRes = await fetch('https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      })
    });
    if (tRes.ok) {
      const d = await tRes.json();
      if (d.access_token) {
        tokenCache[idx] = { token: d.access_token, expiresAt: now + 25 * 60 * 1000 };
        return d.access_token;
      }
    }
  } catch(e) { console.error('[usePegasus] Token fetch error:', e); }
  return null;
}

export function usePegasus(userPos: [number, number] | null, isEnabled: boolean = false) {
  const [rawAircrafts, setRawAircrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [activeAccount, setActiveAccount] = useState<number>(1);
  const accountIndexRef = useRef<number>(1);

  useEffect(() => {
    if (!isEnabled || !userPos) {
      if (!isEnabled && rawAircrafts.length > 0) setRawAircrafts([]);
      return;
    }

    const fetchAircrafts = async (): Promise<void> => {
      setLoading(true);
      const now = Date.now();

      // Buscar la primera cuenta disponible (no en backoff)
      let idx = 1;
      for (let i = 1; i <= 3; i++) {
        const limitedAt = rateLimitedAt[i] || 0;
        if (now - limitedAt >= RATE_LIMIT_BACKOFF_MS) {
          idx = i;
          break;
        }
        // Si ninguna está disponible, usaremos la menos recientemente limitada
        if (i === 3) {
          const leastRecent = [1,2,3].reduce((a, b) => (rateLimitedAt[a]||0) < (rateLimitedAt[b]||0) ? a : b);
          idx = leastRecent;
        }
      }

      accountIndexRef.current = idx;
      setActiveAccount(idx);
      console.log(`[usePegasus] Fetching OpenSky via browser (Account ${idx})...`);

      const token = await getToken(idx);
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      try {
        const res = await fetch(OPENSKY_URL, { headers });
        console.log('[usePegasus] OpenSky status:', res.status, '| Account:', idx);

        if (res.status === 429) {
          rateLimitedAt[idx] = now;
          console.warn(`[usePegasus] 429 on Account ${idx}. Backoff ${RATE_LIMIT_BACKOFF_MS / 60000} min.`);
          // Comprobar si hay otra cuenta disponible inmediatamente
          const nextAvailable = [1,2,3].find(i => i !== idx && (now - (rateLimitedAt[i]||0)) >= RATE_LIMIT_BACKOFF_MS);
          if (nextAvailable !== undefined) {
            setLoading(false);
            return fetchAircrafts(); // reintentar con la siguiente
          } else {
            setIsRateLimited(true);
            setLoading(false);
            return;
          }
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        setIsRateLimited(false);
        if (data?.states) {
          console.log(`[usePegasus] ✅ ${data.states.length} aircraft (Account ${idx})`);
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
    const interval = setInterval(() => fetchAircrafts(), 60000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnabled, !!userPos]);

  const aircrafts = useMemo<Aircraft[]>(() => {
    if (!userPos) return [];
    
    const withPos = rawAircrafts.filter(s => s[6] !== null && s[5] !== null);
    console.log(`[usePegasus] Total recibidos: ${rawAircrafts.length} | Con posición: ${withPos.length}`);

    const mapped = withPos.map(s => {
      const icao24 = s[0] || '';
      const callsign = (s[1] || '').trim();
      const hasCallsign = /DGT|PESG|SAER|POLIC|GUARDIA|GC|POL/i.test(callsign);
      const altitude = s[7] ?? s[13] ?? 0;
      const velocity = s[9] ?? 0;
      const isLow = altitude < 1000;
      const isSlow = velocity < 60;
      const isDGT = icao24.startsWith('34');
      const lat = s[6];
      const lon = s[5];

      // Si está cerca de un aeropuerto y solo es sospechoso por isLow+isSlow → falso positivo
      // Excepto si tiene callsign o hex de vigilancia explícito
      const nearAirport = isNearAirport(lat, lon);
      const isSuspect = hasCallsign || isDGT || ((isLow && isSlow) && !nearAirport);
      const distanceToUser = getDistance(userPos, [lat, lon]);

      return {
        icao24,
        callsign: callsign || 'N/A',
        origin_country: s[2] || '',
        lon,
        lat,
        altitude,
        velocity,
        track: s[10] ?? 0,
        isSuspect,
        distanceToUser,
      };
    });

    const lowSlow = mapped.filter(a => a.altitude < 1000 && a.velocity < 60).length;
    // Filtro absoluto: excluir < 100m, > 2000m o > 300km/h (83.33 m/s), eliminando falsos positivos comerciales y drones en el maletero
    const suspects = mapped.filter(a => a.isSuspect && a.altitude >= 100 && a.altitude <= 2000 && a.velocity <= 83.33);
    console.log(`[usePegasus] Bajos+lentos: ${lowSlow} | Sospechosos tras filtro final: ${suspects.length}`);
    if (suspects.length > 0) {
      console.log('[usePegasus] Sospechosos:', suspects.map(a => `${a.callsign}(${a.icao24}) alt=${Math.round(a.altitude)}m vel=${Math.round(a.velocity * 3.6)}km/h`).join(', '));
    }

    return suspects;
  }, [rawAircrafts]);

  const isAnyPegasusNearby = useMemo(() => {
    return aircrafts.some(a => a.distanceToUser < 10000);
  }, [aircrafts]);

  return { aircrafts, totalCount: rawAircrafts.length, isAnyPegasusNearby, loading, isRateLimited, activeAccount };
}
