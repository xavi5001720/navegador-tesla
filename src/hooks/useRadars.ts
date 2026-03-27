import { useState, useEffect, useRef } from 'react';

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
  const lastFetchRef = useRef<{ pos: [number, number], routeLength: number } | null>(null);

  // Creamos dependencias primitivas estables para detectar cambios reales en la ruta
  const routeLength = routeCoordinates?.length ?? 0;
  const routeFirstLat = routeCoordinates?.[0]?.[0];
  const routeFirstLon = routeCoordinates?.[0]?.[1];
  const routeLastLat = routeCoordinates?.[routeLength - 1]?.[0];
  const routeLastLon = routeCoordinates?.[routeLength - 1]?.[1];

  // Helper para distancia rápida
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
    // Lógica para decidir si es necesario refetch: Cada 5000 metros
    let shouldFetch = false;
    if (!lastFetchRef.current) {
      shouldFetch = true;
    } else {
      const dist = getDist(lastFetchRef.current.pos, userPos);
      if (dist > 5000) shouldFetch = true; // Buscar nuevos radares tras avanzar 5km
    }

    if (!shouldFetch) return;

    const fetchRadars = async () => {
      setLoadingRadars(true);
      if (hasRoute) setFetchingRouteRadars(true);
      
      try {
        let query = '';
        
        // Siempre usamos una búsqueda circular (15km = approx 10 minutos de conducción por autovía)
        // en torno al usuario. Si hay ruta, Overpass en un BBox de España entera daría Timeout.
        // Las llamadas a 15km a la redonda tardan apenas 200 milisegundos y nos dan los radares exactos.
        query = `[out:json][timeout:15];
(
  node["highway"="speed_camera"](around:15000,${userPos[0]},${userPos[1]});
  node["enforcement"="speed"](around:15000,${userPos[0]},${userPos[1]});
);
out body;`;
        console.log(`[useRadars] Fetching radars 15km around [${userPos[0]}, ${userPos[1]}]`);
        
        const url = `https://overpass-api.de/api/interpreter`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(query)}`
        });

        if (!response.ok) throw new Error('Overpass Error: ' + response.status);

        const data = await response.json();

        if (data.elements) {
          const mappedRadars: Radar[] = data.elements.map((el: any) => ({
            id: el.id,
            lat: el.lat,
            lon: el.lon,
            type: (el.tags.highway === 'speed_camera' || el.tags.enforcement === 'speed') ? 'fixed' : 'unknown',
            speedLimit: el.tags.maxspeed ? parseInt(el.tags.maxspeed) : undefined,
          }));

          const uniqueRadars = Array.from(new Map(mappedRadars.map(r => [r.id, r])).values());
          setRadars(uniqueRadars);
          
          // Actualizar ref con la peticion exitosa
          lastFetchRef.current = {
            pos: userPos,
            routeLength: routeLength
          };
        }
      } catch (error) {
        console.error("[useRadars] Fetching failed:", error);
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
