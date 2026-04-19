import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export interface Radar {
  id: number; lat: number; lon: number;
  type: 'fixed' | 'mobile' | 'section' | 'traffic_light' | 'community_mobile';
  speedLimit?: number; direction?: number; road?: string; pk?: string;
  confirmations?: number; rejections?: number; is_visible?: boolean;
  category?: string; user_id?: string;
}

export interface RadarZone {
  id: number; lat: number; lon: number; radius: number; confidence: number;
}

const getDist = (p1: [number, number], p2: [number, number]) => {
  const R = 6371e3;
  const dLat = (p2[0] - p1[0]) * Math.PI / 180;
  const dLon = (p2[1] - p1[1]) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
};

export function useRadars(userPos: [number, number] | null, routeCoordinates?: [number, number][], isEnabled: boolean = false) {
  const [radars, setRadars] = useState<Radar[]>([]);
  const [radarZones, setRadarZones] = useState<RadarZone[]>([]);
  const [loadingRadars, setLoadingRadars] = useState(false);
  const [progress, setProgress] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const lastFetchRef = useRef<{pos: [number, number], routeKey: string} | null>(null);

  const routeLength = routeCoordinates?.length ?? 0;
  const routeFirstKey = routeCoordinates?.[0] ? `${routeCoordinates[0][0].toFixed(4)},${routeCoordinates[0][1].toFixed(4)}` : '';
  const routeLastKey = routeLength > 0 ? `${routeCoordinates![routeLength-1][0].toFixed(4)},${routeCoordinates![routeLength-1][1].toFixed(4)}` : '';

  useEffect(() => {
    if (!isEnabled || !userPos) {
      if (!isEnabled && (radars.length > 0 || radarZones.length > 0)) {
        setRadars([]);
        setRadarZones([]);
      }
      return;
    }

    const hasRoute = routeLength > 0;
    const currentRouteKey = `${routeFirstKey}|${routeLastKey}`;

    let shouldFetch = false;
    if (!lastFetchRef.current || lastFetchRef.current.routeKey !== currentRouteKey) {
      shouldFetch = true;
    } else if (!hasRoute && getDist(lastFetchRef.current.pos, userPos) > 5000) {
      shouldFetch = true;
    }

    if (!shouldFetch && refreshTrigger === 0) return;

    const fetchAllRadars = async () => {
      setLoadingRadars(true);
      const accumulated: Radar[] = [];
      const uniqueIds = new Set<number>();

      try {
        logger.groupCollapsed('📡 useRadars', `Iniciando búsqueda (${hasRoute ? 'Modo Ruta' : 'Modo Local'})`);
        logger.time('⏱️ Fetch Radares');

        if (hasRoute && routeCoordinates) {
          // Dividir por DISTANCIA (50km) no por puntos
          const chunks: [number, number][][] = [];
          let currentChunk: [number, number][] = [routeCoordinates[0]];
          let currentDist = 0;

          for (let i = 1; i < routeCoordinates.length; i++) {
            const d = getDist(routeCoordinates[i-1], routeCoordinates[i]);
            currentDist += d;
            currentChunk.push(routeCoordinates[i]);
            if (currentDist >= 50000) {
              chunks.push(currentChunk);
              currentChunk = [routeCoordinates[i]];
              currentDist = 0;
            }
          }
          if (currentChunk.length > 1) chunks.push(currentChunk);

          for (let i = 0; i < chunks.length; i++) {
            const wkt = `LINESTRING(${chunks[i].map(pt => `${pt[1]} ${pt[0]}`).join(', ')})`;
            const { data } = await supabase.rpc('get_radars_in_route', { p_route_wkt: wkt, p_buffer_meters: 500 });
            if (data) {
              (data as any[]).forEach(r => {
                if (!uniqueIds.has(r.id)) {
                  uniqueIds.add(r.id);
                  accumulated.push({
                    id: r.id, lat: r.lat, lon: r.lon, type: r.radar_type || 'fixed',
                    speedLimit: r.speed_limit, direction: r.direction, road: r.road
                  });
                }
              });
              setRadars([...accumulated]);
            }
            setProgress(Math.round(((i + 1) / chunks.length) * 100));
          }
        } else {
          const { data: fixed } = await supabase.rpc('get_radars_nearby', { p_lat: userPos[0], p_lon: userPos[1], p_radius_meters: 20000 });
          const { data: comm } = await supabase.rpc('get_community_radars_nearby', { p_lat: userPos[0], p_lon: userPos[1], p_radius_meters: 20000 });
          if (fixed) (fixed as any[]).forEach(r => accumulated.push({ id: r.id, lat: r.lat, lon: r.lon, type: r.radar_type || 'fixed', speedLimit: r.speed_limit }));
          if (comm) (comm as any[]).forEach(r => accumulated.push({ id: r.id, lat: r.lat, lon: r.lon, type: 'community_mobile', confirmations: r.confirmations }));
          setRadars(accumulated);
        }

        const { data: zones } = await supabase.from('radar_zones').select('*').limit(100);
        if (zones) setRadarZones((zones as any[]).map(z => ({ id: z.id, lat: z.lat, lon: z.lon, radius: z.radius || 500, confidence: z.confidence || 0.5 })));

        logger.timeEnd('⏱️ Fetch Radares');
        logger.group('📊 Resumen de Radares');
        logger.table({ 'Total': accumulated.length, 'Fijos': accumulated.filter(r => r.type !== 'community_mobile').length });
        logger.groupEnd(); logger.groupEnd();

        lastFetchRef.current = { pos: userPos, routeKey: currentRouteKey };
        setRefreshTrigger(0);
      } catch (err) {
        logger.error('useRadars', 'Error radares', err);
      } finally {
        setLoadingRadars(false);
        setProgress(100);
      }
    };
    fetchAllRadars();
  }, [userPos?.[0], userPos?.[1], isEnabled, routeLength, routeFirstKey, routeLastKey, refreshTrigger]);

  return { radars, radarZones, loadingRadars, progress, refreshRadars: () => setRefreshTrigger(prev => prev + 1) };
}
