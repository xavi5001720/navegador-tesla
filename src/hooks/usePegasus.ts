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
function buildBboxKey(userPos: [number, number]): string {
  const sLamin = snapDown(userPos[0]);
  const sLomin = snapDown(userPos[1]);
  const sLamax = sLamin + SNAP_SIZE;
  const sLomax = sLomin + SNAP_SIZE;
  return `${sLamin.toFixed(1)}_${sLomin.toFixed(1)}_${sLamax.toFixed(1)}_${sLomax.toFixed(1)}`;
}

// Intervalo de consulta periódica (60s) — Este es el modo estable que funcionaba ayer
const FETCH_INTERVAL_MS = 60_000;


// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';

// Llaves maestras forzadas para evitar errores de caché
const SUPABASE_URL = 'https://uhvwptagewswfiluqgmc.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVodndwdGFnZXdzd2ZpbHVxZ21jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MDI4NTEsImV4cCI6MjA5MDM3ODg1MX0.LEygUxMX0zzrkRVv8MJivhPDmy6yp2KIlaU3oICjyAk';

const localSupabase = createClient(SUPABASE_URL, ANON_KEY);

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
        const sLamin = snapDown(pos[0]);
        const sLomin = snapDown(pos[1]);
        const sLamax = sLamin + SNAP_SIZE;
        const sLomax = sLomin + SNAP_SIZE;
        const bboxKey = `${sLamin.toFixed(1)}_${sLomin.toFixed(1)}_${sLamax.toFixed(1)}_${sLomax.toFixed(1)}`;

        console.log(`[usePegasus V11] 📡 Macro-Zona (4.0°): ${bboxKey}`);
        
        // 1. Avisar al feeder (Macro-Zona)
        await supabase.from('opensky_requests').upsert({
          bbox_key: bboxKey,
          last_requested_at: Date.now(),
          updated_at: new Date().toISOString(),
          ulat: pos[0],
          ulon: pos[1]
        });

        // 2. Pedir al servidor con FETCH estándar (V10+) para evitar problemas de cabeceras
        const response = await fetch(`${SUPABASE_URL}/functions/v1/pegasus`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': ANON_KEY,
            'Authorization': `Bearer ${ANON_KEY}`
          },
          body: JSON.stringify({
            lamin: sLamin,
            lomin: sLomin,
            lamax: sLamax,
            lomax: sLomax,
            ulat: pos[0],
            ulon: pos[1]
          })
        });

        if (!response.ok) {
          console.error(`[usePegasus] Error HTTP ${response.status}:`, await response.text());
          throw new Error(`Edge Function returned ${response.status}`);
        }

        const data = await response.json();

        setIsRateLimited(data?.rateLimited ?? false);
        if (data?.accountIndex && data.accountIndex !== -1) {
          setActiveAccount(data.accountIndex);
        }

        const states: Aircraft[] = data?.states ?? [];
        console.log(`[usePegasus V10] ✅ RECIBIDOS ${states.length} AVIONES para zona ${bboxKey}`);
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

  // ── Filtros locales (V11 Restaurada) ──────────────────────────────────────────
  const aircrafts = useMemo(() => {
    return allAircrafts.filter(a => {
      // 1. Debe ser sospechoso (DGT, Policía, bajo/lento no-comercial)
      if (!a.isSuspect) return false;

      // 2. Rango de altitud alerta (100m - 2000m)
      if (a.altitude < 100 || a.altitude > 2000) return false;

      // 3. Velocidad máxima alerta (300 km/h = 83.33 m/s)
      if (a.velocity > 83.33) return false;

      // 4. Si hay ruta activa, filtrar por distancia (50km)
      if (routeRef.current && routeRef.current.length > 0) {
        if (a.distanceToUser > 50000) return false;
      }

      return true;
    });
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
