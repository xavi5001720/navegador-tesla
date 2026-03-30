import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface Radar {
  id: number;
  lat: number;
  lon: number;
  type: 'fixed' | 'mobile' | 'traffic_signals' | 'unknown';
  speedLimit?: number;
}

export function useRadars(userPos: [number, number] | null, routeCoordinates?: [number, number][], isEnabled: boolean = false) {
  const [radars, setRadars] = useState<Radar[]>([]);
  const [loadingRadars, setLoadingRadars] = useState(false);

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
      if (hasRoute) setFetchingRouteRadars(true);
      
      try {
        let supabaseData: any[] = [];
        
        if (hasRoute && routeCoordinates) {
          // MODO RUTA: Usamos postgis para filtrar radares a lo largo de la ruta (LINESTRING)
          // Convertimos la ruta a WKT: LINESTRING(lon lat, lon lat, ...)
          const wktPoints = routeCoordinates.map(pt => `${pt[1]} ${pt[0]}`).join(', ');
          const routeWkt = `LINESTRING(${wktPoints})`;

          console.log(`[useRadars] Consultando radares en ruta via Supabase RPC...`);
          const { data, error } = await supabase.rpc('get_radars_in_route', {
            route_wkt: routeWkt,
            buffer_meters: 50 // Margen de 50m configurado
          });

          if (error) throw error;
          supabaseData = data || [];
        } else {
          // MODO LOCAL: Búsqueda circular de 15km
          console.log(`[useRadars] Consultando radares cercanos via Supabase RPC...`);
          const { data, error } = await supabase.rpc('get_radars_nearby', {
            lat: userPos[0],
            lon: userPos[1],
            radius_meters: 15000
          });

          if (error) throw error;
          supabaseData = data || [];
        }

        // Mapeamos los resultados de Supabase al formato de la interfaz Radar
        const mappedRadars: Radar[] = supabaseData.map((r: any) => ({
          id: r.id,
          lat: r.lat,
          lon: r.lon,
          type: r.radar_type || 'fixed',
          speedLimit: r.speed_limit || undefined
        }));

        setRadars(mappedRadars);
        
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
      }
    };

    fetchRadars();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnabled, userPos?.[0], userPos?.[1], routeLength, routeFirstLat, routeFirstLon, routeLastLat, routeLastLon]);

  return { radars, loadingRadars, fetchingRouteRadars };
}
