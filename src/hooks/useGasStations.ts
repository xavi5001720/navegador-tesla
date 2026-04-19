import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { cacheService } from '@/lib/db';

export interface GasStationFilters {
  fuels?: ('g95' | 'g98' | 'diesel' | 'glp')[];
  maxPrice?: number | null;
  onlyCheapest?: boolean;
}

export interface GasStation {
  id: number; lat: number; lon: number; name: string; address: string; city: string; schedule: string;
  price_g95: number | null; price_g98: number | null; price_diesel: number | null; price_glp: number | null;
  cheapestFuelPrice?: number; targetFuels?: string[];
}

const getDist = (p1: [number, number], p2: [number, number]) => {
  const R = 6371e3;
  const dLat = (p2[0] - p1[0]) * Math.PI / 180;
  const dLon = (p2[1] - p1[1]) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
};

function processStations(stations: any[], filters: GasStationFilters): GasStation[] {
  const processed: GasStation[] = [];
  const fuelTypes = (filters.fuels && filters.fuels.length > 0) ? filters.fuels : ['g95', 'g98', 'diesel', 'glp'];

  for (const s of stations) {
    let isValid = false;
    let cheapestFuelPrice = Infinity;
    for (const fuel of fuelTypes) {
      const price = s[`price_${fuel}`];
      if (price !== null && price > 0 && (!filters.maxPrice || price <= filters.maxPrice)) {
        isValid = true;
        if (price < cheapestFuelPrice) cheapestFuelPrice = price;
      }
    }
    if (isValid) {
      processed.push({
        id: s.id, lat: s.lat, lon: s.lon, name: s.name, address: s.address, city: s.city, schedule: s.schedule,
        price_g95: s.price_g95, price_g98: s.price_g98, price_diesel: s.price_diesel, price_glp: s.price_glp,
        cheapestFuelPrice: cheapestFuelPrice === Infinity ? undefined : cheapestFuelPrice,
      });
    }
  }
  return processed.sort((a, b) => (a.cheapestFuelPrice || Infinity) - (b.cheapestFuelPrice || Infinity));
}

export function useGasStations(userPos: [number, number] | null, routeCoordinates?: [number, number][], isEnabled: boolean = false, filters: GasStationFilters = {}) {
  const [stations, setStations] = useState<GasStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const lastFetchRef = useRef<{pos: [number, number], routeKey: string, filtersStr: string} | null>(null);
  const fetchedChunksRef = useRef<Set<number>>(new Set());

  const routeLength = routeCoordinates?.length ?? 0;
  const routeFirstKey = routeCoordinates?.[0] ? `${routeCoordinates[0][0].toFixed(4)},${routeCoordinates[0][1].toFixed(4)}` : '';
  const routeLastKey = routeLength > 0 ? `${routeCoordinates![routeLength-1][0].toFixed(4)},${routeCoordinates![routeLength-1][1].toFixed(4)}` : '';
  const currentRouteKey = `${routeFirstKey}|${routeLastKey}`;
  const filtersStr = JSON.stringify(filters);

  // 1. CHUNKING: Bloques de 50km
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

  // 2. DETECCIÓN DE TRAMO Y PRECARGA (Lazy Fetch)
  useEffect(() => {
    if (!isEnabled || !userPos || routeChunks.length === 0) return;

    let currentIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < routeChunks.length; i++) {
      const d = getDist(userPos, routeChunks[i][0]);
      if (d < minDist) { minDist = d; currentIdx = i; }
    }

    const endOfChunk = routeChunks[currentIdx][routeChunks[currentIdx].length - 1];
    const distToEnd = getDist(userPos, endOfChunk);

    const chunksToFetch = [currentIdx];
    if (distToEnd < 10000 && currentIdx + 1 < routeChunks.length) {
      chunksToFetch.push(currentIdx + 1); // Precargar si quedan <10km
    }

    chunksToFetch.forEach(idx => {
      if (!fetchedChunksRef.current.has(idx)) fetchChunk(idx);
    });
  }, [userPos?.[0], userPos?.[1], isEnabled, routeChunks]);

  const fetchChunk = async (chunkIdx: number) => {
    if (!routeChunks[chunkIdx] || fetchedChunksRef.current.has(chunkIdx)) return;
    fetchedChunksRef.current.add(chunkIdx);
    const chunkKey = `${currentRouteKey}-gas-chunk-${chunkIdx}-${filtersStr}`;

    setLoading(true);
    try {
      // 3. CACHE-FIRST (IndexedDB)
      let chunkData = await cacheService.get('gas_stations', chunkKey);
      
      if (!chunkData) {
        logger.info('useGasStations', `Cache Miss: Tramo ${chunkIdx} desde Supabase...`);
        const chunk = routeChunks[chunkIdx];
        const wktPoints = chunk.map(pt => `${pt[1]} ${pt[0]}`).join(', ');
        const { data } = await supabase.rpc('get_stations_in_route', { 
          p_route_wkt: `LINESTRING(${wktPoints})`, 
          p_buffer_meters: 100 
        });
        
        if (data) {
          chunkData = data;
          await cacheService.set('gas_stations', chunkKey, chunkData);
        }
      } else {
        logger.info('useGasStations', `Cache Hit: Tramo ${chunkIdx} desde IndexedDB`);
      }

      if (chunkData) {
        const processed = processStations(chunkData, filters);
        setStations(prev => {
          const newOnes = processed.filter(s => !prev.some(p => p.id === s.id));
          return [...prev, ...newOnes];
        });
      }
    } catch (err) { logger.error('useGasStations', `Error tramo ${chunkIdx}`, err); }
    finally { setLoading(false); }
  };

  // Lógica Local y Resets
  useEffect(() => {
    if (!isEnabled || !userPos) {
      if (!isEnabled) { setStations([]); fetchedChunksRef.current.clear(); }
      return;
    }

    const hasRoute = routeLength > 0;
    if (!hasRoute) {
      const currentLocKey = `${Math.floor(userPos[0]*20)},${Math.floor(userPos[1]*20)}`;
      if (lastFetchRef.current?.routeKey === currentLocKey && lastFetchRef.current?.filtersStr === filtersStr) return;

      const fetchLocal = async () => {
        setLoading(true);
        try {
          const { data } = await supabase.rpc('get_stations_nearby', { p_lat: userPos[0], p_lon: userPos[1], p_radius_meters: 15000 });
          if (data) setStations(processStations(data, filters));
          lastFetchRef.current = { pos: userPos, routeKey: currentLocKey, filtersStr };
        } catch (err) { logger.error('useGasStations', 'Error local', err); }
        finally { setLoading(false); }
      };
      fetchLocal();
    } else {
      if (lastFetchRef.current?.routeKey !== currentRouteKey || lastFetchRef.current?.filtersStr !== filtersStr) {
        setStations([]);
        fetchedChunksRef.current.clear();
        lastFetchRef.current = { pos: userPos, routeKey: currentRouteKey, filtersStr };
      }
    }
  }, [isEnabled, currentRouteKey, routeLength, filtersStr, (routeLength === 0 ? Math.floor(userPos?.[0]*20) : 0)]);

  return { stations, loading, progress };
}
