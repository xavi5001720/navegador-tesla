import { useState, useCallback } from 'react';

type Coordinates = [number, number]; // [latitud, longitud]

interface RouteResult {
  coordinates: Coordinates[];
  distance: number; // en metros
  duration: number; // en segundos
}

// 1. Geocoding: Texto -> Coordenadas (Usando Nominatim / OpenStreetMap)
const geocodeAddress = async (query: string): Promise<Coordinates | null> => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
      const data = await res.json();
      
      if (data && data.length > 0) {
        // Nominatim devuelve Strings ("lat", "lon")
        return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      }
      return null;
    } catch (err) {
      console.error("Geocoding Error:", err);
      return null;
    }
  };

export function useRoute() {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [destination, setDestination] = useState<Coordinates | null>(null);
  const [waypoints, setWaypoints] = useState<Coordinates[]>([]); // paradas intermedias
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  // 2. Routing: múltiples puntos (Usando OSRM Público)
  const calculateRoute = useCallback(async (origin: Coordinates, destination: Coordinates, stops: Coordinates[] = []) => {
    setLoadingRoute(true);
    setRouteError(null);
    try {
      // Construimos la cadena de coordenadas: origen;[paradas...];destino
      const allPoints: Coordinates[] = [origin, ...stops, destination];
      const coordStr = allPoints.map(p => `${p[1]},${p[0]}`).join(';');
      
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`);
      const data = await res.json();

      if (data.code !== 'Ok' || !data.routes.length) {
        throw new Error('No se pudo encontrar una ruta.');
      }

      const mainRoute = data.routes[0];
      
      // OSRM devuelve GeoJSON con formato [lon, lat], hay que invertirlo para Leaflet [lat, lon]
      const latLngs: Coordinates[] = mainRoute.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);

      // Añadimos la posición exacta del usuario al principio de la ruta.
      // OSRM hace "snap" a la carretera más cercana, lo que puede causar que la ruta generada
      // inicie a varios metros del punto GPS real, provocando un falso "desvío" inmediatamente.
      if (latLngs.length > 0) {
        latLngs.unshift([...origin]);
      }

      setRoute({
        coordinates: latLngs,
        distance: mainRoute.distance,
        duration: mainRoute.duration,
      });

      setDestination(destination);
      setWaypoints(stops);

    } catch (err: any) {
      setRouteError(err.message || "Error calculando ruta.");
      setRoute(null);
    } finally {
      setLoadingRoute(false);
    }
  }, []);

  const findAndTraceRoute = useCallback(async (origin: Coordinates, destinationQuery: string) => {
     setLoadingRoute(true);
     setRouteError(null);
     
     const destCoords = await geocodeAddress(destinationQuery);
     if (!destCoords) {
        setRouteError("No he podido encontrar el destino en el mapa.");
        setLoadingRoute(false);
        return false;
     }

     await calculateRoute(origin, destCoords, []);
     return true;
  }, [calculateRoute]);
  
  // Añadir parada antes del destino final
  const addWaypointBefore = useCallback(async (origin: Coordinates, newStop: Coordinates) => {
    if (!destination) return;
    // La parada nueva va antes del destino final
    const newWaypoints = [...waypoints, newStop];
    await calculateRoute(origin, destination, newWaypoints);
  }, [destination, waypoints, calculateRoute]);

  // Añadir parada después del destino actual (el destino actual se convierte en parada y la nueva en destino)
  const addWaypointAfter = useCallback(async (origin: Coordinates, newDestination: Coordinates) => {
    if (!destination) return;
    // El destino actual se convierte en parada intermedia, la nueva coordenada es el nuevo destino
    const newWaypoints = [...waypoints, destination];
    await calculateRoute(origin, newDestination, newWaypoints);
  }, [destination, waypoints, calculateRoute]);

  const clearRoute = useCallback(() => {
     setRoute(null);
     setDestination(null);
     setWaypoints([]);
     setRouteError(null);
  }, []);

  return {
    route,
    destination,
    waypoints,
    loadingRoute,
    routeError,
    calculateRoute,
    findAndTraceRoute,
    addWaypointBefore,
    addWaypointAfter,
    clearRoute
  };
}
