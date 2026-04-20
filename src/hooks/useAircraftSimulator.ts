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
    return (realAircrafts || []).map(ac => {
      // Seguridad contra valores nulos o inválidos
      const interval = (projectionTimeMs && !isNaN(projectionTimeMs)) ? projectionTimeMs : 30000;
      
      // Proyectamos la posición futura basada en el intervalo de actualización (ej: 30s)
      const future = extrapolate(
        ac.lat, 
        ac.lon, 
        ac.velocity || 0, 
        ac.track || 0, 
        interval / 1000
      );

      // Si la proyección falla por alguna razón matemática, usamos la posición real
      const finalLat = isNaN(future.lat) ? ac.lat : future.lat;
      const finalLon = isNaN(future.lon) ? ac.lon : future.lon;

      return {
        ...ac,
        lat: finalLat,
        lon: finalLon,
        _realLat: ac.lat,
        _realLon: ac.lon
      };
    });
  }, [realAircrafts, projectionTimeMs]);
}
