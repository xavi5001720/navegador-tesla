'use client';

import { useState, useEffect, useMemo } from 'react';
import { YachtPosition } from './useLuxuryYachts';

// --- Geographical Helpers ---
function toRad(value: number) { return value * Math.PI / 180; }
function toDeg(value: number) { return value * 180 / Math.PI; }

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function useVesselSimulator(realYachts: YachtPosition[]): YachtPosition[] {
  const [simulatedYachts, setSimulatedYachts] = useState<YachtPosition[]>(realYachts);

  // Memoize parsed waypoints to avoid JSON.parse on every tick
  const waypointsMap = useMemo(() => {
    const map = new Map<string, any>();
    realYachts.forEach(y => {
      if (y.owner === 'Tesla Transport' && y.destination) {
        try {
          map.set(y.mmsi, JSON.parse(y.destination));
        } catch (e) {
          // Ignore invalid JSON
        }
      }
    });
    return map;
  }, [realYachts]);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      
      const nextYachts = realYachts.map(y => {
        const data = waypointsMap.get(y.mmsi);
        if (y.owner !== 'Tesla Transport' || !data || !data.waypoints || data.waypoints.length === 0) {
          return y;
        }

        try {
          const path = [[y.latitude, y.longitude], ...data.waypoints];
          const lastUpdate = new Date(y.last_update).getTime();
          const hoursElapsed = (now - lastUpdate) / (1000 * 3600);
          const speedKmh = (y.speed || 16) * 1.852;
          let distanceRemaining = speedKmh * hoursElapsed;

          let currentLat = y.latitude;
          let currentLon = y.longitude;
          let currentBearing = y.course;

          // Follow the maritime path segment by segment
          for (let i = 0; i < path.length - 1; i++) {
            const start = path[i];
            const end = path[i+1];
            const segmentDist = calculateDistance(start[0], start[1], end[0], end[1]);

            if (distanceRemaining <= segmentDist) {
              const fraction = segmentDist > 0 ? distanceRemaining / segmentDist : 0;
              currentLat = start[0] + (end[0] - start[0]) * fraction;
              currentLon = start[1] + (end[1] - start[1]) * fraction;
              currentBearing = calculateBearing(start[0], start[1], end[0], end[1]);
              distanceRemaining = 0;
              break;
            } else {
              distanceRemaining -= segmentDist;
              currentLat = end[0];
              currentLon = end[1];
            }
          }

          return {
            ...y,
            latitude: currentLat,
            longitude: currentLon,
            course: currentBearing,
            heading: currentBearing
          };
        } catch (e) {
          return y;
        }
      });

      setSimulatedYachts(nextYachts);
    };

    // Updated interval to 15 minutes (900,000ms) for performance
    const interval = setInterval(tick, 900000);
    tick();

    return () => clearInterval(interval);
  }, [realYachts, waypointsMap]);

  return simulatedYachts;
}
