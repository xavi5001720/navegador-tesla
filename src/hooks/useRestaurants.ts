import { useState, useEffect, useRef, useCallback } from 'react';
import { getDistance, getPointAtDistance, distanceToPolyline } from '@/utils/geo';
import { logger } from '@/lib/logger';

export interface Restaurant {
  id: string;
  lat: number;
  lon: number;
  name: string;
  cuisine?: string;
  distanceToUser?: number;
  distanceToRoute?: number;
}

export interface RestaurantFilters {
  smartOptimization: boolean;
  maxDeviation: 0 | 5 | 10 | 15; // km
}

const LUNCH_START = 13.5 * 3600;
const LUNCH_END = 15.5 * 3600;
const DINNER_START = 20.5 * 3600;
const DINNER_END = 22.5 * 3600;

export function useRestaurants(
  enabled: boolean,
  filters: RestaurantFilters,
  userPos: [number, number] | null,
  route: any | null,
  liveDistance: number | null, // Remaining distance
  liveDuration: number | null  // Remaining duration
) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Cache A: No-Route or SmartOff
  const cacheCenterRef = useRef<[number, number] | null>(null);
  const cacheDataRef = useRef<Restaurant[]>([]);

  // Cache B: Route + SmartOn
  const lastPredictionSegmentRef = useRef<{start: number, end: number} | null>(null);
  const lastRouteCheckRef = useRef<{time: number, distance: number}>({ time: 0, distance: 0 });

  // Route cumulative distances for fast lookup
  const [cumulativeDistances, setCumulativeDistances] = useState<number[]>([]);

  useEffect(() => {
    if (route && route.coordinates) {
      let total = 0;
      const arr = [0];
      for (let i = 0; i < route.coordinates.length - 1; i++) {
        total += getDistance(route.coordinates[i], route.coordinates[i+1]);
        arr.push(total);
      }
      setCumulativeDistances(arr);
    } else {
      setCumulativeDistances([]);
    }
  }, [route]);

  const fetchOverpass = async (query: string): Promise<Restaurant[]> => {
    try {
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      if (!res.ok) throw new Error('Overpass API error');
      const data = await res.json();
      
      return data.elements
        .filter((e: any) => e.tags && e.tags.name)
        .map((e: any) => ({
          id: e.id.toString(),
          lat: e.lat,
          lon: e.lon,
          name: e.tags.name,
          cuisine: e.tags.cuisine || 'Variada',
        }));
    } catch (err) {
      logger.error('Restaurantes', 'Error fetching from Overpass: ' + (err as Error).message);
      return [];
    }
  };

  const evaluateAndFetch = useCallback(async () => {
    if (!enabled || !userPos) {
      setRestaurants([]);
      return;
    }

    // SCENARIO B: Route Active + Smart Optimization ON
    if (route && filters.smartOptimization) {
      const remainingDuration = liveDuration ?? route.duration;
      const remainingDistance = liveDistance ?? route.distance;
      
      const now = new Date();
      const currentSecondsOfDay = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
      const tripEndSeconds = currentSecondsOfDay + remainingDuration;

      // Check overlaps
      let overlapStart = -1;
      let overlapEnd = -1;

      if (currentSecondsOfDay < LUNCH_END && tripEndSeconds > LUNCH_START) {
        overlapStart = Math.max(currentSecondsOfDay, LUNCH_START);
        overlapEnd = Math.min(tripEndSeconds, LUNCH_END);
      } else if (currentSecondsOfDay < DINNER_END && tripEndSeconds > DINNER_START) {
        overlapStart = Math.max(currentSecondsOfDay, DINNER_START);
        overlapEnd = Math.min(tripEndSeconds, DINNER_END);
      }

      if (overlapStart === -1) {
        // No overlap. Clean map.
        setRestaurants([]);
        lastPredictionSegmentRef.current = null;
        return;
      }

      // We have an overlap. Find segment distance.
      const avgSpeed = remainingDuration > 0 ? remainingDistance / remainingDuration : 0;
      
      const distToOverlapStart = avgSpeed * (overlapStart - currentSecondsOfDay);
      const distToOverlapEnd = avgSpeed * (overlapEnd - currentSecondsOfDay);

      const currentDistanceAlongRoute = (route.distance || 0) - remainingDistance;
      const absoluteStartDist = currentDistanceAlongRoute + distToOverlapStart;
      const absoluteEndDist = currentDistanceAlongRoute + distToOverlapEnd;

      const nowMs = Date.now();
      const timeSinceLastCheck = nowMs - lastRouteCheckRef.current.time;
      const distSinceLastCheck = Math.abs((route.distance - remainingDistance) - lastRouteCheckRef.current.distance);

      const needsFetch = !lastPredictionSegmentRef.current || timeSinceLastCheck > 30 * 60 * 1000 || distSinceLastCheck > 30000;

      let fetchedRestaurants = cacheDataRef.current;

      if (needsFetch) {
        setLoading(true);
        setProgress(20);
        
        let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
        const pts = [];
        for (let d = absoluteStartDist; d <= absoluteEndDist; d += 5000) {
           const p = getPointAtDistance(cumulativeDistances, route.coordinates, d);
           if (p) pts.push(p);
        }
        const endP = getPointAtDistance(cumulativeDistances, route.coordinates, absoluteEndDist);
        if (endP) pts.push(endP);

        if (pts.length > 0) {
          pts.forEach(p => {
            if (p[0] < minLat) minLat = p[0];
            if (p[0] > maxLat) maxLat = p[0];
            if (p[1] < minLon) minLon = p[1];
            if (p[1] > maxLon) maxLon = p[1];
          });

          const marginKm = filters.maxDeviation + 2; 
          const latExpand = marginKm / 111.0;
          const lonExpand = marginKm / (111.0 * Math.cos((minLat + maxLat) / 2 * Math.PI / 180));

          minLat -= latExpand;
          maxLat += latExpand;
          minLon -= lonExpand;
          maxLon += lonExpand;

          setProgress(50);
          const query = `
            [out:json][timeout:25];
            (
              node["amenity"="restaurant"](${minLat},${minLon},${maxLat},${maxLon});
            );
            out body;
            >;
            out skel qt;
          `;
          
          fetchedRestaurants = await fetchOverpass(query);
          cacheDataRef.current = fetchedRestaurants;
          lastPredictionSegmentRef.current = { start: absoluteStartDist, end: absoluteEndDist };
          lastRouteCheckRef.current = { time: nowMs, distance: currentDistanceAlongRoute };
        }
      }

      setProgress(80);
      const maxDevMeters = filters.maxDeviation === 0 ? 500 : filters.maxDeviation * 1000;
      
      const filtered = fetchedRestaurants.filter(r => {
        const d = distanceToPolyline([r.lat, r.lon], route.coordinates);
        r.distanceToRoute = d;
        return d <= maxDevMeters;
      });

      setRestaurants(filtered);
      setLoading(false);
      setProgress(0);
      return;
    }

    // SCENARIO A: No Route OR Smart Optimization OFF
    const distFromCache = cacheCenterRef.current ? getDistance(userPos, cacheCenterRef.current) : Infinity;
    
    let fetchedRestaurants = cacheDataRef.current;

    if (distFromCache > 15000) { 
      setLoading(true);
      setProgress(30);
      const query = `
        [out:json][timeout:25];
        (
          node["amenity"="restaurant"](around:25000, ${userPos[0]}, ${userPos[1]});
        );
        out body;
        >;
        out skel qt;
      `;
      fetchedRestaurants = await fetchOverpass(query);
      cacheDataRef.current = fetchedRestaurants;
      cacheCenterRef.current = userPos;
      lastPredictionSegmentRef.current = null; 
    }

    setProgress(80);
    let filtered: Restaurant[] = [];
    if (route) {
      filtered = fetchedRestaurants.filter(r => {
        const distUser = getDistance(userPos, [r.lat, r.lon]);
        const distRoute = distanceToPolyline([r.lat, r.lon], route.coordinates);
        return distUser <= 5000 || distRoute <= 2000;
      });
    } else {
      filtered = fetchedRestaurants.filter(r => getDistance(userPos, [r.lat, r.lon]) <= 5000);
    }

    setRestaurants(filtered);
    setLoading(false);
    setProgress(0);

  }, [enabled, filters, userPos, route, liveDistance, liveDuration, cumulativeDistances]);

  useEffect(() => {
    const t = setTimeout(() => {
      evaluateAndFetch();
    }, 1500); 
    return () => clearTimeout(t);
  }, [evaluateAndFetch]);

  return { restaurants, loading, progress };
}
