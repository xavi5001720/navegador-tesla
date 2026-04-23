import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export interface ChargerFilters {
  isFree?: boolean;
  connectors?: ('ccs' | 'tipo2' | 'enchufe' | 'chademo')[];
  minPower?: number;
}

export interface Charger {
  id: number; 
  lat: number; 
  lon: number; 
  title: string; 
  address: string;
  operator: string; 
  usageCost: string; 
  maxPower: number; 
  connections: any[];
}

const CONSTANTS = {
  BASE_URL: '/api/chargers',
  CONNECTOR_MAP: { 
    'ccs': '33,32', 
    'tipo2': '25,1036', 
    'enchufe': '28', 
    'chademo': '2' 
  }
};

const getDist = (p1: [number, number], p2: [number, number]) => {
  const R = 6371e3;
  const dLat = (p2[0] - p1[0]) * Math.PI / 180;
  const dLon = (p2[1] - p1[1]) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
};

export function useChargers(
  userPos: [number, number] | null, 
  routeCoordinates?: [number, number][], 
  isEnabled: boolean = false, 
  filters: ChargerFilters = {}
) {
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const lastFetchRef = useRef<{ type: 'route'|'local', pos: [number, number], routeKey: string, filtersStr: string } | null>(null);

  const routeLength = routeCoordinates?.length ?? 0;
  const routeFirstKey = routeCoordinates?.[0] ? `${routeCoordinates[0][0].toFixed(4)},${routeCoordinates[0][1].toFixed(4)}` : '';
  const routeLastKey = routeLength > 0 ? `${routeCoordinates![routeLength-1][0].toFixed(4)},${routeCoordinates![routeLength-1][1].toFixed(4)}` : '';
  const filtersStr = JSON.stringify(filters);

  // FUNCIÓN HÍBRIDA: Obtener estado en tiempo real (Live Status)
  const fetchRealtimeStatus = useCallback(async (id: number) => {
    try {
      const res = await fetch(`${CONSTANTS.BASE_URL}?id=${id}&compact=true&verbose=false`);
      const data = await res.json();
      return Array.isArray(data) ? data[0] : null;
    } catch (err) {
      logger.error('useChargers', 'Error al obtener estado en tiempo real', err);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!isEnabled || !userPos) {
      if (!isEnabled && chargers.length > 0) setChargers([]);
      return;
    }

    const hasRoute = routeLength > 0;
    const currentType = hasRoute ? 'route' : 'local';
    const currentRouteKey = `${routeFirstKey}|${routeLastKey}`;

    // Evitar peticiones redundantes si no ha cambiado nada importante
    let shouldFetch = false;
    if (!lastFetchRef.current || lastFetchRef.current.type !== currentType || lastFetchRef.current.filtersStr !== filtersStr) {
      shouldFetch = true;
    } else if (currentType === 'route' && lastFetchRef.current.routeKey !== currentRouteKey) {
      shouldFetch = true;
    } else if (currentType === 'local' && getDist(lastFetchRef.current.pos, userPos) > 5000) {
      shouldFetch = true;
    }

    if (!shouldFetch) return;

    const fetchChargers = async () => {
      setLoading(true);
      try {
        let rpcData;
        
        if (hasRoute && routeCoordinates) {
          // ESTRATEGIA SUPABASE: Búsqueda en ruta con PostGIS
          // Simplificamos la ruta si es muy larga para evitar sobrecargar el WKT
          const step = Math.max(1, Math.floor(routeCoordinates.length / 200));
          const sampledCoords = routeCoordinates.filter((_, i) => i % step === 0);
          const wkt = `LINESTRING(${sampledCoords.map(c => `${c[1]} ${c[0]}`).join(', ')})`;
          
          const { data, error } = await supabase.rpc('get_chargers_in_route', {
            p_route_wkt: wkt,
            p_buffer_meters: 1000,
            p_min_power: filters.minPower || 0,
            p_only_free: !!filters.isFree
          });
          
          if (error) throw error;
          rpcData = data;
        } else {
          // ESTRATEGIA SUPABASE: Búsqueda cercana con PostGIS
          const { data, error } = await supabase.rpc('get_chargers_nearby', {
            p_lat: userPos[0],
            p_lon: userPos[1],
            p_radius_meters: 15000,
            p_min_power: filters.minPower || 0,
            p_only_free: !!filters.isFree
          });
          
          if (error) throw error;
          rpcData = data;
        }

        if (rpcData) {
          // Filtrado adicional por conectores en cliente (más flexible)
          const selectedConnectorIds = filters.connectors?.flatMap(c => 
            CONSTANTS.CONNECTOR_MAP[c].split(',').map(Number)
          ) || [];

          const finalData = (rpcData as any[]).filter(charger => {
            if (selectedConnectorIds.length > 0) {
              const connections = charger.connections || [];
              return connections.some((conn: any) => selectedConnectorIds.includes(conn.ConnectionTypeID));
            }
            return true;
          }).map(c => ({
            id: c.id,
            lat: c.lat,
            lon: c.lon,
            title: c.title,
            address: c.address,
            operator: c.operator || 'Desconocido',
            usageCost: c.usage_cost || 'Desconocido',
            maxPower: Number(c.max_power) || 0,
            connections: c.connections || []
          }));

          setChargers(finalData);
        }

        lastFetchRef.current = { 
          type: currentType, 
          pos: userPos, 
          routeKey: hasRoute ? currentRouteKey : 'LOCAL', 
          filtersStr 
        };
      } catch (err) {
        logger.error('useChargers', 'Error al cargar cargadores desde Supabase', err);
      } finally {
        setLoading(false);
      }
    };

    fetchChargers();
  }, [
    isEnabled, 
    routeFirstKey, 
    routeLastKey, 
    filtersStr, 
    (routeLength === 0 ? Math.floor((userPos?.[0] || 0) * 20) + ',' + Math.floor((userPos?.[1] || 0) * 20) : '0')
  ]);

  return useMemo(() => ({ 
    chargers, 
    loading, 
    progress, 
    fetchRealtimeStatus,
    refreshChargers: () => { 
      lastFetchRef.current = null; 
      setChargers(prev => [...prev]); 
    } 
  }), [chargers, loading, progress, fetchRealtimeStatus]);
}
