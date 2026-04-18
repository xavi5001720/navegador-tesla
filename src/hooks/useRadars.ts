import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface Radar {
  id: string | number;
  lat: number;
  lon: number;
  type: 'fixed' | 'mobile' | 'traffic_signals' | 'unknown' | 'section' | 'camera' | 'mobile_zone' | 'community_mobile';
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

const CHUNK_DISTANCE_M = 50000; // 50 km per chunk

export function useRadars(
  userPos: [number, number] | null, 
  routeCoordinates?: [number, number][], 
  isEnabled: boolean = true,
  userId?: string | null
) {
  const [radars, setRadars] = useState<Radar[]>([]);
  const [radarZones, setRadarZones] = useState<RadarZone[]>([]);
  const [loadingRadars, setLoadingRadars] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const [fetchingRouteRadars, setFetchingRouteRadars] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const lastFetchRef = useRef<{ type: 'route'|'local', pos: [number, number], routeLength: number, userId?: string | null } | null>(null);

  // Creamos dependencias primitivas estables para detectar cambios reales en la ruta
  const routeLength = routeCoordinates?.length ?? 0;
  const routeFirstLat = routeCoordinates?.[0]?.[0];
  const routeFirstLon = routeCoordinates?.[0]?.[1];
  const routeLastLat = routeCoordinates?.[routeLength - 1]?.[0];
  const routeLastLon = routeCoordinates?.[routeLength - 1]?.[1];

  // Helper para distancia rápida (haversine simplificado)
  const getDist = (p1: [number, number], p2: [number, number]) => {
    const R = 6371e3;
    const dLat = (p2[0] - p1[0]) * Math.PI / 180;
    const dLon = (p2[1] - p1[1]) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
  };

  // Efecto para obtener la fecha de última actualización una sola vez al cargar
  useEffect(() => {
    const fetchLastUpdate = async () => {
      try {
        const { data, error } = await supabase
          .from('radars')
          .select('updated_at')
          .order('updated_at', { ascending: false })
          .limit(1);
        
        if (error) throw error;
        if (data && data.length > 0) {
          setLastUpdate(data[0].updated_at);
        }
      } catch (err) {
        console.error("Error fetching last radar update:", err);
      }
    };
    fetchLastUpdate();
  }, []);

  useEffect(() => {
    if (!isEnabled || !userPos) {
      if (!isEnabled && radars.length > 0) {
        setRadars([]);
      }
      return;
    }

    const hasRoute = routeCoordinates && routeCoordinates.length > 0;
    const currentType = hasRoute ? 'route' : 'local';

    // Lógica para decidir si es necesario un nuevo fetch
    let shouldFetch = false;
    if (!lastFetchRef.current) {
      shouldFetch = true;
    } else if (lastFetchRef.current.type !== currentType) {
      shouldFetch = true;
    } else if (currentType === 'route' && lastFetchRef.current.routeLength !== routeLength) {
      shouldFetch = true;
    } else if (currentType === 'local') {
      const dist = getDist(lastFetchRef.current.pos, userPos);
      if (dist > 25000 || lastFetchRef.current.userId !== userId) shouldFetch = true; // Solo buscar si se ha movido 25km O cambia el usuario
    }
    
    // Si hay un trigger manual, forzamos
    if (refreshTrigger > 0 && lastFetchRef.current?.pos === userPos) {
       shouldFetch = true;
    }

    if (!shouldFetch) return;

    const fetchRadars = async () => {
      setLoadingRadars(true);
      if (hasRoute) {
        setFetchingRouteRadars(true);
        setProgress(0);
        setRadars([]); // Limpiamos para la nueva carga incremental
      }
      
      try {
        if (hasRoute && routeCoordinates) {
          // MODO RUTA (EN CASCADA por tramos de 50km)
          
          // 1. Dividir la ruta en tramos
          const chunks: [number, number][][] = [];
          let currentChunk: [number, number][] = [routeCoordinates[0]];
          let currentDist = 0;

          for (let i = 1; i < routeCoordinates.length; i++) {
            const d = getDist(routeCoordinates[i-1], routeCoordinates[i]);
            currentDist += d;
            currentChunk.push(routeCoordinates[i]);

            if (currentDist >= CHUNK_DISTANCE_M) {
              chunks.push(currentChunk);
              currentChunk = [routeCoordinates[i]];
              currentDist = 0;
            }
          }
          if (currentChunk.length > 1) chunks.push(currentChunk);

          // 2. Cargar cada tramo de forma secuencial
          
          const uniqueRadarIds = new Set<number>();
          const accumulatedRadars: Radar[] = [];

          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const coord = chunk[Math.floor(chunk.length / 2)];
            // Convertimos el tramo a WKT
            const wktPoints = chunk.map(pt => `${pt[1]} ${pt[0]}`).join(', ');
            const routeWkt = `LINESTRING(${wktPoints})`;

            const { data, error } = await supabase.rpc('get_radars_in_route', {
              p_route_wkt: routeWkt,
              p_buffer_meters: 100 // Usamos 100m para rutas largas para mayor seguridad
            });

            if (error) {
              console.error(`[useRadars] Error en tramo ${i}:`, error);
              continue;
            }

            if (data) {
              data.forEach((r: any) => {
                if (!uniqueRadarIds.has(r.id)) {
                  uniqueRadarIds.add(r.id);
                  accumulatedRadars.push({
                    id: r.id,
                    lat: r.lat,
                    lon: r.lon,
                    type: r.radar_type || 'fixed',
                    speedLimit: r.speed_limit || undefined,
                    direction: r.direction,
                    road: r.road,
                    pk: r.pk
                  });
                }
              });
            }

            // TAMBIÉN: Radares Comunitarios en esta zona
            const { data: commData } = await supabase.rpc('get_community_radars_nearby', {
              p_lat: coord[0],
              p_lon: coord[1],
              p_radius_meters: 10000,
              p_viewer_id: userId || null
            });

            if (commData) {
              commData.forEach((r: any) => {
                if (!uniqueRadarIds.has(r.id)) {
                  uniqueRadarIds.add(r.id);
                  accumulatedRadars.push({
                    id: r.id,
                    lat: r.lat,
                    lon: r.lon,
                    type: 'community_mobile',
                     confirmations: r.confirmations,
                    rejections: r.rejections,
                    is_visible: r.is_visible,
                    category: r.category,
                    user_id: r.user_id
                  });
                }
              });
            }

            // Actualizamos el estado de forma incremental
            setRadars([...accumulatedRadars]);
            
            setProgress(Math.round(((i + 1) / chunks.length) * 100));
          }
        } else {
          // MODO LOCAL: Búsqueda circular de 60km
          
          // 1. Radares Fijos/OSM
          const { data: fixedData, error: fixedError } = await supabase.rpc('get_radars_nearby', {
            p_lat: userPos[0],
            p_lon: userPos[1],
            p_radius_meters: 60000
          });

          if (fixedError) throw fixedError;

          // 2. Radares Comunitarios
          const { data: commData, error: commError } = await supabase.rpc('get_community_radars_nearby', {
            p_lat: userPos[0],
            p_lon: userPos[1],
            p_radius_meters: 60000,
            p_viewer_id: userId || null
          });

          if (commError) throw commError;

          const mappedRadars: Radar[] = [];
          
          if (fixedData) {
            fixedData.forEach((r: any) => {
              mappedRadars.push({
                id: r.id,
                lat: r.lat,
                lon: r.lon,
                type: r.radar_type || 'fixed',
                speedLimit: r.speed_limit || undefined,
                direction: r.direction,
                road: r.road,
                pk: r.pk
              });
            });
          }

          if (commData) {
            commData.forEach((r: any) => {
              mappedRadars.push({
                id: r.id,
                lat: r.lat,
                lon: r.lon,
                type: 'community_mobile',
                 confirmations: r.confirmations,
                rejections: r.rejections,
                is_visible: r.is_visible,
                category: r.category,
                user_id: r.user_id
              });
            });
          }

          setRadars(mappedRadars);
        }

        // Cargar Zonas Móviles Históricas (todo España, son ligeras)
        const { data: zonesData, error: zonesError } = await supabase
          .from('radar_zones')
          .select('id, geom, radius, confidence');
          
        if (!zonesError && zonesData) {
          const mappedZones = zonesData.map((z: any) => {
            let lat = 0; let lon = 0;
            if (z.geom && z.geom.coordinates) {
               lon = z.geom.coordinates[0];
               lat = z.geom.coordinates[1];
            } else if (typeof z.geom === 'string' && z.geom.startsWith('POINT')) {
               const match = z.geom.match(/POINT\(([^ ]+) ([^)]+)\)/);
               if (match) { lon = parseFloat(match[1]); lat = parseFloat(match[2]); }
            }
            return {
               id: z.id,
               lat,
               lon,
               radius: z.radius || 500,
               confidence: z.confidence || 0.5
            };
          }).filter(z => z.lat !== 0);
          setRadarZones(mappedZones);
        }

        lastFetchRef.current = {
          type: currentType,
          pos: userPos,
          routeLength: routeLength,
          userId: userId
        };
        setRefreshTrigger(0);
        
      } catch (error) {
        console.error("[useRadars] Erro al obtener radares de Supabase:", error);
      } finally {
        setLoadingRadars(false);
        setFetchingRouteRadars(false);
        setProgress(100);
      }
    };

    fetchRadars();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnabled, userPos?.[0], userPos?.[1], routeLength, routeFirstLat, routeFirstLon, routeLastLat, routeLastLon, userId, refreshTrigger]);

  const refreshRadars = () => setRefreshTrigger(prev => prev + 1);

  return { radars, radarZones, loadingRadars, fetchingRouteRadars, lastUpdate, progress, refreshRadars };
}
