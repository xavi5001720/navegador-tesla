'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

// ── Tipos ─────────────────────────────────────────────────────────────────────
export interface Aircraft {
  icao24        : string;
  callsign      : string;
  origin_country: string;
  lat           : number;
  lon           : number;
  altitude      : number;
  velocity      : number;
  track         : number;
  isSuspect     : boolean;
  distanceToUser: number;
  etaMinutes?   : number; // Tiempo estimado de llegada en minutos
  isApproaching?: boolean; // ¿Viene hacia el usuario?
}

const SNAP_SIZE = 4.0;
function snapDown(v: number): number { return Math.floor(v / SNAP_SIZE) * SNAP_SIZE; }

function buildBboxKey(userPos: [number, number]): string {
  const sLamin = snapDown(userPos[0]);
  const sLomin = snapDown(userPos[1]);
  const sLamax = sLamin + SNAP_SIZE;
  const sLomax = sLomin + SNAP_SIZE;
  return `${sLamin.toFixed(1)}_${sLomin.toFixed(1)}_${sLamax.toFixed(1)}_${sLomax.toFixed(1)}`;
}

// Helper para calcular rumbo entre dos puntos (Bearing)
function getBearing(lat1: number, lon1: number, lat2: number, lon2: number) {
  const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

const FETCH_INTERVAL_NORMAL = 60_000;
const FETCH_INTERVAL_FAST   = 30_000;
const FETCH_INTERVAL_SAVE   = 300_000; // 5 minutos de ahorro

export function usePegasus(
  userPos          : [number, number] | null,
  isEnabled        : boolean = false,
  routeCoordinates?: [number, number][]
) {
  const [allAircrafts, setAllAircrafts] = useState<Aircraft[]>([]);
  const [loading,      setLoading     ] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [activeAccount, setActiveAccount] = useState<number>(1);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const [nextInterval,  setNextInterval ] = useState<number>(FETCH_INTERVAL_NORMAL);

  const userPosRef = useRef(userPos);
  useEffect(() => { userPosRef.current = userPos; }, [userPos]);

  const isFirstFetchAfterEnable = useRef(true);

  useEffect(() => {
    if (!isEnabled || !userPos) {
      isFirstFetchAfterEnable.current = true;
      if (!isEnabled) {
        setAllAircrafts([]);
        setIsRateLimited(false);
        if (userPosRef.current) {
          const bboxKey = buildBboxKey(userPosRef.current);
          supabase.from('opensky_requests').delete().eq('bbox_key', bboxKey)
            .then(({ error }) => { if (error) logger.warn('usePegasus', 'Error limpieza', error.message); });
        }
      }
      return;
    }

    const fetchAircrafts = async (): Promise<{ count: number, minETA: number, anyApproaching: boolean }> => {
      const pos = userPosRef.current;
      if (!pos) return { count: 0, minETA: Infinity, anyApproaching: false };

      setLoading(true);
      try {
        const sLamin = snapDown(pos[0]);
        const sLomin = snapDown(pos[1]);
        const sLamax = sLamin + SNAP_SIZE;
        const sLomax = sLomin + SNAP_SIZE;
        const bboxKey = `${sLamin.toFixed(1)}_${sLomin.toFixed(1)}_${sLamax.toFixed(1)}_${sLomax.toFixed(1)}`;

        await supabase.from('opensky_requests').upsert({
          bbox_key: bboxKey, last_requested_at: Date.now(), updated_at: new Date().toISOString(), ulat: pos[0], ulon: pos[1]
        });

        if (isFirstFetchAfterEnable.current) {
          await new Promise(resolve => setTimeout(resolve, 1500));
          isFirstFetchAfterEnable.current = false;
        }

        const { data: cached, error } = await supabase.from('opensky_cache').select('*').eq('bbox_key', bboxKey).single();
        if (error || !cached) return { count: 0, minETA: Infinity, anyApproaching: false };

        setIsRateLimited(cached.rate_limited ?? false);
        if (cached.account_index && cached.account_index !== -1) setActiveAccount(cached.account_index);

        const rawStates: any[] = cached.states ?? [];
        const haversine = (p1: [number, number], p2: [number, number]) => {
          const R = 6371000;
          const dLat = (p2[0] - p1[0]) * Math.PI / 180;
          const dLon = (p2[1] - p1[1]) * Math.PI / 180;
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1[0] * Math.PI/180) * Math.cos(p2[0] * Math.PI/180) * Math.sin(dLon / 2) ** 2;
          return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };

        const WATCH_RE = /DGT|PESG|SAER|POLIC|GUARDIA|GC|POL/i;
        const COMMERCIAL_RE = /^(EAX|IBE|RYR|VLG|EZY|AFR|DLH|KLM|BAW)/i;

        let minETA = Infinity;
        let anyApproaching = false;

        const enriched: Aircraft[] = rawStates.map(s => {
          const lat = s[6], lon = s[5];
          if (lat == null || lon == null || s[8] === true) return null;

          const callsign = (s[1] || '').trim();
          const altitude = s[7] ?? s[13] ?? 0;
          const velocity = s[9] ?? 0; // m/s
          const icao24 = s[0] || '';
          const track = s[10] ?? 0;

          const distanceToUser = haversine([pos[0], pos[1]], [lat, lon]);
          
          // LÓGICA DE APROXIMACIÓN (Vectorial)
          const bearingToUser = getBearing(lat, lon, pos[0], pos[1]);
          const angleDiff = Math.abs(track - bearingToUser) % 360;
          const isApproaching = (angleDiff > 180 ? 360 - angleDiff : angleDiff) < 45;
          
          let etaMinutes = Infinity;
          if (isApproaching && velocity > 10) {
            etaMinutes = (distanceToUser / velocity) / 60;
            if (etaMinutes < minETA) minETA = etaMinutes;
            anyApproaching = true;
          }

          const isSuspect = !COMMERCIAL_RE.test(callsign) && (WATCH_RE.test(callsign) || icao24.startsWith('34') || (altitude < 1500 && velocity < 80));

          return {
            icao24, callsign: callsign || 'N/A', origin_country: s[2] || '',
            lat, lon, altitude, velocity, track,
            isSuspect, distanceToUser, etaMinutes, isApproaching
          };
        }).filter((a): a is Aircraft => a !== null);

        setAllAircrafts(enriched);
        setLastFetchTime(Date.now());
        return { count: enriched.length, minETA, anyApproaching };
      } catch (err) { return { count: 0, minETA: Infinity, anyApproaching: false }; }
      finally { setLoading(false); }
    };

    let timeoutId: NodeJS.Timeout;
    let isActive = true;

    const runLoop = async () => {
      if (!isActive) return;
      const { count, minETA, anyApproaching } = await fetchAircrafts();
      if (!isActive) return;

      let interval = FETCH_INTERVAL_NORMAL;

      // LÓGICA DINÁMICA DE INTERVALO
      if (count > 0) {
        if (minETA < 3 || anyApproaching && minETA < 5) {
          interval = FETCH_INTERVAL_FAST; // Amenaza inminente -> 30s
          logger.info('usePegasus', `Intervalo Rápido (30s): Avión sospechoso llegando en ${minETA.toFixed(1)} min`);
        } else if (minETA > 10 && !anyApproaching) {
          interval = FETCH_INTERVAL_SAVE; // Todo tranquilo -> 5 min
          logger.info('usePegasus', `Intervalo de Ahorro (5 min): Sin amenazas próximas`);
        }
      } else {
        interval = FETCH_INTERVAL_NORMAL; // 60s si no hay datos
      }

      setNextInterval(interval);
      timeoutId = setTimeout(runLoop, interval);
    };

    runLoop();
    return () => { isActive = false; clearTimeout(timeoutId); };
  }, [isEnabled, userPos ? buildBboxKey(userPos) : '']);

  const aircrafts = useMemo(() => {
    // Sospechosos: DGT/Pegasus usualmente vuelan bajo y lento
    return allAircrafts.filter(a => a.isSuspect && a.altitude > 100 && a.altitude < 3000 && a.velocity < 100 && a.distanceToUser < 50000);
  }, [allAircrafts]);

  const isAnyPegasusNearby = useMemo(() => aircrafts.some(a => a.distanceToUser < 15000), [aircrafts]);
  const visibleAircrafts = useMemo(() => allAircrafts.filter(a => a.distanceToUser <= 150000), [allAircrafts]);

  return { allAircrafts, aircrafts, visibleAircrafts, totalCount: visibleAircrafts.length, isAnyPegasusNearby, loading, isRateLimited, lastFetchTime, activeAccount, nextInterval };
}
