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
                track: s.track || 0,
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
    const interval = setInterval(fetchAircrafts, 30000); // 30 segundos para mayor frescura
    return () => clearInterval(interval);
  }, []);

  // 2. Filtering logic: Reactiva a la posición del usuario pero SIN peticiones extra.
  const aircrafts = useMemo(() => {
    return rawAircrafts.map(aircraft => {
      // Heurística de vigilancia refinada para España:
      const hasCallsign = /DGT|PESG|SAER|POLIC|GUARDIA|GC|POL|CIPHER/i.test(aircraft.callsign);
      const isLow = aircraft.altitude !== null && aircraft.altitude < 1000;
      const isSlow = aircraft.velocity !== null && aircraft.velocity < 60;
      
      // ICAO24 específicos de helicópteros DGT (comienzan por 34...)
      const isDGT = aircraft.icao24.startsWith('34'); 
      
      const isSuspect = (isLow && isSlow) || hasCallsign || isDGT;
      return { ...aircraft, isSuspect };
    });
    // SE ELIMINA EL FILTRADO GEOGRÁFICO POR PETICIÓN DEL USUARIO
  }, [rawAircrafts]); 

  const isAnyPegasusNearby = useMemo(() => {
     // Para la alerta en el coche, sí consideramos la cercanía
     return aircrafts.some((a: Aircraft) => a.isSuspect && getDistance(userPos, [a.lat, a.lon]) < 15000);
  }, [aircrafts, userPos]);

  return { aircrafts, isAnyPegasusNearby, loading, isRateLimited };
}
