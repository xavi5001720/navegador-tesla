import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface Radar {
  id: number;
  lat: number;
  lon: number;
  type: 'fixed' | 'mobile' | 'traffic_signals' | 'unknown';
  speedLimit?: number;
}

const CHUNK_DISTANCE_M = 50000; // 50 km per chunk

export function useRadars(userPos: [number, number] | null, routeCoordinates?: [number, number][], isEnabled: boolean = false) {
  const [radars, setRadars] = useState<Radar[]>([]);
  const [loadingRadars, setLoadingRadars] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const [fetchingRouteRadars, setFetchingRouteRadars] = useState(false);
  const lastFetchRef = useRef<{ type: 'route'|'local', pos: [number, number], routeLength: number } | null>(null);

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
      if (dist > 5000) shouldFetch = true; // Solo buscar si se ha movido 5km en modo libre
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
          console.log(`[useRadars] Iniciando carga de ${chunks.length} tramos (50km cada uno)...`);
          
          const uniqueRadarIds = new Set<number>();
          const accumulatedRadars: Radar[] = [];

          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            // Convertimos el tramo a WKT
            const wktPoints = chunk.map(pt => `${pt[1]} ${pt[0]}`).join(', ');
            const routeWkt = `LINESTRING(${wktPoints})`;

            const { data, error } = await supabase.rpc('get_radars_in_route', {
              route_wkt: routeWkt,
              buffer_meters: 100 // Usamos 100m para rutas largas para mayor seguridad
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
                    speedLimit: r.speed_limit || undefined
                  });
                }
              });
              // Actualizamos el estado de forma incremental para que se vayan dibujando
              setRadars([...accumulatedRadars]);
            }
            
            // Actualizamos progreso
            setProgress(Math.round(((i + 1) / chunks.length) * 100));
          }
        } else {
          // MODO LOCAL: Búsqueda circular de 15km (Solo 1 petición)
          console.log(`[useRadars] Consultando radares cercanos via Supabase RPC...`);
          const { data, error } = await supabase.rpc('get_radars_nearby', {
            lat: userPos[0],
            lon: userPos[1],
            radius_meters: 15000
          });

          if (error) throw error;
          const mappedRadars: Radar[] = (data || []).map((r: any) => ({
            id: r.id,
            lat: r.lat,
            lon: r.lon,
            type: r.radar_type || 'fixed',
            speedLimit: r.speed_limit || undefined
          }));
          setRadars(mappedRadars);
        }

        lastFetchRef.current = {
          type: currentType,
          pos: userPos,
          routeLength: routeLength
        };
        
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
  }, [isEnabled, userPos?.[0], userPos?.[1], routeLength, routeFirstLat, routeFirstLon, routeLastLat, routeLastLon]);

  return { radars, loadingRadars, fetchingRouteRadars, lastUpdate, progress };
}
