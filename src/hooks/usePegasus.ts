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
  distanceToUser: number;  // metros
  last_contact  : number;  // timestamp (s)
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


// Variables de entorno cargadas desde config global (para posible debug futuro)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export function usePegasus(
  userPos          : [number, number] | null,
  isEnabled        : boolean = false,
  routeCoordinates?: [number, number][],
  isDebugMode      : boolean = false
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
        setIsRateLimited(false);
        if (userPosRef.current) {
          const bboxKey = buildBboxKey(userPosRef.current);
          // FIX C6: Await + try/catch en la llamada de limpieza
          supabase.from('opensky_requests').delete().eq('bbox_key', bboxKey)
            .then(({ error }) => { if (error) logger.warn('usePegasus', 'Error limpiando opensky_requests', error.message); });
        }
      }
      return;
    }

    const fetchAircrafts = async (): Promise<number> => {
      const pos = userPosRef.current;
      if (!pos) return 0;

      setLoading(true);
      setIsRateLimited(false);

      try {
        const sLamin = snapDown(pos[0]);
        const sLomin = snapDown(pos[1]);
        const sLamax = sLamin + SNAP_SIZE;
        const sLomax = sLomin + SNAP_SIZE;
        const bboxKey = `${sLamin.toFixed(1)}_${sLomin.toFixed(1)}_${sLamax.toFixed(1)}_${sLomax.toFixed(1)}`;

        logger.info('usePegasus', `Macro-Zona (4.0°): ${bboxKey}`);
        
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

        // 3. Pedir al servidor (AHORA DIRECTO A LA TABLA PARA EVITAR 404)
        const { data: cached, error } = await supabase
          .from('opensky_cache')
          .select('states, ts, rate_limited, account_index')
          .eq('bbox_key', bboxKey)
          .single();

        if (error) {
          return 0;
        }

        if (!cached) return 0;

        setIsRateLimited(cached.rate_limited ?? false);
        if (cached.account_index && cached.account_index !== -1) {
          setActiveAccount(cached.account_index);
        }

        const rawStates: any[] = cached.states ?? [];
        
        // 4. Enriquecimiento de datos (El "cerebro" ahora está aquí)
        const AIRPORTS = [
          [40.4936, -3.5668], [41.2971, 2.0785], [37.4274, -5.8931],
          [36.6749, -4.4990], [39.5526, 2.7388], [28.4527, -13.8655],
          [27.9319, -15.3866],[28.0445, -16.5725],[28.4827, -16.3415],
          [38.8722,  1.3731], [43.3011, -8.3777], [43.3565, -5.8603],
          [43.3010, -1.7921], [43.3011, -3.8257], [39.4926, -0.4815],
          [38.1814, -1.0014], [38.2816, -0.5582], [36.7878, -2.3696],
        ];

        const COMMERCIAL_RE = /^(EAX|IBE|RYR|VLG|EZY|AFR|DLH|KLM|BAW)/i;
        const WATCH_RE = /DGT|PESG|SAER|POLIC|GUARDIA|GC|POL/i;

        const haversine = (p1: [number, number], p2: [number, number]) => {
          const R = 6371000;
          const dLat = (p2[0] - p1[0]) * Math.PI / 180;
          const dLon = (p2[1] - p1[1]) * Math.PI / 180;
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1[0] * Math.PI/180) * Math.cos(p2[0] * Math.PI/180) * Math.sin(dLon / 2) ** 2;
          return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };

        const enriched: Aircraft[] = rawStates.map(s => {
          const lat = s[6], lon = s[5];
          if (lat == null || lon == null || s[8] === true) return null;

          const callsign = (s[1] || '').trim();
          const altitude = s[7] ?? s[13] ?? 0;
          const velocity = s[9] ?? 0;
          const icao24 = s[0] || '';

          const isCommercial = COMMERCIAL_RE.test(callsign);
          const hasWatchPattern = WATCH_RE.test(callsign);
          const isDGT = icao24.startsWith('34');
          const isLow = altitude < 1000;
          const isSlow = velocity < 60;
          const nearApt = AIRPORTS.some(ap => haversine([lat, lon], [ap[0] as number, ap[1] as number]) < 5000);

          const isSuspect = !isCommercial && (hasWatchPattern || isDGT || ((isLow && isSlow) && !nearApt));
          const distanceToUser = haversine([pos[0], pos[1]], [lat, lon]);

          return {
            icao24, callsign: callsign || 'N/A', origin_country: s[2] || '',
            lat, lon, altitude, velocity, track: s[10] ?? 0,
            isSuspect, distanceToUser,
            last_contact: s[4] ?? s[3] ?? Math.floor(Date.now() / 1000)
          };
        }).filter((a): a is Aircraft => a !== null);

        logger.info('usePegasus', `Procesados ${enriched.length} aviones para zona ${bboxKey}`);
        setAllAircrafts(enriched);
        setLastFetchTime(Date.now());
        return enriched.length;
      } catch (error) {
        logger.error('usePegasus', 'Error al obtener aviones', error);
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

  const aircrafts = useMemo(() => {
    return allAircrafts.filter(a => {
      // Si estamos en debug, saltamos los filtros cinéticos y sospechosos
      if (isDebugMode) {
        // En debug, limitamos distancia igualmente para evitar crashear el mapa con 5000 aviones
        return a.distanceToUser <= 100000; 
      }

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
  }, [allAircrafts, isDebugMode]);

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
    // totalCount muestra TODOS los aviones detectados en la macro-zona,
    // no solo los del radio de 25km que se pintan en el mapa.
    // Así el usuario ve "91 aviones en zona" aunque ninguno esté cerca.
    totalCount       : allAircrafts.length,
    isAnyPegasusNearby,
    loading,
    isRateLimited,
    lastFetchTime,
    activeAccount,
  };
}
