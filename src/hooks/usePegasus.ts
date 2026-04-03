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
const SNAP_SIZE = 0.5;
function snapDown(v: number): number { return Math.floor(v / SNAP_SIZE) * SNAP_SIZE; }
function snapUp  (v: number): number { return Math.ceil (v / SNAP_SIZE) * SNAP_SIZE; }

// ── Bbox centrado en el usuario (Macro-Zona de 4x4°) ─────────────────────────
function buildBboxKey(userPos: [number, number]): string {
  const sLamin = snapDown(userPos[0]);
  const sLomin = snapDown(userPos[1]);
  const upLat  = Math.ceil(userPos[0] / SNAP_SIZE) * SNAP_SIZE;
  const upLon  = Math.ceil(userPos[1] / SNAP_SIZE) * SNAP_SIZE;
  const sLamaxVal = upLat === sLamin ? sLamin + SNAP_SIZE : upLat;
  const sLomaxVal = upLon === sLomin ? sLomin + SNAP_SIZE : upLon;
  return `${sLamin.toFixed(1)}_${sLomin.toFixed(1)}_${sLamaxVal.toFixed(1)}_${sLomaxVal.toFixed(1)}`;
}

// Intervalo de consulta periódica (60s) — Este es el modo estable que funcionaba ayer
const FETCH_INTERVAL_MS = 60_000;


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

  const routeRef  = useRef(routeCoordinates);
  useEffect(() => { routeRef.current = routeCoordinates; }, [routeCoordinates]);

  const userPosRef = useRef(userPos);
  useEffect(() => { userPosRef.current = userPos; }, [userPos]);

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

    const fetchAircrafts = async (): Promise<void> => {
      const pos = userPosRef.current;
      if (!pos) return;

      setLoading(true);
      try {
        const bboxKey = buildBboxKey(pos);
        
        console.log(`[usePegasus] 📡 Avisando a casa para la zona: ${bboxKey}`);
        
        // Enviamos señal de vida al feeder
        await supabase.from('opensky_requests').upsert({
          bbox_key: bboxKey,
          last_requested_at: Date.now(),
          updated_at: new Date().toISOString(),
          ulat: pos[0],
          ulon: pos[1]
        });

        // --- Llamar a la función Pegasus ---
        // Usamos ±0.001 de margen para evitar el bug de celda cero en bordes
        const { data, error } = await supabase.functions.invoke('pegasus', {
          body: {
            lamin: pos[0] - 0.44,
            lomin: pos[1] - 0.44,
            lamax: pos[0] + 0.44,
            lomax: pos[1] + 0.44,
            ulat: pos[0],
            ulon: pos[1]
          }
        });

        if (error) {
          console.error('[usePegasus] Error calling Supabase Edge Function:', error);
          throw new Error(error.message);
        }

        setIsRateLimited(data?.rateLimited ?? false);
        if (data?.accountIndex && data.accountIndex !== -1) {
          setActiveAccount(data.accountIndex);
        }

        const states: Aircraft[] = data?.states ?? [];
        console.log(`[usePegasus] ✅ ${states.length} aeronaves recibidas para zona ${bboxKey}`);
        setAllAircrafts(states);
        setLastFetchTime(Date.now());

      } catch (error) {
        console.error('[usePegasus] ❌ Error:', error);
      } finally {
        setLoading(false);
      }
    };

    const initialBbox = userPos ? buildBboxKey(userPos) : '';
    fetchAircrafts();
    const interval = setInterval(fetchAircrafts, FETCH_INTERVAL_MS);
    return () => clearInterval(interval);

  }, [isEnabled, userPos ? buildBboxKey(userPos) : '']);

  // ── Filtros locales ──────────────────────────────────────────────────────────
  const aircrafts = useMemo(() => {
    // MÁXIMA SIMPLIFICACIÓN: Retornamos todo lo que venga de la base de datos
    return allAircrafts;
  }, [allAircrafts]);

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
