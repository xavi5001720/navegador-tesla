import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  const fetchedChunksRef = useRef<Set<number>>(new Set());

  // Cache B: Route + SmartOn
  const lastPredictionSegmentRef = useRef<{start: number, end: number} | null>(null);
  const lastRouteCheckRef = useRef<{time: number, distance: number}>({ time: 0, distance: 0 });
  const bypassRef = useRef({ routeStr: '', targetTime: '', maxDev: -1 });

  // Route cumulative distances for fast lookup
  const [cumulativeDistances, setCumulativeDistances] = useState<number[]>([]);
  const currentRouteKey = route?.distance ? String(route.distance) : '';

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

  // 1. CHUNKING: Dividir la ruta en bloques de 50km (Arquitectura Radar)
  const routeChunks = useMemo(() => {
    if (!route || !route.coordinates || route.coordinates.length === 0 || cumulativeDistances.length === 0) return [];
    const chunks: {startDist: number, endDist: number}[] = [];
    const totalDist = cumulativeDistances[cumulativeDistances.length - 1];
    
    for (let d = 0; d < totalDist; d += 50000) {
      chunks.push({ startDist: d, endDist: Math.min(d + 50000, totalDist) });
    }
    return chunks;
  }, [route, cumulativeDistances]);

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
        
        const hasFsqRating = typeof r.rating_foursquare === 'number' && r.rating_foursquare > 0;
        const fsqNorm = hasFsqRating ? r.rating_foursquare! / 2 : null;

        let rating_community: number | null = null;
        let hasCommunityRating = false;

        if (placeReviews.length > 0) {
          const sum = placeReviews.reduce((acc, rev: any) => acc + rev.puntuacion, 0);
          rating_community = sum / placeReviews.length;
          hasCommunityRating = true;
        }

        let rating_combined: number | null = null;
        if (hasFsqRating && hasCommunityRating) {
          rating_combined = (fsqNorm! + rating_community!) / 2;
        } else if (hasFsqRating) {
          rating_combined = fsqNorm;
        } else if (hasCommunityRating) {
          rating_combined = rating_community;
        } else {
          rating_combined = null; // No ratings at all
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
    // LAZY CHUNK ARCHITECTURE (Radar/Charger Sync)
    // ------------------------------------------------------------------
    if (route && route.coordinates && route.coordinates.length > 1 && cumulativeDistances.length > 0) {
      const currentRouteStr = route.distance ? String(route.distance) : '';
      
      // Reset if route changes
      if (bypassRef.current.routeStr !== currentRouteStr) {
        fetchedChunksRef.current.clear();
        cacheDataRef.current = [];
        bypassRef.current = { routeStr: currentRouteStr, targetTime: filters.targetTime, maxDev: filters.maxDeviation };
      }

      // Encontrar posición actual en la ruta
      const currentDist = (route.distance || 0) - (liveDistance || route.distance);
      
      // Encontrar qué chunks debemos cargar
      const chunksToFetch: number[] = [];
      routeChunks.forEach((chunk, idx) => {
        // Si el coche está en este chunk o el chunk está cerca (Lazy Load 10km)
        const isNear = currentDist >= chunk.startDist - 5000 && currentDist <= chunk.endDist + 10000;
        if (isNear && !fetchedChunksRef.current.has(idx)) {
          chunksToFetch.push(idx);
        }
      });

      if (chunksToFetch.length > 0) {
        setLoading(true);
        setProgress(20);

        for (const chunkIdx of chunksToFetch) {
          fetchedChunksRef.current.add(chunkIdx);
          const chunk = routeChunks[chunkIdx];
          
          // Muestreo dentro del chunk (cada 15km para máxima densidad)
          const samplePoints: [number, number][] = [];
          for (let d = chunk.startDist; d <= chunk.endDist; d += 15000) {
            const pt = getPointAtDistance(cumulativeDistances, route.coordinates, d);
            if (pt) samplePoints.push(pt);
          }
          // Siempre el final del chunk si no se pilló
          const endPt = getPointAtDistance(cumulativeDistances, route.coordinates, chunk.endDist);
          if (endPt) samplePoints.push(endPt);

          // Peticiones paralelas para este chunk
          const results = await Promise.all(
            samplePoints.map(pt => fetchRestaurants(pt[0], pt[1], 3000))
          );

          const flatResults = results.flat();
          
          // Deduplicar y añadir al cache global
          const currentCache = cacheDataRef.current;
          const newOnes = flatResults.filter(r => !currentCache.some(p => p.id === r.id));
          cacheDataRef.current = [...currentCache, ...newOnes];
        }
      }

      setProgress(90);
      // Hard corridor post-filter: 2km max from route polyline (Route Snapping)
      const filtered = cacheDataRef.current.filter(r => {
        const d = distanceToPolyline([r.lat, r.lon], route.coordinates);
        r.distanceToRoute = d;
        return d <= 2000;
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
