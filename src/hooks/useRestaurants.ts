import { useState, useEffect, useRef, useCallback } from 'react';
import { getDistance, getPointAtDistance, distanceToPolyline } from '@/utils/geo';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export interface Restaurant {
  id: string;
  lat: number;
  lon: number;
  name: string;
  cuisine?: string;
  rating_foursquare?: number;
  rating_community?: number;
  rating_combined?: number;
  total_reviews?: number;
  distanceToUser?: number;
  distanceToRoute?: number;
}

export interface RestaurantFilters {
  smartOptimization: boolean;
  maxDeviation: 0 | 5 | 10 | 15; // km
  targetTime: string; // e.g. '14:15'
}

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
  const bypassRef = useRef({ routeStr: '', targetTime: '', maxDev: -1 });

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

  const fetchRestaurants = async (lat: number, lon: number, radiusMeters: number): Promise<Restaurant[]> => {
    try {
      const res = await fetch(`/api/restaurants?lat=${lat}&lon=${lon}&radius=${radiusMeters}`);
      if (!res.ok) throw new Error('Proxy API error');
      const data = await res.json();
      const fsqRestaurants: Restaurant[] = data.elements || [];

      if (fsqRestaurants.length === 0) return [];

      const fsqIds = fsqRestaurants.map(r => r.id);
      const { data: reviews, error } = await supabase
        .from('resenas_tesla')
        .select('fsq_id, puntuacion')
        .in('fsq_id', fsqIds);

      if (error) {
        logger.error('Restaurantes', 'Error fetching Supabase reviews: ' + error.message);
      }

      const merged = fsqRestaurants.map(r => {
        const placeReviews = (reviews || []).filter(rev => rev.fsq_id === r.id);
        const fsqNorm = r.rating_foursquare ? r.rating_foursquare / 2 : null;
        
        let rating_community = null;
        let rating_combined = fsqNorm;
        
        if (placeReviews.length > 0) {
          const sum = placeReviews.reduce((acc, rev: any) => acc + rev.puntuacion, 0);
          rating_community = sum / placeReviews.length;
          rating_combined = fsqNorm ? (fsqNorm + rating_community) / 2 : rating_community;
        }

        return {
          ...r,
          rating_community,
          rating_combined,
          total_reviews: placeReviews.length
        };
      });

      return merged;
    } catch (err) {
      logger.error('Restaurantes', 'Error fetching hybrid restaurants: ' + (err as Error).message);
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
      
      const targetParts = (filters.targetTime || '14:00').split(':');
      const targetSecondsOfDay = parseInt(targetParts[0]) * 3600 + parseInt(targetParts[1]) * 60;

      let secondsToTarget = targetSecondsOfDay - currentSecondsOfDay;
      if (secondsToTarget < -3600) {
         secondsToTarget += 24 * 3600;
      }

      if (secondsToTarget < 0 || secondsToTarget > remainingDuration) {
        setRestaurants([]);
        lastPredictionSegmentRef.current = null;
        return;
      }

      const avgSpeed = remainingDuration > 0 ? remainingDistance / remainingDuration : 0;
      const distToTarget = avgSpeed * secondsToTarget;

      const currentDistanceAlongRoute = (route.distance || 0) - remainingDistance;
      const absoluteTargetDist = currentDistanceAlongRoute + distToTarget;

      const targetPoint = getPointAtDistance(cumulativeDistances, route.coordinates, absoluteTargetDist);
      if (!targetPoint) {
        setRestaurants([]);
        return;
      }

      const nowMs = Date.now();
      const timeSinceLastCheck = nowMs - lastRouteCheckRef.current.time;
      const distSinceLastCheck = Math.abs((route.distance - remainingDistance) - lastRouteCheckRef.current.distance);

      const currentRouteStr = route.distance ? String(route.distance) : '';
      const bypass = 
        bypassRef.current.routeStr !== currentRouteStr ||
        bypassRef.current.targetTime !== filters.targetTime ||
        bypassRef.current.maxDev !== filters.maxDeviation;

      if (bypass) {
        bypassRef.current = {
          routeStr: currentRouteStr,
          targetTime: filters.targetTime,
          maxDev: filters.maxDeviation
        };
      }

      const prevStart = lastPredictionSegmentRef.current?.start || 0;
      const targetShifted = Math.abs(prevStart - absoluteTargetDist) > 5000; 

      const needsFetch = bypass || !lastPredictionSegmentRef.current || timeSinceLastCheck > 30 * 60 * 1000 || distSinceLastCheck > 30000 || targetShifted;

      let fetchedRestaurants = cacheDataRef.current;

      if (needsFetch) {
        setLoading(true);
        setProgress(50);
        
        const radiusMeters = filters.maxDeviation === 0 ? 500 : filters.maxDeviation * 1000;
        
        fetchedRestaurants = await fetchRestaurants(targetPoint[0], targetPoint[1], radiusMeters);
        cacheDataRef.current = fetchedRestaurants;
        lastPredictionSegmentRef.current = { start: absoluteTargetDist, end: absoluteTargetDist };
        lastRouteCheckRef.current = { time: nowMs, distance: currentDistanceAlongRoute };
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
    // ------------------------------------------------------------------
    // If there's a route: sample the polyline every 30km and do a tight
    // 5km search at each sample point to find roadside restaurants.
    // This avoids swamping Foursquare with a single 25km city-center query.
    // ------------------------------------------------------------------
    if (route && route.coordinates && route.coordinates.length > 1) {
      const currentRouteStr = route.distance ? String(route.distance) : '';
      const bypass = bypassRef.current.routeStr !== currentRouteStr;
      
      let fetchedRestaurants = cacheDataRef.current;

      if (bypass || fetchedRestaurants.length === 0) {
        setLoading(true);
        setProgress(20);
        bypassRef.current = { routeStr: currentRouteStr, targetTime: filters.targetTime, maxDev: filters.maxDeviation };

        // Build sample points every 30km along the polyline
        const SAMPLE_INTERVAL_M = 30000; // 30km
        const SEARCH_RADIUS_M = 5000;    // 5km tight corridor
        const routeTotalM = cumulativeDistances[cumulativeDistances.length - 1] || 0;
        const samplePoints: [number, number][] = [];

        for (let d = 0; d <= routeTotalM; d += SAMPLE_INTERVAL_M) {
          const pt = getPointAtDistance(cumulativeDistances, route.coordinates, d);
          if (pt) samplePoints.push(pt);
        }
        // Always include endpoint
        const lastPt = getPointAtDistance(cumulativeDistances, route.coordinates, routeTotalM);
        if (lastPt) samplePoints.push(lastPt);

        // Parallel fetches for all sample points
        const step = 60 / (samplePoints.length || 1);
        const allResults = await Promise.all(
          samplePoints.map(async (pt, i) => {
            const results = await fetchRestaurants(pt[0], pt[1], SEARCH_RADIUS_M);
            setProgress(20 + Math.round((i + 1) * step));
            return results;
          })
        );

        // Deduplicate by id
        const seen = new Set<string>();
        fetchedRestaurants = allResults.flat().filter(r => {
          if (seen.has(r.id)) return false;
          seen.add(r.id);
          return true;
        });

        cacheDataRef.current = fetchedRestaurants;
        cacheCenterRef.current = userPos;
        lastPredictionSegmentRef.current = null;
      }

      setProgress(90);
      // Filter: up to 4km from the route polyline
      const filtered = fetchedRestaurants.filter(r => {
        const d = distanceToPolyline([r.lat, r.lon], route.coordinates);
        r.distanceToRoute = d;
        return d <= 4000;
      });

      setRestaurants(filtered);
      setLoading(false);
      setProgress(0);
      return;
    }

    // No route at all — simple 5km bubble around user
    const distFromCache = cacheCenterRef.current ? getDistance(userPos, cacheCenterRef.current) : Infinity;
    let fetchedRestaurants = cacheDataRef.current;

    if (distFromCache > 10000) {
      setLoading(true);
      setProgress(30);
      fetchedRestaurants = await fetchRestaurants(userPos[0], userPos[1], 5000);
      cacheDataRef.current = fetchedRestaurants;
      cacheCenterRef.current = userPos;
      lastPredictionSegmentRef.current = null;
    }

    setProgress(80);
    const filtered = fetchedRestaurants.filter(r => getDistance(userPos, [r.lat, r.lon]) <= 5000);
    filtered.forEach(r => { r.distanceToRoute = 0; });

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

  // Validación Anti-Spam (1 reseña cada 8 horas por usuario)
  const checkCanReview = async (userId: string): Promise<{ canReview: boolean, hoursLeft: number }> => {
    try {
      const { data, error } = await supabase
        .from('resenas_tesla')
        .select('created_at')
        .eq('usuario_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      if (!data || data.length === 0) return { canReview: true, hoursLeft: 0 };

      const lastReviewDate = new Date(data[0].created_at).getTime();
      const now = new Date().getTime();
      const hoursSince = (now - lastReviewDate) / (1000 * 60 * 60);

      if (hoursSince < 8) {
        return { canReview: false, hoursLeft: 8 - hoursSince };
      }
      return { canReview: true, hoursLeft: 0 };
    } catch (err) {
      console.error('[Anti-Spam] Error consultando límite:', err);
      return { canReview: false, hoursLeft: 8 }; 
    }
  };

  return { restaurants, loading, progress, checkCanReview };
}
