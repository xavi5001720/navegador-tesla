import { useState, useEffect } from 'react';

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

  // Creamos dependencias primitivas estables para detectar cambios reales en la ruta
  const routeLength = routeCoordinates?.length ?? 0;
  const routeFirstLat = routeCoordinates?.[0]?.[0];
  const routeFirstLon = routeCoordinates?.[0]?.[1];
  const routeLastLat = routeCoordinates?.[routeLength - 1]?.[0];
  const routeLastLon = routeCoordinates?.[routeLength - 1]?.[1];

  useEffect(() => {
    if (!userPos) return;

    const fetchRadars = async () => {
      setLoadingRadars(true);
      try {
        let query = '';
        let currentSampledPoints: [number, number][] = [];
        
        if (routeCoordinates && routeCoordinates.length > 0) {
          // Simplificar la ruta a unos 30-40 puntos máximo para la polyline de Overpass
          const maxPoints = 40;
          const step = Math.max(1, Math.floor(routeCoordinates.length / maxPoints)); 
          
          let polylineCoords = [];
          for (let i = 0; i < routeCoordinates.length; i += step) {
            polylineCoords.push(`${routeCoordinates[i][0]},${routeCoordinates[i][1]}`);
          }
          // Asegurar destino final
          const lastPoint = routeCoordinates[routeCoordinates.length - 1];
          const lastPointStr = `${lastPoint[0]},${lastPoint[1]}`;
          if (polylineCoords[polylineCoords.length - 1] !== lastPointStr) {
            polylineCoords.push(lastPointStr);
          }

          // Consultar a lo largo de la polilínea (radio 1000m = 1km a cada lado)
          const polylineString = polylineCoords.join(',');
          
          query = `
            [out:json][timeout:50];
            (
              node["highway"="speed_camera"](around:1000,${polylineString});
            );
            out body;
          `;
          console.log(`[useRadars] Fetching radars along polyline (${polylineCoords.length} points).`);
        } else {
          query = `
            [out:json][timeout:25];
            (
              node["highway"="speed_camera"](around:10000,${userPos[0]},${userPos[1]});
            );
            out body;
          `;
          console.log(`[useRadars] Fetching nearby radars for [${userPos[0]}, ${userPos[1]}]`);
        }
        
        const url = `https://overpass-api.de/api/interpreter`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(query)}`
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[useRadars] Overpass Error:', response.status, errorText);
          throw new Error('Overpass Error: ' + response.status);
        }

        const data = await response.json();
        console.log(`[useRadars] Received ${data.elements?.length || 0} elements from Overpass.`);

        if (data.elements) {
          const mappedRadars: Radar[] = data.elements.map((el: any) => ({
            id: el.id,
            lat: el.lat,
            lon: el.lon,
            type: el.tags.highway === 'speed_camera' ? 'fixed' : 'unknown',
            speedLimit: el.tags.maxspeed ? parseInt(el.tags.maxspeed) : undefined,
          }));

          const uniqueRadars = Array.from(new Map(mappedRadars.map(r => [r.id, r])).values());
          console.log(`[useRadars] Unique radars after mapping: ${uniqueRadars.length}`);
          setRadars(uniqueRadars);
        }
      } catch (error) {
        console.error("[useRadars] Fetching failed:", error);
      } finally {
        setLoadingRadars(false);
      }
    };

    fetchRadars();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPos?.[0], userPos?.[1], routeLength, routeFirstLat, routeFirstLon, routeLastLat, routeLastLon]);

  return { radars, loadingRadars };
}
