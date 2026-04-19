import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { cacheService } from '@/lib/db';

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

const getHeading = (p1: [number, number], p2: [number, number]) => {
  const lat1 = p1[0] * Math.PI / 180;
  const lat2 = p2[0] * Math.PI / 180;
  const dLon = (p2[1] - p1[1]) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180 / Math.PI + 360) % 360);
};

export function useRadars(userPos: [number, number] | null, routeCoordinates?: [number, number][], isEnabled: boolean = false) {
  const [radars, setRadars] = useState<Radar[]>([]);
  const [radarZones, setRadarZones] = useState<RadarZone[]>([]);
  const [loadingRadars, setLoadingRadars] = useState(false);
  const [progress, setProgress] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const lastFetchRef = useRef<{pos: [number, number], routeKey: string} | null>(null);
  const fetchedChunksRef = useRef<Set<number>>(new Set());

  const routeLength = routeCoordinates?.length ?? 0;
  const routeFirstKey = routeCoordinates?.[0] ? `${routeCoordinates[0][0].toFixed(4)},${routeCoordinates[0][1].toFixed(4)}` : '';
  const routeLastKey = routeLength > 0 ? `${routeCoordinates![routeLength-1][0].toFixed(4)},${routeCoordinates![routeLength-1][1].toFixed(4)}` : '';
  const currentRouteKey = `${routeFirstKey}|${routeLastKey}`;

  // 1. CHUNKING: Dividir la ruta en bloques de 50km
  const routeChunks = useMemo(() => {
    if (!routeCoordinates || routeCoordinates.length === 0) return [];
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
    return chunks;
  }, [routeCoordinates]);

  // 2. DETECCIÓN DE TRAMO ACTUAL Y SIGUIENTE
  useEffect(() => {
    if (!isEnabled || !userPos || routeChunks.length === 0) return;

    // Encontrar en qué chunk estamos (el más cercano al coche)
    let currentIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < routeChunks.length; i++) {
      const d = getDist(userPos, routeChunks[i][0]);
      if (d < minDist) {
        minDist = d;
        currentIdx = i;
      }
    }

    // Calcular distancia al final del chunk actual para precarga (Lazy Fetch)
    const endOfChunk = routeChunks[currentIdx][routeChunks[currentIdx].length - 1];
    const distToEnd = getDist(userPos, endOfChunk);

    const chunksToFetch = [currentIdx];
    if (distToEnd < 10000 && currentIdx + 1 < routeChunks.length) {
      chunksToFetch.push(currentIdx + 1); // Precargar siguiente tramo si quedan <10km
    }

    chunksToFetch.forEach(idx => {
      if (!fetchedChunksRef.current.has(idx)) {
        fetchChunk(idx);
      }
    });

  }, [userPos?.[0], userPos?.[1], isEnabled, routeChunks]);

  const fetchChunk = async (chunkIdx: number) => {
    if (!routeChunks[chunkIdx]) return;
    const chunkKey = `${currentRouteKey}-chunk-${chunkIdx}`;
    
    // EVITAR DOBLE PETICIÓN
    if (fetchedChunksRef.current.has(chunkIdx)) return;
    fetchedChunksRef.current.add(chunkIdx);

    setLoadingRadars(true);
    try {
      // 3. ESTRATEGIA CACHE-FIRST (IndexedDB)
      let chunkData = await cacheService.get('radars', chunkKey);
      
      if (!chunkData) {
        logger.info('useRadars', `Cache Miss: Pidiendo tramo ${chunkIdx} a Supabase...`);
        const chunk = routeChunks[chunkIdx];
        const wkt = `LINESTRING(${chunk.map(pt => `${pt[1]} ${pt[0]}`).join(', ')})`;
        const { data } = await supabase.rpc('get_radars_in_route', { p_route_wkt: wkt, p_buffer_meters: 150 });
        
        if (data) {
          chunkData = (data as any[]).map(r => ({
            id: r.id, lat: r.lat, lon: r.lon, type: r.radar_type || 'fixed',
            speedLimit: r.speed_limit, direction: r.direction, road: r.road
          }));
          // Guardar en caché para próximas 24h
          await cacheService.set('radars', chunkKey, chunkData);
        }
      } else {
        logger.info('useRadars', `Cache Hit: Tramo ${chunkIdx} recuperado de IndexedDB`);
      }

      if (chunkData) {
        setRadars(prev => {
          const newOnes = chunkData.filter((r: any) => !prev.some(p => p.id === r.id));
          return [...prev, ...newOnes];
        });
      }
    } catch (err) {
      logger.error('useRadars', `Error tramo ${chunkIdx}`, err);
    } finally {
      setLoadingRadars(false);
    }
  };

  // Lógica para Modo Local y Reset de Ruta
  useEffect(() => {
    if (!isEnabled || !userPos) {
      if (!isEnabled) {
        setRadars([]);
        setRadarZones([]);
        fetchedChunksRef.current.clear();
      }
      return;
    }

    const hasRoute = routeLength > 0;
    if (!hasRoute) {
      // MODO LOCAL (Cada 5km)
      const currentLocKey = `${Math.floor(userPos[0]*20)},${Math.floor(userPos[1]*20)}`;
      if (lastFetchRef.current?.routeKey === currentLocKey) return;

      const fetchLocal = async () => {
        setLoadingRadars(true);
        try {
          const { data: fixed } = await supabase.rpc('get_radars_nearby', { p_lat: userPos[0], p_lon: userPos[1], p_radius_meters: 15000 });
          const { data: comm } = await supabase.rpc('get_community_radars_nearby', { p_lat: userPos[0], p_lon: userPos[1], p_radius_meters: 15000 });
          const accumulated: Radar[] = [];
          if (fixed) (fixed as any[]).forEach(r => accumulated.push({ id: r.id, lat: r.lat, lon: r.lon, type: r.radar_type || 'fixed', speedLimit: r.speed_limit, direction: r.direction }));
          if (comm) (comm as any[]).forEach(r => accumulated.push({ id: r.id, lat: r.lat, lon: r.lon, type: 'community_mobile', confirmations: r.confirmations }));
          setRadars(accumulated);
          lastFetchRef.current = { pos: userPos, routeKey: currentLocKey };
        } catch (err) { logger.error('useRadars', 'Error local', err); }
        finally { setLoadingRadars(false); }
      };
      fetchLocal();
    } else {
      // Limpiar chunks si la ruta es nueva
      if (lastFetchRef.current?.routeKey !== currentRouteKey) {
        setRadars([]);
        fetchedChunksRef.current.clear();
        lastFetchRef.current = { pos: userPos, routeKey: currentRouteKey };
      }
    }
  }, [isEnabled, currentRouteKey, routeLength, (routeLength === 0 ? Math.floor(userPos?.[0]*20) : 0)]);

  return { radars, radarZones, loadingRadars, progress, refreshRadars: () => { fetchedChunksRef.current.clear(); setRefreshTrigger(prev => prev + 1); } };
}
