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

  // Ref para controlar el primer fetch tras activar el interruptor
  const isFirstFetchAfterEnable = useRef(true);

  useEffect(() => {
    if (!isEnabled || !userPos) {
      isFirstFetchAfterEnable.current = true; // Reset para la próxima vez
      if (!isEnabled) {
        setAllAircrafts([]);
        setIsRateLimited(false); // Limpiamos errores al apagar
        if (userPosRef.current) {
          const bboxKey = buildBboxKey(userPosRef.current);
          supabase.from('opensky_requests').delete().eq('bbox_key', bboxKey).then(() => {});
        }
      }
      return;
    }

    const fetchAircrafts = async (): Promise<number> => {
      const pos = userPosRef.current;
      if (!pos) return 0;

      setLoading(true);
      // Siempre reseteamos el error al empezar un fetch nuevo
      setIsRateLimited(false);

      try {
        const sLamin = snapDown(pos[0]);
        const sLomin = snapDown(pos[1]);
        const sLamax = sLamin + SNAP_SIZE;
        const sLomax = sLomin + SNAP_SIZE;
        const bboxKey = `${sLamin.toFixed(1)}_${sLomin.toFixed(1)}_${sLamax.toFixed(1)}_${sLomax.toFixed(1)}`;

        console.log(`[usePegasus V12] 📡 Macro-Zona (4.0°): ${bboxKey}`);
        
        // 1. Avisar al feeder (Macro-Zona)
        await supabase.from('opensky_requests').upsert({
          bbox_key: bboxKey,
          last_requested_at: Date.now(),
          updated_at: new Date().toISOString(),
          ulat: pos[0],
          ulon: pos[1]
        });

        // 2. PAUSA TÉCNICA (Solo el primer fetch): 
        // Damos 1.5s al servidor para que el feeder encuentre los aviones antes de preguntar.
        if (isFirstFetchAfterEnable.current) {
          await new Promise(resolve => setTimeout(resolve, 1500));
          isFirstFetchAfterEnable.current = false;
        }

        // 3. Pedir al servidor
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

        return states.length;

      } catch (error) {
        console.error('[usePegasus] ❌ Error:', error);
        return 0;
      } finally {
        setLoading(false);
      }
    };

    let timeoutId: NodeJS.Timeout;
    let isActive = true;
    let startupRetries = 3;

    const runLoop = async () => {
      if (!isActive) return;
      
      const planeCount = await fetchAircrafts();
      
      if (!isActive) return;

      let nextInterval = FETCH_INTERVAL_MS; // 60s
      
      // Fast-retry al arrancar si devuelve 0 (para dar tiempo al Home Feeder)
      if (planeCount === 0 && startupRetries > 0) {
        startupRetries--;
        nextInterval = 10000; // reintenta a los 10 segundos
      } else if (planeCount > 0) {
        startupRetries = 0; // Si ya encontró, pasa al ciclo estable
      }

      timeoutId = setTimeout(runLoop, nextInterval);
    };

    runLoop();

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };

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

      // 4. Si hay ruta activa o estamos en zona libre, filtrar por distancia (25km)
      if (a.distanceToUser > 25000) return false;

      return true;
    });
  }, [allAircrafts]);

  const isAnyPegasusNearby = useMemo(
    () => aircrafts.some(a => a.distanceToUser < 10_000),
    [aircrafts]
  );

  // ── Filtro de visibilidad diferencial (11.6 ESTABLE) ──────────────────────────
  // Todos los aviones: 25km (Reducido de 100km por petición del usuario)
  const visibleAircrafts = useMemo(() => {
    return allAircrafts.filter(a => {
      return a.distanceToUser <= 25000;
    });
  }, [allAircrafts]);

  return {
    allAircrafts,
    aircrafts,
    visibleAircrafts,
    totalCount       : visibleAircrafts.length,
    isAnyPegasusNearby,
    loading,
    isRateLimited,
    lastFetchTime,
    activeAccount,
  };
}
