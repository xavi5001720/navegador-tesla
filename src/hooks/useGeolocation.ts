'use client';

import { useState, useCallback, useEffect } from 'react';

export function useGeolocation(isPaused?: boolean) {
  const [userPos, setUserPos] = useState<[number, number]>([40.4168, -3.7038]); 
  const [heading, setHeading] = useState<number>(0);
  const [hasLocation, setHasLocation] = useState(false);
  const [locationSource, setLocationSource] = useState<'default' | 'gps'>('default');

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
    setUserPos((prev) => {
      // Solo calculamos rumbo si la posición ha cambiado significativamente (> 1 metro aprox)
      const dist = Math.sqrt(Math.pow(newPos[0] - prev[0], 2) + Math.pow(newPos[1] - prev[1], 2));
      if (dist > 0.00001) {
        const newHeading = calculateHeading(prev, newPos);
        if (!isNaN(newHeading)) {
          setHeading(newHeading);
        }
      }
      return newPos;
    });
    setHasLocation(true);
    setLocationSource('gps');
  }, []);

  const requestGPS = useCallback(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          updatePosition([pos.coords.latitude, pos.coords.longitude]);
        },
        // ...
        (err) => {
          console.warn('Manual GPS Error:', err);
          alert('Error de GPS: ' + (err.message || 'Permiso denegado'));
        },
        { enableHighAccuracy: true }
      );
    }
  }, [updatePosition]);

  // Geolocation Tracking
  useEffect(() => {
    if (isPaused) return;

    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          updatePosition([pos.coords.latitude, pos.coords.longitude]);
        },
        (err) => {
          console.warn('Geolocation Error:', err);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [updatePosition, isPaused]);

  return {
    userPos,
    setUserPos,
    heading,
    setHeading,
    hasLocation,
    locationSource,
    requestGPS
  };
}

