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
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calcula el bounding box de una ruta con un margen en grados
// Si no hay ruta, devuelve un bbox de ~10 km alrededor del usuario
function getRouteBbox(
  userPos: [number, number],
  routeCoordinates?: [number, number][]
): { lamin: number; lomin: number; lamax: number; lomax: number } {
  const MARGIN_DEG = 0.09; // ~10 km de margen
  const points = routeCoordinates && routeCoordinates.length > 0
    ? routeCoordinates
    : [userPos];

  let lamin = points[0][0], lamax = points[0][0];
  let lomin = points[0][1], lomax = points[0][1];

  for (const [lat, lon] of points) {
    if (lat < lamin) lamin = lat;
    if (lat > lamax) lamax = lat;
    if (lon < lomin) lomin = lon;
    if (lon > lomax) lomax = lon;
  }

  return {
    lamin: +(lamin - MARGIN_DEG).toFixed(4),
    lomin: +(lomin - MARGIN_DEG).toFixed(4),
    lamax: +(lamax + MARGIN_DEG).toFixed(4),
    lomax: +(lomax + MARGIN_DEG).toFixed(4),
  };
}

const FETCH_INTERVAL_MS = 30_000; // 30 s — el servidor cachea por 30 s también

export function usePegasus(
  userPos: [number, number] | null,
  isEnabled: boolean = false,
  routeCoordinates?: [number, number][]
) {
  const [rawStates, setRawStates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);

  // Ref para que el intervalo siempre tenga acceso a las últimas coordenadas de ruta
  const routeRef = useRef(routeCoordinates);
  useEffect(() => { routeRef.current = routeCoordinates; }, [routeCoordinates]);

  useEffect(() => {
    if (!isEnabled || !userPos) {
      if (!isEnabled && rawStates.length > 0) setRawStates([]);
      return;
    }

    const fetchAircrafts = async (): Promise<void> => {
      setLoading(true);
      const bbox = getRouteBbox(userPos, routeRef.current);
      const params = new URLSearchParams({
        lamin: String(bbox.lamin),
        lomin: String(bbox.lomin),
        lamax: String(bbox.lamax),
        lomax: String(bbox.lomax),
      });

      console.log(`[usePegasus] Fetching /api/aircrafts bbox: ${bbox.lamin},${bbox.lomin} → ${bbox.lamax},${bbox.lomax}`);

      try {
        const res = await fetch(`/api/aircrafts?${params}`);
        const data = await res.json();

        if (res.status === 429 || data.rateLimited) {
          setIsRateLimited(true);
          console.warn('[usePegasus] Rate limited');
        } else {
          setIsRateLimited(false);
        }

        if (data?.states) {
          console.log(`[usePegasus] ✅ ${data.states.length} sospechosos (${data.totalRaw} totales, ${data.tiles} tiles)`);
          setRawStates(data.states);
        } else {
          setRawStates([]);
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

  // El servidor ya filtra sospechosos. Aquí solo mapeamos a Aircraft con distancias.
  const aircrafts = useMemo<Aircraft[]>(() => {
    if (!userPos) return [];

    return rawStates.map(s => {
      const lat = s[6];
      const lon = s[5];
      return {
        icao24: s[0] || '',
        callsign: (s[1] || '').trim() || 'N/A',
        origin_country: s[2] || '',
        lon,
        lat,
        altitude: s[7] ?? s[13] ?? 0,
        velocity: s[9] ?? 0,
        track: s[10] ?? 0,
        isSuspect: true, // el servidor solo devuelve sospechosos
        distanceToUser: getDistance(userPos, [lat, lon]),
      };
    });
  }, [rawStates, userPos]);

  const isAnyPegasusNearby = useMemo(
    () => aircrafts.some(a => a.distanceToUser < 10000),
    [aircrafts]
  );

  return {
    aircrafts,
    totalCount: rawStates.length,
    isAnyPegasusNearby,
    loading,
    isRateLimited,
    activeAccount: 1, // mantenemos la prop por compatibilidad con Sidebar
  };
}
