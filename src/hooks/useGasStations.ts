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
        id: s.id, lat: s.lat, lon: s.lon, name: s.name, address: s.address, city: s.city, schedule: s.schedule,
        price_g95: s.price_g95, price_g98: s.price_g98, price_diesel: s.price_diesel, price_glp: s.price_glp,
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
          winners.set(best.station.id, { ...best.station, cheapestFuelPrice: best.price, targetFuels: [fuel] });
        } else {
          const existing = winners.get(best.station.id)!;
          existing.targetFuels = [...(existing.targetFuels || []), fuel];
          if (best.price < (existing.cheapestFuelPrice || Infinity)) existing.cheapestFuelPrice = best.price;
        }
      }
    }
    return Array.from(winners.values()).sort((a, b) => (a.cheapestFuelPrice || Infinity) - (b.cheapestFuelPrice || Infinity));
  }
  return processed.sort((a, b) => (a.cheapestFuelPrice || Infinity) - (b.cheapestFuelPrice || Infinity));
}

export function useGasStations(userPos: [number, number] | null, routeCoordinates?: [number, number][], isEnabled: boolean = false, filters: GasStationFilters = {}) {
  const [stations, setStations] = useState<GasStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const lastFetchRef = useRef<{ type: 'route'|'local', pos: [number, number], routeKey: string, filtersStr: string } | null>(null);

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
    if (!lastFetchRef.current || lastFetchRef.current.type !== currentType || lastFetchRef.current.filtersStr !== filtersStr) {
      shouldFetch = true;
    } else if (currentType === 'route' && lastFetchRef.current.routeKey !== currentRouteKey) {
      shouldFetch = true;
    } else if (currentType === 'local') {
      if (getDist(lastFetchRef.current.pos, userPos) > 5000) shouldFetch = true;
    }

    if (!shouldFetch) return;

    const fetchStations = async () => {
      setLoading(true);
      logger.groupCollapsed('⛽ useGasStations', `Iniciando búsqueda (${hasRoute ? 'Modo Ruta' : 'Modo Local'})`);
      logger.time('⏱️ Fetch Gasolineras');

      try {
        const accumulatedRaw: any[] = [];
        if (hasRoute && routeCoordinates) {
          const chunks: [number, number][][] = [];
          for (let i = 0; i < routeCoordinates.length; i += 100) chunks.push(routeCoordinates.slice(i, i + 105));

          const uniqueIds = new Set<number>();
          for (let i = 0; i < chunks.length; i++) {
            const wktPoints = chunks[i].map(pt => `${pt[1]} ${pt[0]}`).join(', ');
            const { data, error } = await supabase.rpc('get_stations_in_route', { 
              p_route_wkt: `LINESTRING(${wktPoints})`, 
              p_buffer_meters: 100 // Solo gasolineras a pie de carretera (100m)
            });
            if (data) {
              data.forEach((s: any) => { if (!uniqueIds.has(s.id)) { uniqueIds.add(s.id); accumulatedRaw.push(s); } });
              setStations(processStations([...accumulatedRaw], filters));
            }
            setProgress(Math.round(((i + 1) / chunks.length) * 100));
          }
        } else {
          const { data } = await supabase.rpc('get_stations_nearby', { p_lat: userPos[0], p_lon: userPos[1], p_radius_meters: 15000 });
          if (data) {
            data.forEach((s: any) => accumulatedRaw.push(s));
            setStations(processStations(accumulatedRaw, filters));
          }
        }

        logger.timeEnd('⏱️ Fetch Gasolineras');
        logger.group('📊 Resumen de Combustible');
        logger.table({
          'Total Encontradas': accumulatedRaw.length,
          'Filtro Combustibles': filters.fuels?.join(', ') || 'Todos'
        });
        logger.groupEnd();
        logger.groupEnd();

        lastFetchRef.current = { type: currentType, pos: userPos, routeKey: currentRouteKey, filtersStr };
      } catch (err) {
        logger.error('useGasStations', 'Error en carga de gasolineras', err);
      } finally {
        setLoading(false);
        setProgress(100);
      }
    };
    fetchStations();
  }, [userPos?.[0], userPos?.[1], isEnabled, routeLength, routeFirstKey, routeLastKey, filtersStr]);

  return { stations, loading, progress };
}
