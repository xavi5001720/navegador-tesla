import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export interface GasStationFilters {
  fuels?: ('g95' | 'g98' | 'diesel' | 'glp')[];
  maxPrice?: number | null;
  onlyCheapest?: boolean;
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
  targetFuels?: string[]; // The fuels that made this station a 'winner'
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
  const fuelTypes = (filters.fuels && filters.fuels.length > 0) 
    ? filters.fuels 
    : ['g95', 'g98', 'diesel', 'glp'];

  const cheapestPerFuel: Record<string, { station: GasStation, price: number }> = {};

  for (const s of stations) {
    let isValid = false;
    let cheapestFuelPrice = Infinity;

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
      const gasStation: GasStation = {
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
      };

      processed.push(gasStation);

      if (filters.onlyCheapest) {
        for (const fuel of fuelTypes) {
          const price = s[`price_${fuel}`];
          if (price !== null && price > 0 && (!filters.maxPrice || price <= filters.maxPrice)) {
            if (!cheapestPerFuel[fuel] || price < cheapestPerFuel[fuel].price) {
              cheapestPerFuel[fuel] = { station: gasStation, price };
            }
          }
        }
      }
    }
  }

  if (filters.onlyCheapest) {
    const winners: Map<number, GasStation> = new Map();
    
    for (const fuel of fuelTypes) {
      const best = cheapestPerFuel[fuel];
      if (best) {
        if (!winners.has(best.station.id)) {
          winners.set(best.station.id, { 
            ...best.station, 
            cheapestFuelPrice: best.price, // Use the price of the winning fuel
            targetFuels: [fuel] 
          });
        } else {
          // If already a winner for another fuel, add this fuel to the list
          const existing = winners.get(best.station.id)!;
          existing.targetFuels = [...(existing.targetFuels || []), fuel];
          // Keep the cheapest absolute price for display (optional, but consistent)
          if (best.price < (existing.cheapestFuelPrice || Infinity)) {
            existing.cheapestFuelPrice = best.price;
          }
        }
      }
    }
    
    return Array.from(winners.values()).sort((a, b) => (a.cheapestFuelPrice || Infinity) - (b.cheapestFuelPrice || Infinity));
  }

  // Ordenar de más barato a más caro
  return processed.sort((a, b) => (a.cheapestFuelPrice || Infinity) - (b.cheapestFuelPrice || Infinity));
}

export function useGasStations(userPos: [number, number] | null, routeCoordinates?: [number, number][], isEnabled: boolean = false, filters: GasStationFilters = {}) {
  const [stations, setStations] = useState<GasStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const lastFetchRef = useRef<{ type: 'route'|'local', pos: [number, number], routeKey: string, filtersStr: string } | null>(null);

  // FIX C3: Valores primitivos estables como deps
  const routeLength = routeCoordinates?.length ?? 0;
  const routeFirstKey = routeCoordinates?.[0] ? `${routeCoordinates[0][0].toFixed(4)},${routeCoordinates[0][1].toFixed(4)}` : '';
  const routeLastKey = routeLength > 0 ? `${routeCoordinates![routeLength-1][0].toFixed(4)},${routeCoordinates![routeLength-1][1].toFixed(4)}` : '';
  const filtersStr = JSON.stringify(filters);

  useEffect(() => {
    if (!isEnabled || !userPos) {
      if (!isEnabled && stations.length > 0) setStations([]);
      return;
    }

    const hasRoute = routeLength > 0;
    const currentType = hasRoute ? 'route' : 'local';
    const currentRouteKey = `${routeFirstKey}|${routeLastKey}`;

    let shouldFetch = false;
    if (!lastFetchRef.current) {
      shouldFetch = true;
    } else if (lastFetchRef.current.type !== currentType) {
      shouldFetch = true;
    } else if (currentType === 'route' && lastFetchRef.current.routeKey !== currentRouteKey) {
      shouldFetch = true;
    } else if (lastFetchRef.current.filtersStr !== filtersStr) {
      shouldFetch = true;
    } else if (currentType === 'local') {
      const dist = getDist(lastFetchRef.current.pos, userPos);
      if (dist > 5000) shouldFetch = true;
    }

    if (!shouldFetch) return;

    const fetchStations = async () => {
      setLoading(true);
      logger.groupCollapsed('⛽ useGasStations', `Iniciando búsqueda (${hasRoute ? 'Modo Ruta' : 'Modo Local'})`);
      logger.time('⏱️ Fetch Gasolineras');
      logger.info('useGasStations', 'Filtros activos', filters);

      try {
        if (hasRoute) {
          setProgress(0);
          setStations([]);
        }

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
              p_route_wkt: routeWkt,
              p_buffer_meters: 300
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
            p_lat: userPos[0],
            p_lon: userPos[1],
            p_radius_meters: 15000
          });

          }
        }

        const processed = processStations(lastFetchRef.current?.type === 'route' ? [] : stations, filters);
        logger.timeEnd('⏱️ Fetch Gasolineras');
        logger.group('📊 Resumen de Combustible');
        logger.table({
          'Total Encontradas': stations.length,
          'Solo más Baratas': filters.onlyCheapest ? 'SÍ' : 'NO',
          'Combustibles': filters.fuels?.join(', ') || 'Todos'
        });
        logger.groupEnd();
        logger.groupEnd();

        lastFetchRef.current = { type: currentType, pos: userPos, routeKey: currentRouteKey, filtersStr };
      } catch (err) {
        logger.error('useGasStations', 'Error al cargar gasolineras', err);
      } finally {
        setLoading(false);
        setProgress(100);
      }
    };

    fetchStations();
  // FIX C3: Deps primitivas estables
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPos, isEnabled, routeLength, routeFirstKey, routeLastKey, filtersStr]);

  return { stations, loading, progress };
}
