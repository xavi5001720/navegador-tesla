import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface GasStationFilters {
  fuels?: ('g95' | 'g98' | 'diesel' | 'glp')[];
  maxPrice?: number | null;
}

export interface GasStation {
  id: number;
  lat: number;
  lon: number;
  name: string;
  address: string;
  city: string;
  schedule: string;
  price_g95: number | null;
  price_g98: number | null;
  price_diesel: number | null;
  price_glp: number | null;
  cheapestFuelPrice?: number; // Calculated field based on filters
}

const CONSTANTS = {
  CHUNK_DISTANCE_M: 50000,
};

const getDist = (p1: [number, number], p2: [number, number]) => {
  const R = 6371e3;
  const dLat = (p2[0] - p1[0]) * Math.PI / 180;
  const dLon = (p2[1] - p1[1]) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
};

function processStations(stations: any[], filters: GasStationFilters): GasStation[] {
  const processed: GasStation[] = [];

  for (const s of stations) {
    let isValid = false;
    let cheapestFuelPrice = Infinity;

    // Si no hay combustibles seleccionados, asumimos que se buscan TODOS.
    const fuelTypes = (filters.fuels && filters.fuels.length > 0) 
      ? filters.fuels 
      : ['g95', 'g98', 'diesel', 'glp'];

    for (const fuel of fuelTypes) {
      const price = s[`price_${fuel}`];
      if (price !== null && price > 0) {
        if (!filters.maxPrice || price <= filters.maxPrice) {
          isValid = true;
          if (price < cheapestFuelPrice) {
            cheapestFuelPrice = price;
          }
        }
      }
    }

    if (isValid) {
      processed.push({
        id: s.id,
        lat: s.lat,
        lon: s.lon,
        name: s.name,
        address: s.address,
        city: s.city,
        schedule: s.schedule,
        price_g95: s.price_g95,
        price_g98: s.price_g98,
        price_diesel: s.price_diesel,
        price_glp: s.price_glp,
        cheapestFuelPrice: cheapestFuelPrice === Infinity ? undefined : cheapestFuelPrice,
      });
    }
  }

  // Ordenar de más barato a más caro
  return processed.sort((a, b) => (a.cheapestFuelPrice || Infinity) - (b.cheapestFuelPrice || Infinity));
}

export function useGasStations(userPos: [number, number] | null, routeCoordinates?: [number, number][], isEnabled: boolean = false, filters: GasStationFilters = {}) {
  const [stations, setStations] = useState<GasStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const lastFetchRef = useRef<{ type: 'route'|'local', pos: [number, number], routeLength: number, filtersStr: string } | null>(null);

  const routeLength = routeCoordinates?.length ?? 0;
  const filtersStr = JSON.stringify(filters);

  useEffect(() => {
    if (!isEnabled || !userPos) {
      if (!isEnabled && stations.length > 0) setStations([]);
      return;
    }

    const hasRoute = routeCoordinates && routeCoordinates.length > 0;
    const currentType = hasRoute ? 'route' : 'local';

    let shouldFetch = false;
    if (!lastFetchRef.current) {
      shouldFetch = true;
    } else if (lastFetchRef.current.type !== currentType) {
      shouldFetch = true;
    } else if (currentType === 'route' && lastFetchRef.current.routeLength !== routeLength) {
      shouldFetch = true;
    } else if (lastFetchRef.current.filtersStr !== filtersStr) {
      shouldFetch = true;
    } else if (currentType === 'local') {
      const dist = getDist(lastFetchRef.current.pos, userPos);
      if (dist > 5000) shouldFetch = true; // Refetch auto cada 5km si es local
    }

    if (!shouldFetch) return;

    const fetchStations = async () => {
      setLoading(true);
      if (hasRoute) {
        setProgress(0);
        setStations([]);
      }

      try {
        if (hasRoute && routeCoordinates) {
          // Dividir la ruta en tramos de 50km
          const chunks: [number, number][][] = [];
          let currentChunk: [number, number][] = [routeCoordinates[0]];
          let currentDist = 0;

          for (let i = 1; i < routeCoordinates.length; i++) {
            const d = getDist(routeCoordinates[i-1], routeCoordinates[i]);
            currentDist += d;
            currentChunk.push(routeCoordinates[i]);

            if (currentDist >= CONSTANTS.CHUNK_DISTANCE_M) {
              chunks.push(currentChunk);
              currentChunk = [routeCoordinates[i]];
              currentDist = 0;
            }
          }
          if (currentChunk.length > 1) chunks.push(currentChunk);

          const uniqueIds = new Set<number>();
          const accumulated: any[] = [];

          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const wktPoints = chunk.map(pt => `${pt[1]} ${pt[0]}`).join(', ');
            const routeWkt = `LINESTRING(${wktPoints})`;

            const { data, error } = await supabase.rpc('get_stations_in_route', {
              route_wkt: routeWkt,
              buffer_meters: 2000 // 2km margen
            });

            if (error) {
              console.error(`[useGasStations] Error chunk ${i}:`, error);
              continue;
            }

            if (data) {
              data.forEach((s: any) => {
                if (!uniqueIds.has(s.id)) {
                  uniqueIds.add(s.id);
                  accumulated.push(s);
                }
              });
              
              setStations(processStations([...accumulated], filters));
            }
            setProgress(Math.round(((i + 1) / chunks.length) * 100));
          }
        } else {
          // Busqueda local 15km
          const { data, error } = await supabase.rpc('get_stations_nearby', {
            lat: userPos[0],
            lon: userPos[1],
            radius_meters: 15000
          });

          if (error) throw error;
          if (data) {
            setStations(processStations(data, filters));
          }
        }

        lastFetchRef.current = { type: currentType, pos: userPos, routeLength, filtersStr };
      } catch (err) {
        console.error('[useGasStations] Fatal Error:', err);
      } finally {
        setLoading(false);
        setProgress(100);
      }
    };

    fetchStations();
  }, [userPos, isEnabled, routeCoordinates, routeLength, filtersStr]);

  return { stations, loading, progress };
}
