'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';

export function useGeolocation(isPaused?: boolean) {
  const [userPos, setUserPos] = useState<[number, number]>([40.4168, -3.7038]); 
  const [heading, setHeading] = useState<number>(0);
  const [hasLocation, setHasLocation] = useState(false);
  // FIX I1: Nuevo estado de error — elimina el uso de alert() bloqueante
  const [gpsError, setGpsError] = useState<string | null>(null);

  const lastPosRef = useRef<[number, number] | null>(null);

  const calculateHeading = (prev: [number, number], curr: [number, number]) => {
    const lat1 = prev[0] * Math.PI / 180;
    const lon1 = prev[1] * Math.PI / 180;
    const lat2 = curr[0] * Math.PI / 180;
    const lon2 = curr[1] * Math.PI / 180;

    const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
    const θ = Math.atan2(y, x);
    const brng = (θ * 180 / Math.PI + 360) % 360; 
    return brng;
  };

  const updatePosition = useCallback((newPos: [number, number]) => {
    setGpsError(null); // Limpiar error al recibir posición válida
    setUserPos((prev) => {
      const last = lastPosRef.current;
      if (last) {
        const dist = Math.sqrt(Math.pow(newPos[0] - last[0], 2) + Math.pow(newPos[1] - last[1], 2));
        if (dist > 0.00001) {
          const newHeading = calculateHeading(last, newPos);
          if (!isNaN(newHeading)) {
            setHeading(newHeading);
          }
        }
      }
      lastPosRef.current = newPos;
      return newPos;
    });
    setHasLocation(true);
  }, []);

  // FIX I1: requestGPS ya no usa alert() — exponemos el error a través del estado
  const requestGPS = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGpsError('Tu navegador no soporta geolocalización.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updatePosition([pos.coords.latitude, pos.coords.longitude]);
      },
      (err) => {
        logger.warn('useGeolocation', 'Error GPS manual', err.message);
        const msgs: Record<number, string> = {
          1: 'Permiso de ubicación denegado. Actívalo en el navegador.',
          2: 'Posición no disponible. Intenta de nuevo.',
          3: 'La solicitud de GPS tardó demasiado.',
        };
        setGpsError(msgs[err.code] || `Error GPS: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [updatePosition]);

  // Geolocation Tracking continuo
  useEffect(() => {
    if (isPaused) return;

    if (!('geolocation' in navigator)) {
      setGpsError('Tu navegador no soporta geolocalización.');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        updatePosition([pos.coords.latitude, pos.coords.longitude]);
      },
      (err) => {
        logger.warn('useGeolocation', 'Error en watchPosition', err.message);
        // Solo mostramos error grave si ya teníamos posición y la perdemos
        if (hasLocation && err.code === 2) {
          setGpsError('Señal GPS perdida. Intentando reconectar...');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updatePosition, isPaused]);

  return {
    userPos,
    setUserPos,
    heading,
    setHeading,
    hasLocation,
    gpsError,
    requestGPS
  };
}
