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
const OPENSKY_URL = `https://opensky-network.org/api/states/all?lamin=${SPAIN_BBOX.lamin}&lomin=${SPAIN_BBOX.lomin}&lamax=${SPAIN_BBOX.lamax}&lomax=${SPAIN_BBOX.lomax}`;

export function usePegasus(userPos: [number, number]) {
  const [rawAircrafts, setRawAircrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);

  useEffect(() => {
    const fetchAircrafts = async () => {
      setLoading(true);
      try {
        const res = await fetch(OPENSKY_URL);
        if (res.status === 429) {
          console.warn('[usePegasus] Rate limited');
          setIsRateLimited(true);
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setIsRateLimited(false);
        if (data?.states) {
          console.log(`[usePegasus] Loaded ${data.states.length} raw states from OpenSky`);
          setRawAircrafts(data.states);
        } else {
          console.warn('[usePegasus] No states in response');
          setRawAircrafts([]);
        }
      } catch (error) {
        console.error('[usePegasus] Error fetching aircraft data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAircrafts();
    const interval = setInterval(fetchAircrafts, 60000); // cada 60s
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
