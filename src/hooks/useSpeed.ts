'use client';

import { useState, useEffect } from 'react';

export function useSpeed() {
  const [speed, setSpeed] = useState<number>(0);

  useEffect(() => {
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          // speed viene en m/s, lo pasamos a km/h
          const speedKmh = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;
          setSpeed(speedKmh);
        },
        (err) => console.warn('Speed Error:', err),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  return speed;
}
