import { useState } from 'react';

type Coordinates = [number, number]; // [latitud, longitud]

interface RouteResult {
  coordinates: Coordinates[];
  distance: number; // en metros
  duration: number; // en segundos
}

export function useRoute() {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

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

  // 2. Routing: Origen -> Destino (Usando OSRM Público)
  const calculateRoute = async (origin: Coordinates, destination: Coordinates) => {
    setLoadingRoute(true);
    setRouteError(null);
    try {
      // OSRM API espera "lon,lat"
      const originStr = `${origin[1]},${origin[0]}`;
      const destStr = `${destination[1]},${destination[0]}`;
      
      // Llamada pública a OSRM para coches (driving)
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${originStr};${destStr}?overview=full&geometries=geojson`);
      const data = await res.json();

      if (data.code !== 'Ok' || !data.routes.length) {
        throw new Error('No se pudo encontrar una ruta.');
      }

      const mainRoute = data.routes[0];
      
      // OSRM devuelve GeoJSON con formato [lon, lat], hay que invertirlo para Leaflet [lat, lon]
      const latLngs: Coordinates[] = mainRoute.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);

      setRoute({
        coordinates: latLngs,
        distance: mainRoute.distance,
        duration: mainRoute.duration,
      });

    } catch (err: any) {
      setRouteError(err.message || "Error calculando ruta.");
      setRoute(null);
    } finally {
      setLoadingRoute(false);
    }
  };

  const findAndTraceRoute = async (origin: Coordinates, destinationQuery: string) => {
     setLoadingRoute(true);
     setRouteError(null);
     
     const destCoords = await geocodeAddress(destinationQuery);
     if (!destCoords) {
        setRouteError("No he podido encontrar el destino en el mapa.");
        setLoadingRoute(false);
        return false;
     }

     await calculateRoute(origin, destCoords);
     return true;
  };
  
  const clearRoute = () => {
     setRoute(null);
     setRouteError(null);
  };

  return {
    route,
    loadingRoute,
    routeError,
    findAndTraceRoute,
    clearRoute
  };
}
