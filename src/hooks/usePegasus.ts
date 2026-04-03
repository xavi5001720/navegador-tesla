'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';

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
  distanceToUser: number;  // metros
}

// -- Helper parameters must match the edge function snap size
const SNAP_SIZE = 4.0;
function snapDown(v: number): number { return Math.floor(v / SNAP_SIZE) * SNAP_SIZE; }
function snapUp  (v: number): number { return Math.ceil (v / SNAP_SIZE) * SNAP_SIZE; }

// ── Bbox centrado en el usuario (Macro-Zona de 4x4°) ─────────────────────────
function getBbox(userPos: [number, number]) {
  const sLamin = snapDown(userPos[0]);
  const sLomin = snapDown(userPos[1]);
  const upLat  = Math.ceil(userPos[0] / SNAP_SIZE) * SNAP_SIZE;
  const upLon  = Math.ceil(userPos[1] / SNAP_SIZE) * SNAP_SIZE;
  const sLamaxVal = upLat === sLamin ? sLamin + SNAP_SIZE : upLat;
  const sLomaxVal = upLon === sLomin ? sLomin + SNAP_SIZE : upLon;
  const key = `${sLamin.toFixed(1)}_${sLomin.toFixed(1)}_${sLamaxVal.toFixed(1)}_${sLomaxVal.toFixed(1)}`;
  return { lamin: sLamin, lomin: sLomin, lamax: sLamaxVal, lomax: sLomaxVal, key };
}

function buildBboxKey(userPos: [number, number]): string {
  return getBbox(userPos).key;
}

// Señal de "estoy vivo" al feeder — cada 60s es suficiente
const SIGNAL_INTERVAL_MS = 60_000;
// Fallback: si Realtime cae, hacemos una consulta manual cada 15s
const FALLBACK_INTERVAL_MS = 15_000;


// ─────────────────────────────────────────────────────────────────────────────
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

  const routeRef   = useRef(routeCoordinates);
  useEffect(() => { routeRef.current = routeCoordinates; }, [routeCoordinates]);

  const userPosRef = useRef(userPos);
  useEffect(() => { userPosRef.current = userPos; }, [userPos]);

  // ── Función central: llama a la Edge Function y actualiza el UI ─────────────
  const fetchAndUpdate = async () => {
    const pos = userPosRef.current;
    if (!pos) return;
    setLoading(true);
    try {
      const bbox = getBbox(pos);
      const { data, error } = await supabase.functions.invoke('pegasus', {
        body: {
          lamin: bbox.lamin,
          lomin: bbox.lomin,
          lamax: bbox.lamax,
          lomax: bbox.lomax,
          ulat: pos[0],
          ulon: pos[1]
        }
      });

      if (error) throw new Error(error.message);

      setIsRateLimited(data?.rateLimited ?? false);
      if (data?.accountIndex && data.accountIndex !== -1) {
        setActiveAccount(data.accountIndex);
      }

      const states: Aircraft[] = data?.states ?? [];
      console.log(`[usePegasus] 🆕 Datos frescos del feeder | ${states.length} aeronaves`);
      setAllAircrafts(states);
      setLastFetchTime(Date.now());

    } catch (err) {
      console.error('[usePegasus] ❌ Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Señal periódica al feeder (independiente del Realtime) ─────────────────
  const sendSignal = async () => {
    const pos = userPosRef.current;
    if (!pos || !isEnabled) return;
    const bboxKey = buildBboxKey(pos);
    await supabase.from('opensky_requests').upsert({
      bbox_key: bboxKey,
      last_requested_at: Date.now(),
      updated_at: new Date().toISOString(),
      ulat: pos[0],
      ulon: pos[1],
    });
    console.log(`[usePegasus] 📡 Señal enviada a casa: ${bboxKey}`);
  };

  // ── Efecto principal: Realtime + señal periódica ───────────────────────────
  useEffect(() => {
    if (!isEnabled || !userPos) {
      if (!isEnabled) {
        setAllAircrafts([]);
        if (userPosRef.current) {
          const bboxKey = buildBboxKey(userPosRef.current);
          supabase.from('opensky_requests').delete().eq('bbox_key', bboxKey).then(() => {});
        }
      }
      return;
    }

    const bboxKey = buildBboxKey(userPos);

    // 1. Fetch inicial inmediato
    sendSignal();
    fetchAndUpdate();

    // 2. Suscripción Realtime a opensky_cache para esta zona
    //    Cuando el feeder sube datos nuevos, Supabase avisa por WebSocket → UI se actualiza
    const channel = supabase
      .channel(`pegasus-cache-${bboxKey}`)
      .on(
        'postgres_changes',
        {
          event: '*',               // INSERT o UPDATE
          schema: 'public',
          table: 'opensky_cache',
          filter: `bbox_key=eq.${bboxKey}`,
        },
        (payload) => {
          console.log(`[usePegasus] 🔔 Realtime: feeder actualizó ${bboxKey}`);
          fetchAndUpdate(); // datos nuevos → llamada a la Edge Function
        }
      )
      .subscribe((status) => {
        console.log(`[usePegasus] 📶 Realtime ${bboxKey}: ${status}`);
      });

    // 3. Señal de "alive" cada 60s para que el feeder no expire la zona
    const signalInterval = setInterval(sendSignal, SIGNAL_INTERVAL_MS);

    // 4. Fallback: si Realtime cae, consultamos igualmente cada 5 min
    const fallbackInterval = setInterval(fetchAndUpdate, FALLBACK_INTERVAL_MS);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(signalInterval);
      clearInterval(fallbackInterval);
    };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnabled, !!userPos]);

  // ── Filtros locales ──────────────────────────────────────────────────────────
  const aircrafts = useMemo(() => {
    const hasRoute = (routeCoordinates?.length ?? 0) > 0;
    return allAircrafts.filter(a => {
      if (!a.isSuspect)        return false;
      if (a.altitude < 100 || a.altitude > 2_000) return false;
      if (a.velocity > 83.33)  return false;
      if (hasRoute && a.distanceToUser > 50_000) return false;
      return true;
    });
  }, [allAircrafts, routeCoordinates]);

  const isAnyPegasusNearby = useMemo(
    () => aircrafts.some(a => a.distanceToUser < 10_000),
    [aircrafts]
  );

  return {
    allAircrafts,
    aircrafts,
    totalCount       : allAircrafts.length,
    isAnyPegasusNearby,
    loading,
    isRateLimited,
    lastFetchTime,
    activeAccount,
  };

}
