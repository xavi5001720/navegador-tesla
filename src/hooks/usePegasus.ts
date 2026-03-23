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
// Usamos el proxy de Next.js para evitar problemas CORS con OpenSky desde el browser
const OPENSKY_URL = `/opensky/api/states/all?lamin=${SPAIN_BBOX.lamin}&lomin=${SPAIN_BBOX.lomin}&lamax=${SPAIN_BBOX.lamax}&lomax=${SPAIN_BBOX.lomax}`;


// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000; // 5 seconds

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

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

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
    const interval = setInterval(() => fetchAircrafts(), 60000); // Refetch every 60s
    return () => clearInterval(interval);
  }, []);

  const aircrafts = useMemo<Aircraft[]>(() => {
    return rawAircrafts
      .filter(s => s[6] !== null && s[5] !== null) // filtramos sin posición
      .map(s => {
        const icao24 = s[0] || '';
        const callsign = (s[1] || '').trim();
        const hasCallsign = /DGT|PESG|SAER|POLIC|GUARDIA|GC|POL/i.test(callsign);
        const altitude = s[7] ?? s[13] ?? 0;
        const velocity = s[9] ?? 0;
        const isLow = altitude < 1000;
        const isSlow = velocity < 60;
        const isDGT = icao24.startsWith('34');
        const isSuspect = (isLow && isSlow) || hasCallsign || isDGT;
        return {
          icao24,
          callsign: callsign || 'N/A',
          origin_country: s[2] || '',
          lon: s[5],
          lat: s[6],
          altitude,
          velocity,
          track: s[10] ?? 0,
          isSuspect,
        };
      });
  }, [rawAircrafts]);

  const isAnyPegasusNearby = useMemo(() => {
    return aircrafts.some(a => a.isSuspect && getDistance(userPos, [a.lat, a.lon]) < 15000);
  }, [aircrafts, userPos]);

  return { aircrafts, totalCount: rawAircrafts.length, isAnyPegasusNearby, loading, isRateLimited };
}
