'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';

// ── Tipos ─────────────────────────────────────────────────────────────────────
// Ahora los campos vienen ya procesados del backend (isSuspect, distanceToUser…)
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

// ── Bbox centrado en el usuario (~25 km de margen = 0.22°) ───────────────────
// El backend alinea internamente estas coordenadas a una cuadrícula de 0.5°,
// por lo que usuarios próximos comparten la misma caché.
function buildBboxParams(userPos: [number, number], ulat: number, ulon: number): string {
  const MARGIN = 0.22; // ≈ 25 km por lado
  const lamin  = (userPos[0] - MARGIN).toFixed(4);
  const lomin  = (userPos[1] - MARGIN).toFixed(4);
  const lamax  = (userPos[0] + MARGIN).toFixed(4);
  const lomax  = (userPos[1] + MARGIN).toFixed(4);
  // ulat/ulon permiten que el backend precalcule distanceToUser
  return `lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}&ulat=${ulat}&ulon=${ulon}`;
}

// Reducimos el intervalo a 60s. Es seguro porque rotamos cuentas y el feeder de casa ayuda.
const FETCH_INTERVAL_MS = 60_000;


// ─────────────────────────────────────────────────────────────────────────────
export function usePegasus(
  userPos          : [number, number] | null,
  isEnabled        : boolean = false,
  routeCoordinates?: [number, number][]
) {
  // El backend ya devuelve objetos Aircraft listos — guardamos directamente
  const [allAircrafts, setAllAircrafts] = useState<Aircraft[]>([]);
  const [loading,      setLoading     ] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [activeAccount, setActiveAccount] = useState<number>(1);
  // Timestamp del último batch real recibido — consume el simulador para saber cuándo aplicar corrección
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);


  const routeRef  = useRef(routeCoordinates);
  useEffect(() => { routeRef.current = routeCoordinates; }, [routeCoordinates]);

  // Ref a la última posición del usuario para no recrear el intervalo ante cada GPS update
  const userPosRef = useRef(userPos);
  useEffect(() => { userPosRef.current = userPos; }, [userPos]);

  useEffect(() => {
    if (!isEnabled || !userPos) {
      if (!isEnabled) setAllAircrafts([]);
      return;
    }

    const fetchAircrafts = async (): Promise<void> => {
      const pos = userPosRef.current;
      if (!pos) return;

      setLoading(true);
      try {
        const bboxKey = `${parseFloat((pos[0] - 0.22).toFixed(1))}_${parseFloat((pos[1] - 0.22).toFixed(1))}_${parseFloat((pos[0] + 0.22).toFixed(1))}_${parseFloat((pos[1] + 0.22).toFixed(1))}`;
        
        console.log(`[usePegasus] 📡 Intentando avisar a casa para la zona: ${bboxKey}`);
        
        const signalRes = await supabase.from('opensky_requests').upsert({
          bbox_key: bboxKey,
          last_requested_at: Date.now(),
          updated_at: new Date().toISOString()
        });

        if (signalRes.error) {
          console.error('[usePegasus] ❌ Error enviando señal a Supabase:', signalRes.error);
        } else {
          console.log('[usePegasus] ✅ Señal enviada con éxito.');
        }

        // --- 1. Llamar a la función Pegasus ---
        const { data, error } = await supabase.functions.invoke('pegasus', {
          body: {
            lamin: parseFloat((pos[0] - 0.22).toFixed(4)),
            lomin: parseFloat((pos[1] - 0.22).toFixed(4)),
            lamax: parseFloat((pos[0] + 0.22).toFixed(4)),
            lomax: parseFloat((pos[1] + 0.22).toFixed(4)),
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
        console.log(`[usePegasus] ✅ ${states.length} aeronaves | account=${data?.accountIndex} | snapped bbox: ${JSON.stringify(data?.snappedBbox)}`);
        setAllAircrafts(states);
        setLastFetchTime(Date.now());


      } catch (error) {
        console.error('[usePegasus] ❌ Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAircrafts();
    const interval = setInterval(fetchAircrafts, FETCH_INTERVAL_MS);
    return () => clearInterval(interval);

  // Solo recreamos el efecto al activar/desactivar, no ante cada movimiento GPS
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnabled, !!userPos]);

  // ── Filtros locales simples (no requieren recalcular nada pesado) ──────────
  const aircrafts = useMemo(() => {
    const hasRoute = (routeCoordinates?.length ?? 0) > 0;
    return allAircrafts.filter(a => {
      // Sospechosas dentro del rango útil de alerta
      if (!a.isSuspect)        return false;
      if (a.altitude < 100 || a.altitude > 2_000) return false;
      if (a.velocity > 83.33)  return false;
      // Con ruta activa, descartamos las que estén muy lejos
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
