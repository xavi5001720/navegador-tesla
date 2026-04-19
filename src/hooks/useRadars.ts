import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export interface Radar {
  id: number;
  lat: number;
  lon: number;
  type: 'fixed' | 'mobile' | 'section' | 'traffic_light' | 'community_mobile';
  speedLimit?: number;
  direction?: number;
  road?: string;
  pk?: string;
  confirmations?: number;
  rejections?: number;
  is_visible?: boolean;
  category?: string;
  user_id?: string;
}

export interface RadarZone {
  id: number;
  lat: number;
  lon: number;
  radius: number;
  confidence: number;
}

export function useRadars(userPos: [number, number] | null, routeCoordinates?: [number, number][], isEnabled: boolean = false) {
  const [radars, setRadars] = useState<Radar[]>([]);
  const [radarZones, setRadarZones] = useState<RadarZone[]>([]);
  const [loadingRadars, setLoadingRadars] = useState(false);
  const [fetchingRouteRadars, setFetchingRouteRadars] = useState(false);
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
    if (!lastFetchRef.current) {
      shouldFetch = true;
    } else if (hasRoute && lastFetchRef.current.routeKey !== currentRouteKey) {
      shouldFetch = true;
    } else if (!hasRoute) {
      const dist = Math.sqrt(
        Math.pow(userPos[0] - lastFetchRef.current.pos[0], 2) +
        Math.pow(userPos[1] - lastFetchRef.current.pos[1], 2)
      );
      if (dist > 0.05) shouldFetch = true; 
    }

    if (!shouldFetch && refreshTrigger === 0) return;

    const fetchAllRadars = async () => {
      setLoadingRadars(true);
      if (hasRoute) setFetchingRouteRadars(true);
      
      const accumulatedRadars: Radar[] = [];
      const uniqueRadarIds = new Set<number>();

      try {
        logger.groupCollapsed('📡 useRadars', `Iniciando búsqueda (${hasRoute ? 'Modo Ruta' : 'Modo Local'})`);
        logger.time('⏱️ Fetch Radares');

        if (hasRoute && routeCoordinates) {
          const chunks: [number, number][][] = [];
          for (let i = 0; i < routeCoordinates.length; i += 100) {
            chunks.push(routeCoordinates.slice(i, i + 105));
          }

          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const wktPoints = chunk.map(pt => `${pt[1]} ${pt[0]}`).join(', ');
            const routeWkt = `LINESTRING(${wktPoints})`;

            const { data, error } = await supabase.rpc('get_radars_in_route', {
              p_route_wkt: routeWkt,
              p_buffer_meters: 500
            });

            if (error) {
              logger.error('useRadars', `Error en tramo ${i}`, error);
              continue;
            }

            if (data) {
              (data as any[]).forEach((r) => {
                if (!uniqueRadarIds.has(r.id)) {
                  uniqueRadarIds.add(r.id);
                  accumulatedRadars.push({
                    id: r.id, lat: r.lat, lon: r.lon,
                    type: r.radar_type || 'fixed',
                    speedLimit: r.speed_limit,
                    direction: r.direction, road: r.road, pk: r.pk
                  });
                }
              });
            }
            
            setRadars([...accumulatedRadars]);
            setProgress(Math.round(((i + 1) / chunks.length) * 100));
          }
        } else {
          // MODO LOCAL
          const { data: fixedData } = await supabase.rpc('get_radars_nearby', {
            p_lat: userPos[0], p_lon: userPos[1], p_radius_meters: 20000
          });
          const { data: commData } = await supabase.rpc('get_community_radars_nearby', {
            p_lat: userPos[0], p_lon: userPos[1], p_radius_meters: 20000
          });

          if (fixedData) {
            (fixedData as any[]).forEach(r => {
              accumulatedRadars.push({
                id: r.id, lat: r.lat, lon: r.lon, type: r.radar_type || 'fixed',
                speedLimit: r.speed_limit, direction: r.direction, road: r.road
              });
            });
          }
          if (commData) {
            (commData as any[]).forEach(r => {
              accumulatedRadars.push({
                id: r.id, lat: r.lat, lon: r.lon, type: 'community_mobile',
                confirmations: r.confirmations, category: r.category
              });
            });
          }
          setRadars(accumulatedRadars);
        }

        // Zonas Móviles
        const { data: zonesData } = await supabase.from('radar_zones').select('*').limit(100);
        let finalZones: RadarZone[] = [];
        if (zonesData) {
          finalZones = (zonesData as any[]).map(z => ({
            id: z.id, lat: z.lat || 0, lon: z.lon || 0, radius: z.radius || 500, confidence: z.confidence || 0.5
          })).filter(z => z.lat !== 0);
          setRadarZones(finalZones);
        }

        logger.timeEnd('⏱️ Fetch Radares');
        logger.group('📊 Resumen de Radares');
        logger.table({
          'Total Radares': accumulatedRadars.length,
          'Fijos': accumulatedRadars.filter(r => r.type !== 'community_mobile').length,
          'Comunitarios': accumulatedRadars.filter(r => r.type === 'community_mobile').length,
          'Zonas Móviles': finalZones.length
        });
        logger.groupEnd();
        logger.groupEnd();

        lastFetchRef.current = { pos: userPos, routeKey: currentRouteKey };
        setRefreshTrigger(0);
      } catch (error) {
        logger.error('useRadars', 'Error fatal en carga de radares', error);
      } finally {
        setLoadingRadars(false);
        setFetchingRouteRadars(false);
        setProgress(100);
      }
    };

    fetchAllRadars();
  }, [userPos?.[0], userPos?.[1], isEnabled, routeLength, routeFirstKey, routeLastKey, refreshTrigger]);

  return { radars, radarZones, loadingRadars, fetchingRouteRadars, progress, refreshRadars: () => setRefreshTrigger(prev => prev + 1) };
}
