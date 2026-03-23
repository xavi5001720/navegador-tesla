import { useState, useEffect, useRef } from 'react';

export interface Radar {
  id: number;
  lat: number;
  lon: number;
  type: 'fixed' | 'mobile' | 'traffic_signals' | 'unknown';
  speedLimit?: number;
}

export function useRadars(userPos: [number, number] | null, routeCoordinates?: [number, number][]) {
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

  // Helper para distancia rápida
  const getDist = (p1: [number, number], p2: [number, number]) => {
    const R = 6371e3;
    const dLat = (p2[0] - p1[0]) * Math.PI / 180;
    const dLon = (p2[1] - p1[1]) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
  };

  useEffect(() => {
    if (!userPos) return;

    const hasRoute = routeCoordinates && routeCoordinates.length > 0;
    const currentType = hasRoute ? 'route' : 'local';

    // Lógica para decidir si es necesario refetch
    let shouldFetch = false;
    if (!lastFetchRef.current) {
      shouldFetch = true;
    } else if (lastFetchRef.current.type !== currentType) {
      shouldFetch = true;
    } else if (currentType === 'route' && lastFetchRef.current.routeLength !== routeLength) {
      shouldFetch = true;
    } else if (currentType === 'local') {
      const dist = getDist(lastFetchRef.current.pos, userPos);
      if (dist > 5000) shouldFetch = true; // Solo buscar si se ha movido 5km sin ruta
    }

    if (!shouldFetch) return;

    const fetchRadars = async () => {
      setLoadingRadars(true);
      if (hasRoute) setFetchingRouteRadars(true);
      
      try {
        let query = '';
        let currentSampledPoints: [number, number][] = [];
        
        if (hasRoute && routeCoordinates) {
          // Simplificar la ruta a unos 40 puntos máximo para no saturar Overpass
          const maxPoints = 40;
          const step = Math.max(1, Math.floor(routeCoordinates.length / maxPoints)); 
          
          for (let i = 0; i < routeCoordinates.length; i += step) {
            currentSampledPoints.push(routeCoordinates[i]);
          }
          const lastPoint = routeCoordinates[routeCoordinates.length - 1];
          if (currentSampledPoints[currentSampledPoints.length - 1] !== lastPoint) {
            currentSampledPoints.push(lastPoint);
          }

          const aroundQueries = currentSampledPoints
            .map(p => `node["highway"="speed_camera"](around:1500,${p[0]},${p[1]});`)
            .join('\n              ');
          
          query = `[out:json][timeout:50];\n(\n              ${aroundQueries}\n);\nout body;`;
          console.log(`[useRadars] Fetching radars using ${currentSampledPoints.length} sample points (1.5km radius).`);
        } else {
          query = `[out:json][timeout:25];\n(\n  node["highway"="speed_camera"](around:10000,${userPos[0]},${userPos[1]});\n);\nout body;`;
          console.log(`[useRadars] Fetching nearby radars for [${userPos[0]}, ${userPos[1]}]`);
        }
        
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
            type: el.tags.highway === 'speed_camera' ? 'fixed' : 'unknown',
            speedLimit: el.tags.maxspeed ? parseInt(el.tags.maxspeed) : undefined,
          }));

          const uniqueRadars = Array.from(new Map(mappedRadars.map(r => [r.id, r])).values());
          setRadars(uniqueRadars);
          
          // Actualizar ref con la peticion exitosa
          lastFetchRef.current = {
            type: currentType,
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
  }, [userPos?.[0], userPos?.[1], routeLength, routeFirstLat, routeFirstLon, routeLastLat, routeLastLon]);

  return { radars, loadingRadars, fetchingRouteRadars };
}
