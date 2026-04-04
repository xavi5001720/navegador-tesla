'use client';

import { useState, useEffect } from 'react';

export function useSpeed(isPaused?: boolean) {
  const [speed, setSpeed] = useState<number>(0);

  useEffect(() => {
    if (isPaused) return; // Detener hardware si está pausado

    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const speedKmh = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;
          setSpeed(speedKmh);
        },
        (err) => console.warn('Speed Error:', err),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [isPaused]);


  return { speed, setSpeed };
}

