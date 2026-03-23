'use client';

import { useState, useEffect, useMemo } from 'react';

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

export function usePegasus(userPos: [number, number]) {
  const [rawAircrafts, setRawAircrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);

  useEffect(() => {
    const fetchAircrafts = async (attempt = 1): Promise<void> => {
      if (attempt === 1) setLoading(true);
      console.log(`[usePegasus] Fetching directly from OpenSky (attempt ${attempt}/${MAX_RETRIES})...`);

      try {
        const res = await fetch(OPENSKY_URL);
        console.log('[usePegasus] OpenSky response status:', res.status);

        if (res.status === 429) {
          console.warn('[usePegasus] Rate limited by OpenSky (429).');
          setIsRateLimited(true);
          setLoading(false);
          return;
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        setIsRateLimited(false);

        if (data?.states) {
          console.log(`[usePegasus] ✅ ${data.states.length} aircraft loaded from OpenSky.`);
          setRawAircrafts(data.states);
        } else {
          console.warn('[usePegasus] Response OK but no states array:', data);
          setRawAircrafts([]);
        }
        setLoading(false);

      } catch (error) {
        console.error(`[usePegasus] ❌ Fetch error (attempt ${attempt}):`, error);
        if (attempt < MAX_RETRIES) {
          console.log(`[usePegasus] Retrying in ${RETRY_DELAY_MS / 1000}s...`);
          setTimeout(() => fetchAircrafts(attempt + 1), RETRY_DELAY_MS);
        } else {
          console.error('[usePegasus] All retries exhausted.');
          setLoading(false);
        }
      }
    };

    fetchAircrafts();
    const interval = setInterval(() => fetchAircrafts(), 60000);
    return () => clearInterval(interval);
  }, []);

  const aircrafts = useMemo<Aircraft[]>(() => {
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

  return { aircrafts, totalCount: rawAircrafts.length, isAnyPegasusNearby, loading, isRateLimited };
}
