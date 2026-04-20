'use client';

import { useMemo } from 'react';
import type { Aircraft } from './usePegasus';

/**
 * Extrapolación de posición futura basada en rumbo y velocidad.
 */
function extrapolate(lat: number, lon: number, velocity: number, track: number, dtSeconds: number) {
  if (velocity < 0.5 || dtSeconds <= 0) return { lat, lon };
  
  const trackRad = track * (Math.PI / 180);
  // Un grado de latitud son aprox 111,111 metros
  const dlat = (velocity * Math.cos(trackRad) * dtSeconds) / 111_111;
  const cosLat = Math.cos(lat * (Math.PI / 180));
  // Un grado de longitud depende de la latitud
  const dlon = (velocity * Math.sin(trackRad) * dtSeconds) / (111_111 * (cosLat || 1));
  
  return { lat: lat + dlat, lon: lon + dlon };
}

/**
 * useAircraftSimulator (Refactor 60FPS / GPU Accelerated)
 * 
 * En lugar de actualizar el estado cada 1 segundo (cuello de botella),
 * este hook proyecta dónde estará el avión en el futuro (ej: +30s).
 * El MapUI se encarga de la animación fluida mediante CSS Transitions.
 */
export function useAircraftSimulator(realAircrafts: Aircraft[], projectionTimeMs: number = 30000): Aircraft[] {
  return useMemo(() => {
    return realAircrafts.map(ac => {
      // Proyectamos la posición futura basada en el intervalo de actualización (ej: 30s)
      const future = extrapolate(
        ac.lat, 
        ac.lon, 
        ac.velocity, 
        ac.track, 
        projectionTimeMs / 1000
      );

      return {
        ...ac,
        lat: future.lat,
        lon: future.lon,
        // Guardamos la posición original por si fuera necesaria (debug/etc)
        _realLat: ac.lat,
        _realLon: ac.lon
      };
    });
  }, [realAircrafts, projectionTimeMs]);
}
