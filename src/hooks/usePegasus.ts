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

export function usePegasus(userPos: [number, number]) {
  const [rawAircrafts, setRawAircrafts] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);

  // 1. Fetching logic: Solo por intervalo o al montar, NO por posición.
  useEffect(() => {
    const fetchAircrafts = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/aircrafts');
        const data = await response.json();
        console.log(`[usePegasus] API Response:`, data);

        if (data.error === 'Rate limited') {
          console.warn('[usePegasus] Rate limited');
          setIsRateLimited(true);
        } else {
          setIsRateLimited(false);
          if (data.aircrafts) {
             console.log(`[usePegasus] Loaded ${data.aircrafts.length} raw aircrafts`);
             const aircrafts = data.aircrafts.map((s: any) => ({
                icao24: s.icao24,
                callsign: s.callsign || 'N/A',
                origin_country: s.origin_country || 'España',
                lon: s.longitude,
                lat: s.latitude,
                altitude: s.altitude,
                velocity: s.velocity,
                isSuspect: false
             }));
             setRawAircrafts(aircrafts);
          }
        }
      } catch (error) {
        console.error('Error fetching aircraft data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAircrafts();
    const interval = setInterval(fetchAircrafts, 120000); // 2 minutos
    return () => clearInterval(interval);
  }, []); // Dependencias vacías para evitar re-fetch por movimiento

  // 2. Filtering logic: Reactiva a la posición del usuario pero SIN peticiones extra.
  const aircrafts = useMemo(() => {
    return rawAircrafts.map(aircraft => {
      // Heurística de vigilancia refinada para España:
      // 1. Callsign típico: DGT, PESG (Pegasus), SAER (Guardia Civil), POL (Policía), CIPHER (Militar/Vigilancia)
      const hasCallsign = /DGT|PESG|SAER|POLIC|GUARDIA|GC|POL|CIPHER/i.test(aircraft.callsign);
      
      // 2. Comportamiento: Vuelo muy bajo (<1000m) y lento (<60m/s ~ 215km/h) 
      // Los aviones comerciales rara vez bajan de 1000m si no están aterrizando.
      const isLow = aircraft.altitude !== null && aircraft.altitude < 1000;
      const isSlow = aircraft.velocity !== null && aircraft.velocity < 60;
      
      // 3. Códigos Hex (ICAO24) conocidos de helicópteros DGT en España (comienzan por 34...)
      // Por ahora usamos la combinación de parámetros + callsign
      const isSuspect = (isLow && isSlow) || hasCallsign;
      
      return { ...aircraft, isSuspect };
    }).filter(aircraft => {
      // FILTRADO GEOGRÁFICO:
      // - Si es Pegasus (Suspect), lo vemos en toda España sin restricciones.
      if (aircraft.isSuspect) return true;
      
      // - Si es normal, solo en radio de 15km alrededor del usuario.
      const dist = getDistance(userPos, [aircraft.lat, aircraft.lon]);
      return dist < 15000;
    });
  }, [rawAircrafts, userPos]); 

  const isAnyPegasusNearby = useMemo(() => aircrafts.some((a: Aircraft) => a.isSuspect), [aircrafts]);

  return { aircrafts, isAnyPegasusNearby, loading, isRateLimited };
}
