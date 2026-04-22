import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getDistance, getPointAtDistance, distanceToPolyline } from '@/utils/geo';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Virtual weight assigned to a Foursquare rating in the weighted average.
 * Equivalent to trusting FSQ as much as N community reviews.
 * Future-proofing: when FSQ v3 delivers real ratings, adjust this constant.
 */
const FSQ_VIRTUAL_WEIGHT = 50;

/**
 * Corrección 6: Minimum distance (m) the user must move before
 * re-evaluating restaurants. Replaces the blind 1.5s timer.
 * At 120 km/h the car covers 500 m in ~15 s — a sensible cadence.
 */
const MIN_EVAL_DISTANCE_M = 500;

/** Chunk size (m) for lazy-loading restaurants along a route (Scenario B). */
const CHUNK_SIZE_M = 50_000;

/**
 * Corrección 2: Sampling step inside each chunk.
 * Rule: step ≤ radius × 2 → 4 000 ≤ 2 000 × 2 ✓ (zero blind spots).
 */
const SAMPLE_STEP_B = 4_000;

/**
 * Corrección 2: Foursquare search radius for Scenario B.
 * Matches the hard corridor filter — no over-fetching and then discarding.
 */
const CORRIDOR_RADIUS_B = 2_000;

/** Hard post-filter: restaurants further than this from the route are hidden. */
const HARD_CORRIDOR_M = 2_000;

/** Corrección 3: Exploration bubble radius (no active route). */
const EXPLORATION_RADIUS_M = 5_000;

/**
 * Corrección 3: Trigger a fresh fetch when the user moves further than
 * this from the last fetch centre. Must be < EXPLORATION_RADIUS_M so the
 * map never goes blank. (3 000 < 5 000 ✓)
 */
const EXPLORATION_REFRESH_M = 3_000;

/**
 * Corrección 1: Half-width of the time window (minutes) used in
 * Scenario A. A ±15-minute window covers a 30-minute stretch of route.
 */
const TIME_WINDOW_MIN = 15;

/** Corrección 5: Hours before a user can re-review the same restaurant. */
const PER_RESTAURANT_COOLDOWN_H = 24;

/** Corrección 5: Maximum distinct restaurant reviews per user per day. */
const DAILY_REVIEW_LIMIT = 5;

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Rating helper ────────────────────────────────────────────────────────────

/**
 * Corrección 4: Computes a weighted hybrid rating on a 1–5 scale.
 *
 * Both sources are normalised to 0–100 % before blending so that
 * different native scales (FSQ 1–10, Community 1–5) are comparable.
 * The weight of each source is proportional to the number of reviews
 * behind it: a FSQ rating backed by ~500 reviews (FSQ_VIRTUAL_WEIGHT = 50)
 * will dominate a single community review, as expected.
 *
 * @param fsqRaw        Raw FSQ rating (1–10 scale). null if unavailable.
 * @param communityAvg  Mean of community reviews (1–5 scale). null if none.
 * @param communityCount  Number of community reviews.
 * @returns Rating in 1–5 scale, or null when both sources are absent.
 */
