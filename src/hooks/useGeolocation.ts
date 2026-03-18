'use client';

import { useState, useCallback, useEffect } from 'react';

export function useGeolocation() {
  const [userPos, setUserPos] = useState<[number, number]>([40.4168, -3.7038]); 
  const [hasLocation, setHasLocation] = useState(false);
  const [locationSource, setLocationSource] = useState<'default' | 'gps'>('default');

  const requestGPS = useCallback(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newPos: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setUserPos(newPos);
          setHasLocation(true);
          setLocationSource('gps');
        },
        (err) => {
          console.warn('Manual GPS Error:', err);
          alert('Error de GPS: ' + (err.message || 'Permiso denegado'));
        },
        { enableHighAccuracy: true }
      );
    }
  }, []);

  // Geolocation Tracking
  useEffect(() => {
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const newPos: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setUserPos(newPos);
          setHasLocation(true);
          setLocationSource('gps');
        },
        (err) => {
          console.warn('Geolocation Error:', err);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  return {
    userPos,
    setUserPos,
    hasLocation,
    locationSource,
    requestGPS
  };
}
