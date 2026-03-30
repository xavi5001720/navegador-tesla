import { useState, useCallback, useRef } from 'react';

type Coordinates = [number, number]; // [latitud, longitud]

export interface RouteSection {
  start: number;
  end: number;
  color: string;
  delay: number;
}

interface RouteResult {
  coordinates: Coordinates[];
  distance: number; // en metros
  duration: number; // en segundos
  sections: RouteSection[];
}

const TOMTOM_KEY = process.env.NEXT_PUBLIC_TOMTOM_API_KEY;

// 1. Geocoding: Texto -> Coordenadas (Usando Nominatim / OpenStreetMap)
const geocodeAddress = async (query: string): Promise<Coordinates | null> => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
      const data = await res.json();
      
      if (data && data.length > 0) {
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
  const [waypoints, setWaypoints] = useState<Coordinates[]>([]);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  
  const lastTrafficPosRef = useRef<Coordinates | null>(null);

  const getDist = (p1: Coordinates, p2: Coordinates) => {
    const R = 6371e3;
    const dLat = (p2[0] - p1[0]) * Math.PI / 180;
    const dLon = (p2[1] - p1[1]) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(p1[0]*Math.PI/180)*Math.cos(p2[0]*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  // 2. Routing: TomTom API con Tráfico
  const calculateRoute = useCallback(async (origin: Coordinates, destination: Coordinates, stops: Coordinates[] = []) => {
    if (!TOMTOM_KEY) {
      setRouteError("API Key de TomTom no configurada.");
      return;
    }

    setLoadingRoute(true);
    setRouteError(null);
    try {
      // TomTom usa lon,lat:lon,lat en la URL para calculateRoute
      const allPoints: Coordinates[] = [origin, ...stops, destination];
      const coordStr = allPoints.map(p => `${p[1]},${p[0]}`).join(':');
      
      const url = `https://api.tomtom.com/routing/1/calculateRoute/${coordStr}/json?key=${TOMTOM_KEY}&traffic=true&sectionType=traffic&report=effectiveSettings`;
      
      const res = await fetch(url);
      const data = await res.json();

      if (!data.routes || !data.routes.length) {
        throw new Error('No se pudo encontrar una ruta con TomTom.');
      }

      const mainRoute = data.routes[0];
      const leg = mainRoute.legs[0];
      
      // TomTom devuelve puntos como {latitude, longitude}
      const latLngs: Coordinates[] = leg.points.map((p: any) => [p.latitude, p.longitude]);

      // Mapear secciones de tráfico a colores
      // magnitudeOfDelay: 0=fluido, 1-2=lento, 3=congestión, 4=atasco
      const sections: RouteSection[] = (mainRoute.sections || [])
        .filter((s: any) => s.sectionType === 'TRAFFIC')
        .map((s: any) => {
          let color = '#3b82f6'; // Azul por defecto (si entrara aquí sin ser tráfico)
          const magnitude = s.magnitudeOfDelay || 0;
          
          if (magnitude === 2) color = '#f59e0b'; // Naranja
          else if (magnitude === 3) color = '#ef4444'; // Rojo
          else if (magnitude === 4) color = '#7f1d1d'; // Granate
          
          return {
            start: s.startPointIndex,
            end: s.endPointIndex,
            color,
            delay: s.delayInSeconds || 0
          };
        });

      setRoute({
        coordinates: latLngs,
        distance: mainRoute.summary.lengthInMeters,
        duration: mainRoute.summary.travelTimeInSeconds,
        sections
      });

      setDestination(destination);
      setWaypoints(stops);
      lastTrafficPosRef.current = origin;

    } catch (err: any) {
      setRouteError(err.message || "Error calculando ruta TomTom.");
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
        setRouteError("No he podido encontrar el destino.");
        setLoadingRoute(false);
        return false;
     }

     await calculateRoute(origin, destCoords, []);
     return true;
  }, [calculateRoute]);

  const addWaypointBefore = useCallback(async (origin: Coordinates, newStop: Coordinates) => {
    if (!destination) return;
    const newWaypoints = [...waypoints, newStop];
    await calculateRoute(origin, destination, newWaypoints);
  }, [destination, waypoints, calculateRoute]);

  const addWaypointAfter = useCallback(async (origin: Coordinates, newDestination: Coordinates) => {
    if (!destination) return;
    const newWaypoints = [...waypoints, destination];
    await calculateRoute(origin, newDestination, newWaypoints);
  }, [destination, waypoints, calculateRoute]);

  const clearRoute = useCallback(() => {
     setRoute(null);
     setDestination(null);
     setWaypoints([]);
     setRouteError(null);
     lastTrafficPosRef.current = null;
  }, []);

  // Lógica de refresco cada 20km
  const checkTrafficRefresh = useCallback((currentPos: Coordinates) => {
    if (!route || !destination || !lastTrafficPosRef.current || loadingRoute) return;
    
    const distSinceLastFetch = getDist(currentPos, lastTrafficPosRef.current);
    if (distSinceLastFetch > 20000) {
      console.log("[useRoute] 20km recorridos. Refrescando tráfico TomTom...");
      calculateRoute(currentPos, destination, waypoints);
    }
  }, [route, destination, waypoints, loadingRoute, calculateRoute]);

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
    clearRoute,
    checkTrafficRefresh
  };
}