function computeHybridRating(
  fsqRaw: number | null,
  communityAvg: number | null,
  communityCount: number
): number | null {
  const fsqPct  = fsqRaw      != null ? (fsqRaw / 10) * 100      : null;
  const commPct = communityAvg != null ? (communityAvg / 5) * 100 : null;

  const fsqWeight  = fsqPct  != null ? FSQ_VIRTUAL_WEIGHT : 0;
  const commWeight = commPct != null ? communityCount      : 0;
  const totalWeight = fsqWeight + commWeight;

  if (totalWeight === 0) return null;

  const weightedSum =
    (fsqPct  != null ? fsqPct  * fsqWeight  : 0) +
    (commPct != null ? commPct * commWeight : 0);

  return (weightedSum / totalWeight / 100) * 5;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useRestaurants(
  enabled: boolean,
  filters: RestaurantFilters,
  userPos: [number, number] | null,
  route: any | null,
  liveDistance: number | null,
  liveDuration: number | null
) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading]         = useState(false);
  const [progress, setProgress]       = useState(0);

  // ── Cache refs ────────────────────────────────────────────────────────────
  const cacheCenterRef       = useRef<[number, number] | null>(null);
  const cacheDataRef         = useRef<Restaurant[]>([]);
  const fetchedChunksRef     = useRef<Set<number>>(new Set());
  const lastPredictionSegRef = useRef<{ start: number; end: number } | null>(null);
  const lastRouteCheckRef    = useRef<{ time: number; distance: number }>({ time: 0, distance: 0 });
  const bypassRef            = useRef({ routeStr: '', targetTime: '', maxDev: -1 });

  // ── Corrección 6: GPS guard refs ─────────────────────────────────────────
  const lastEvalPosRef    = useRef<[number, number] | null>(null);
  const lastEvalConfigRef = useRef<string>('');

  // ── Cumulative distances along the route polyline ─────────────────────────
  const [cumulativeDistances, setCumulativeDistances] = useState<number[]>([]);

  useEffect(() => {
    if (route && route.coordinates) {
      let total = 0;
      const arr = [0];
      for (let i = 0; i < route.coordinates.length - 1; i++) {
        total += getDistance(route.coordinates[i], route.coordinates[i + 1]);
        arr.push(total);
      }
      setCumulativeDistances(arr);
    } else {
      setCumulativeDistances([]);
    }
  }, [route]);

  // ── Route chunks for Scenario B lazy loading ──────────────────────────────
  const routeChunks = useMemo(() => {
    if (!route?.coordinates?.length || cumulativeDistances.length === 0) return [];
    const chunks: { startDist: number; endDist: number }[] = [];
    const totalDist = cumulativeDistances[cumulativeDistances.length - 1];
    for (let d = 0; d < totalDist; d += CHUNK_SIZE_M) {
      chunks.push({ startDist: d, endDist: Math.min(d + CHUNK_SIZE_M, totalDist) });
    }
    return chunks;
  }, [route, cumulativeDistances]);

  // ── Low-level fetch: Foursquare proxy + Supabase reviews ──────────────────
  const fetchRestaurants = async (
    lat: number,
    lon: number,
    radiusMeters: number
  ): Promise<Restaurant[]> => {
    try {
      const res = await fetch(`/api/restaurants?lat=${lat}&lon=${lon}&radius=${radiusMeters}`);
      if (!res.ok) throw new Error('Proxy API error');
      const data = await res.json();
      const fsqItems: Restaurant[] = data.elements || [];
      if (fsqItems.length === 0) return [];

      const fsqIds = fsqItems.map(r => r.id);
      const { data: reviews, error } = await supabase
        .from('resenas_tesla')
        .select('fsq_id, puntuacion')
        .in('fsq_id', fsqIds);

      if (error) logger.error('Restaurantes', 'Supabase reviews error: ' + error.message);

      return fsqItems.map(r => {
        const placeReviews   = (reviews || []).filter((rev: any) => rev.fsq_id === r.id);
        const communityCount = placeReviews.length;
        const communityAvg   = communityCount > 0
          ? placeReviews.reduce((acc: number, rev: any) => acc + rev.puntuacion, 0) / communityCount
          : null;

        // Corrección 4: normalised weighted hybrid rating
        const rating_combined = computeHybridRating(
          r.rating_foursquare ?? null,
          communityAvg,
          communityCount
        );

        return {
          ...r,
          rating_community: communityAvg ?? undefined,
          rating_combined:  rating_combined ?? undefined,
          total_reviews:    communityCount,
        };
      });
    } catch (err) {
      logger.error('Restaurantes', 'Fetch error: ' + (err as Error).message);
      return [];
    }
  };

  /**
   * Samples a route segment at regular intervals and fetches restaurants
   * around each sample point in parallel. Returns deduplicated results.
   */
  const fetchSegment = async (
    startDist: number,
    endDist: number,
    radiusMeters: number,
    sampleStep: number
  ): Promise<Restaurant[]> => {
    if (!route?.coordinates || cumulativeDistances.length === 0) return [];
    const totalDist    = cumulativeDistances[cumulativeDistances.length - 1] ?? 0;
    const clampedStart = Math.max(0, startDist);
    const clampedEnd   = Math.min(totalDist, endDist);

    const samplePoints: [number, number][] = [];
    for (let d = clampedStart; d <= clampedEnd; d += sampleStep) {
      const pt = getPointAtDistance(cumulativeDistances, route.coordinates, d);
      if (pt) samplePoints.push(pt);
    }
    // Always include end of window
    const endPt = getPointAtDistance(cumulativeDistances, route.coordinates, clampedEnd);
    if (endPt) samplePoints.push(endPt);

    const results = await Promise.all(
      samplePoints.map(pt => fetchRestaurants(pt[0], pt[1], radiusMeters))
    );

    // Deduplicate by id
    const seen = new Set<string>();
    return results.flat().filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  };

  // ── Main evaluation function ───────────────────────────────────────────────
  const evaluateAndFetch = useCallback(async () => {
    if (!enabled || !userPos) {
      setRestaurants([]);
      return;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SCENARIO A: Route active + Smart Optimization ON
    // Corrección 1: Search a ±15-min TIME WINDOW, not a single point.
    // ═══════════════════════════════════════════════════════════════════════
    if (route && filters.smartOptimization) {
      const remainingDuration = liveDuration ?? route.duration;
      const remainingDistance = liveDistance  ?? route.distance;

      const now = new Date();
      const currentSecondsOfDay = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
      const [hStr, mStr]        = (filters.targetTime || '14:00').split(':');
      const targetSecondsOfDay  = parseInt(hStr) * 3600 + parseInt(mStr) * 60;

      let secondsToTarget = targetSecondsOfDay - currentSecondsOfDay;
      if (secondsToTarget < -3600) secondsToTarget += 24 * 3600;

      if (secondsToTarget < 0 || secondsToTarget > remainingDuration) {
        setRestaurants([]);
        lastPredictionSegRef.current = null;
        return;
      }

      const avgSpeed               = remainingDuration > 0 ? remainingDistance / remainingDuration : 0;
      const distToTarget           = avgSpeed * secondsToTarget;
      const currentDistAlongRoute  = (route.distance ?? 0) - remainingDistance;
      const absoluteTargetDist     = currentDistAlongRoute + distToTarget;

      // ── Time window: ±TIME_WINDOW_MIN around the target moment ──────────
      const windowMeters = avgSpeed * TIME_WINDOW_MIN * 60;
      const windowStart  = absoluteTargetDist - windowMeters;
      const windowEnd    = absoluteTargetDist + windowMeters;

      const nowMs              = Date.now();
      const timeSinceLastCheck = nowMs - lastRouteCheckRef.current.time;
      const distSinceLastCheck = Math.abs(currentDistAlongRoute - lastRouteCheckRef.current.distance);
      const currentRouteStr    = String(route.distance ?? '');

      const bypass =
        bypassRef.current.routeStr   !== currentRouteStr    ||
        bypassRef.current.targetTime !== filters.targetTime ||
        bypassRef.current.maxDev     !== filters.maxDeviation;

      if (bypass) {
        bypassRef.current = {
          routeStr:   currentRouteStr,
          targetTime: filters.targetTime,
          maxDev:     filters.maxDeviation,
        };
      }

      const windowShifted = Math.abs((lastPredictionSegRef.current?.start ?? 0) - windowStart) > 5000;
      const needsFetch    =
        bypass                           ||
        !lastPredictionSegRef.current    ||
        timeSinceLastCheck > 30 * 60 * 1000 ||
        distSinceLastCheck > 30_000      ||
        windowShifted;

      let fetchedRestaurants = cacheDataRef.current;

      if (needsFetch) {
        setLoading(true);
        setProgress(50);

        const radiusMeters = filters.maxDeviation === 0 ? 500 : filters.maxDeviation * 1000;
        // Step guarantees overlap: step ≤ radius × 2
        const sampleStep   = Math.max(500, radiusMeters * 2);

        fetchedRestaurants = await fetchSegment(windowStart, windowEnd, radiusMeters, sampleStep);
        cacheDataRef.current           = fetchedRestaurants;
        lastPredictionSegRef.current   = { start: windowStart, end: windowEnd };
        lastRouteCheckRef.current      = { time: nowMs, distance: currentDistAlongRoute };
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

    // ═══════════════════════════════════════════════════════════════════════
    // SCENARIO B: Route active + Smart Optimization OFF (Radar architecture)
    // Corrección 2: 4 km step, 2 km radius — zero blind spots.
    // ═══════════════════════════════════════════════════════════════════════
    if (route?.coordinates?.length > 1 && cumulativeDistances.length > 0) {
      const currentRouteStr = String(route.distance ?? '');

      if (bypassRef.current.routeStr !== currentRouteStr) {
        fetchedChunksRef.current.clear();
        cacheDataRef.current = [];
        bypassRef.current = {
          routeStr:   currentRouteStr,
          targetTime: filters.targetTime,
          maxDev:     filters.maxDeviation,
        };
      }

      const currentDist     = (route.distance ?? 0) - (liveDistance ?? route.distance);
      const chunksToFetch: number[] = [];

      routeChunks.forEach((chunk, idx) => {
        const isNear = currentDist >= chunk.startDist - 5000 && currentDist <= chunk.endDist + 10_000;
        if (isNear && !fetchedChunksRef.current.has(idx)) chunksToFetch.push(idx);
      });

      if (chunksToFetch.length > 0) {
        setLoading(true);
        setProgress(20);

        for (const chunkIdx of chunksToFetch) {
          fetchedChunksRef.current.add(chunkIdx);
          const chunk = routeChunks[chunkIdx];

          // Corrección 2: SAMPLE_STEP_B = 4 km, CORRIDOR_RADIUS_B = 2 km
          const fresh = await fetchSegment(
            chunk.startDist,
            chunk.endDist,
            CORRIDOR_RADIUS_B,
            SAMPLE_STEP_B
          );

          const currentCache = cacheDataRef.current;
          const newOnes = fresh.filter(r => !currentCache.some(p => p.id === r.id));
          cacheDataRef.current = [...currentCache, ...newOnes];
        }
      }

      setProgress(90);
      // Hard corridor post-filter: discard anything > 2 km from the polyline
      const filtered = cacheDataRef.current.filter(r => {
        const d = distanceToPolyline([r.lat, r.lon], route.coordinates);
        r.distanceToRoute = d;
        return d <= HARD_CORRIDOR_M;
      });

      setRestaurants(filtered);
      setLoading(false);
      setProgress(0);
      return;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SCENARIO C: No route — exploration bubble around the user.
    // Corrección 3: refresh at 3 km (< 5 km radius → map never goes blank).
    // ═══════════════════════════════════════════════════════════════════════
    const distFromCache = cacheCenterRef.current
      ? getDistance(userPos, cacheCenterRef.current)
      : Infinity;

    let fetchedRestaurants = cacheDataRef.current;

    if (distFromCache > EXPLORATION_REFRESH_M) {
      setLoading(true);
      setProgress(30);
      fetchedRestaurants        = await fetchRestaurants(userPos[0], userPos[1], EXPLORATION_RADIUS_M);
      cacheDataRef.current      = fetchedRestaurants;
      cacheCenterRef.current    = userPos;
      lastPredictionSegRef.current = null;
    }

    setProgress(80);
    const filtered = fetchedRestaurants.filter(r =>
      getDistance(userPos, [r.lat, r.lon]) <= EXPLORATION_RADIUS_M
    );
    filtered.forEach(r => { r.distanceToRoute = 0; });

    setRestaurants(filtered);
    setLoading(false);
    setProgress(0);
  }, [enabled, filters, userPos, route, liveDistance, liveDuration, cumulativeDistances, routeChunks]);

  // ── Corrección 6: GPS-distance guard (replaces the 1.5 s blind timer) ────
  useEffect(() => {
    if (!enabled || !userPos) {
      setRestaurants([]);
      lastEvalPosRef.current = null;
      return;
    }

    // Serialised key that changes when route or filters change
    const configKey = `${filters.smartOptimization}|${filters.maxDeviation}|${filters.targetTime}|${route?.distance ?? ''}`;
    const configChanged = configKey !== lastEvalConfigRef.current;

    const distMoved = lastEvalPosRef.current
      ? getDistance(userPos, lastEvalPosRef.current)
      : Infinity; // First call → always evaluate

    if (configChanged || distMoved >= MIN_EVAL_DISTANCE_M) {
      lastEvalPosRef.current    = userPos;
      lastEvalConfigRef.current = configKey;
      evaluateAndFetch();
    }
  }, [enabled, userPos, filters, route, evaluateAndFetch]);

  // ── Corrección 5: Anti-spam — per restaurant (24 h) + daily limit (5) ────
  /**
   * Checks whether a user is allowed to post a new review.
   *
   * Rules (applied in order):
   *  1. If `fsqId` is provided: the user cannot review the same restaurant
   *     more than once every PER_RESTAURANT_COOLDOWN_H hours.
   *  2. Regardless of restaurant: the user cannot post more than
   *     DAILY_REVIEW_LIMIT distinct reviews in the last 24 hours.
   *
   * Backward-compatible: callers that omit `fsqId` only get the daily check.
   */
  const checkCanReview = async (
    userId: string,
    fsqId?: string
  ): Promise<{ canReview: boolean; hoursLeft: number; reason?: 'per_restaurant' | 'daily_limit' }> => {
    try {
      const now        = new Date();
      const since24h   = new Date(now.getTime() - PER_RESTAURANT_COOLDOWN_H * 60 * 60 * 1000).toISOString();

      // 1. Per-restaurant check
      if (fsqId) {
        const { data: existing } = await supabase
          .from('resenas_tesla')
          .select('created_at')
          .eq('usuario_id', userId)
          .eq('fsq_id', fsqId)
          .gte('created_at', since24h)
          .limit(1);

        if (existing && existing.length > 0) {
          const lastMs   = new Date(existing[0].created_at).getTime();
          const hoursLeft = PER_RESTAURANT_COOLDOWN_H - (now.getTime() - lastMs) / 3_600_000;
          return { canReview: false, hoursLeft: Math.max(0, hoursLeft), reason: 'per_restaurant' };
        }
      }

      // 2. Daily limit check (last 24 h, all restaurants)
      const { data: dailyReviews } = await supabase
        .from('resenas_tesla')
        .select('created_at')
        .eq('usuario_id', userId)
        .gte('created_at', since24h)
        .order('created_at', { ascending: true });

      if (dailyReviews && dailyReviews.length >= DAILY_REVIEW_LIMIT) {
        // The oldest review in the window determines when a slot opens up
        const oldestMs  = new Date(dailyReviews[0].created_at).getTime();
        const hoursLeft = PER_RESTAURANT_COOLDOWN_H - (now.getTime() - oldestMs) / 3_600_000;
        return { canReview: false, hoursLeft: Math.max(0, hoursLeft), reason: 'daily_limit' };
      }

      return { canReview: true, hoursLeft: 0 };
    } catch (err) {
      console.error('[Anti-Spam] Error:', err);
      return { canReview: false, hoursLeft: 1 };
    }
  };

  return { restaurants, loading, progress, checkCanReview };
}
