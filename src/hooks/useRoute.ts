import { useState, useCallback, useRef, useEffect } from 'react';
import { findClosestPointOnPolyline, getDistance } from '@/utils/geo';

type Coordinates = [number, number]; // [latitud, longitud]

export interface RouteSection {
  start: number;
  end: number;
  color: string;
  delay: number;
  magnitude: number;
}

export interface RouteInstruction {
  message: string;
  instructionType: string;
  maneuver: string;
  routeOffsetInMeters: number;
  point: Coordinates;
  street?: string;
  signpostText?: string;
  distanceAlongRouteInMeters?: number;
}

interface RouteResult {
  coordinates: Coordinates[];
  distance: number; // en metros
  duration: number; // en segundos
  sections: RouteSection[];
  instructions: RouteInstruction[];
}

const TOMTOM_KEY = process.env.NEXT_PUBLIC_TOMTOM_API_KEY;

// Geocoding: Texto -> Coordenadas (Nominatim / OpenStreetMap)
const geocodeAddress = async (query: string): Promise<Coordinates | null> => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
    const data = await res.json();
    if (data && data.length > 0) {
      return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    }
    return null;
  } catch (err) {
    console.error('Geocoding Error:', err);
    return null;
  }
};

// Ruta con TomTom (tráfico en tiempo real)
const fetchRouteTomTom = async (allPoints: Coordinates[], key: string): Promise<RouteResult> => {
  // TomTom espera lat,lon en la URL (al contrario que OSRM que espera lon,lat)
  const coordStr = allPoints.map(p => `${p[0]},${p[1]}`).join(':');
  const url = `https://api.tomtom.com/routing/1/calculateRoute/${coordStr}/json?key=${key}&traffic=true&sectionType=traffic&report=effectiveSettings&instructionsType=text&language=es-ES`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TomTom API error: ${res.status}`);
  const data = await res.json();
  if (!data.routes?.length) throw new Error('TomTom: no se encontró ruta.');

  const mainRoute = data.routes[0];
  const latLngs: Coordinates[] = mainRoute.legs.flatMap((leg: any) =>
    leg.points.map((p: any) => [p.latitude, p.longitude] as Coordinates)
  );

  // Colores según magnitudeOfDelay (0-4)
  const TRAFFIC_COLORS: Record<number, string> = {
    0: '#3b82f6', // Fluido — Azul
    1: '#22c55e', // Muy lento — Verde
    2: '#f59e0b', // Lento — Naranja
    3: '#ef4444', // Congestión — Rojo
    4: '#7f1d1d', // Atasco total — Granate
  };

  const sections: RouteSection[] = (mainRoute.sections || [])
    .filter((s: any) => s.sectionType === 'TRAFFIC')
    .map((s: any) => ({
      start: s.startPointIndex,
      end: s.endPointIndex,
      color: TRAFFIC_COLORS[s.magnitudeOfDelay ?? 0] ?? '#3b82f6',
      delay: s.delayInSeconds || 0,
      magnitude: s.magnitudeOfDelay ?? 0,
    }));

  const instructions: RouteInstruction[] = (mainRoute.guidance?.instructions || [])
    .map((ins: any) => ({
      message: ins.message,
      instructionType: ins.instructionType,
      maneuver: ins.maneuver,
      routeOffsetInMeters: ins.routeOffsetInMeters,
      point: [ins.point.latitude, ins.point.longitude] as Coordinates,
      street: ins.street,
      signpostText: ins.signpostText,
      distanceAlongRouteInMeters: ins.routeOffsetInMeters
    }));

  return {
    coordinates: latLngs,
    distance: mainRoute.summary.lengthInMeters,
    duration: mainRoute.summary.travelTimeInSeconds,
    sections,
    instructions,
  };
};

// Ruta con OSRM (sin tráfico — fallback gratuito)
const fetchRouteOSRM = async (allPoints: Coordinates[]): Promise<RouteResult> => {
  const coordStr = allPoints.map(p => `${p[1]},${p[0]}`).join(';');
  const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`);
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes.length) throw new Error('OSRM: no se encontró ruta.');

  const mainRoute = data.routes[0];
  const latLngs: Coordinates[] = mainRoute.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
  if (latLngs.length > 0) latLngs.unshift([...allPoints[0]]);

  return {
    coordinates: latLngs,
    distance: mainRoute.distance,
    duration: mainRoute.duration,
    sections: [], // Sin tráfico
    instructions: [], // Sin instrucciones detalladas en OSRM por ahora
  };
};

export function useRoute() {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [destination, setDestination] = useState<Coordinates | null>(null);
  const [waypoints, setWaypoints] = useState<Coordinates[]>([]);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [isTrafficEnabled, setIsTrafficEnabled] = useState<boolean>(false);
  const [liveDistance, setLiveDistance] = useState<number | null>(null);
  const [liveDuration, setLiveDuration] = useState<number | null>(null);
  const [nextInstruction, setNextInstruction] = useState<RouteInstruction | null>(null);
  const [distanceToNextInstruction, setDistanceToNextInstruction] = useState<number | null>(null);

  const lastTrafficPosRef = useRef<Coordinates | null>(null);

  const getDist = (p1: Coordinates, p2: Coordinates) => {
    const R = 6371e3;
    const dLat = (p2[0] - p1[0]) * Math.PI / 180;
    const dLon = (p2[1] - p1[1]) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // Routing principal — TomTom si hay clave, OSRM si no
  const calculateRoute = useCallback(async (origin: Coordinates, destination: Coordinates, stops: Coordinates[] = []) => {
    setLoadingRoute(true);
    setRouteError(null);
    const allPoints: Coordinates[] = [origin, ...stops, destination];

    try {
      let result: RouteResult;

      if (TOMTOM_KEY) {
        try {
          result = await fetchRouteTomTom(allPoints, TOMTOM_KEY);
          setIsTrafficEnabled(true);
          lastTrafficPosRef.current = origin;
          console.log('[useRoute] Ruta con TomTom ✅ (tráfico activo)');
        } catch (ttErr) {
          console.warn('[useRoute] TomTom falló, usando OSRM:', ttErr);
          result = await fetchRouteOSRM(allPoints);
          setIsTrafficEnabled(false);
        }
      } else {
        console.log('[useRoute] Sin clave TomTom, usando OSRM.');
        result = await fetchRouteOSRM(allPoints);
        setIsTrafficEnabled(false);
      }

      setRoute(result);
      setLiveDistance(result.distance);
      setLiveDuration(result.duration);
      setDestination(destination);
      setWaypoints(stops);
    } catch (err: any) {
      setRouteError(err.message || 'Error calculando ruta.');
      setRoute(null);
      setIsTrafficEnabled(false);
    } finally {
      setLoadingRoute(false);
    }
  }, []);

  const findAndTraceRoute = useCallback(async (origin: Coordinates, destinationQuery: string) => {
    setLoadingRoute(true);
    setRouteError(null);
    const destCoords = await geocodeAddress(destinationQuery);
    if (!destCoords) {
      setRouteError('No he podido encontrar el destino.');
      setLoadingRoute(false);
      return false;
    }
    await calculateRoute(origin, destCoords, []);
    return true;
  }, [calculateRoute]);

  const addWaypointBefore = useCallback(async (origin: Coordinates, newStop: Coordinates) => {
    if (!destination) return;
    await calculateRoute(origin, destination, [...waypoints, newStop]);
  }, [destination, waypoints, calculateRoute]);

  const addWaypointAfter = useCallback(async (origin: Coordinates, newDestination: Coordinates) => {
    if (!destination) return;
    await calculateRoute(origin, newDestination, [...waypoints, destination]);
  }, [destination, waypoints, calculateRoute]);

  const clearRoute = useCallback(() => {
    setRoute(null);
    setDestination(null);
    setWaypoints([]);
    setRouteError(null);
    setIsTrafficEnabled(false);
    lastTrafficPosRef.current = null;
    setLiveDistance(null);
    setLiveDuration(null);
    setNextInstruction(null);
    setDistanceToNextInstruction(null);
  }, []);

  // Refresco automático de tráfico cada 20km
  const checkTrafficRefresh = useCallback((currentPos: Coordinates) => {
    if (!route || !destination || !lastTrafficPosRef.current || loadingRoute) return;
    const distSinceLastFetch = getDist(currentPos, lastTrafficPosRef.current);
    if (distSinceLastFetch > 20000) {
      console.log('[useRoute] 20km recorridos — refrescando tráfico TomTom...');
      calculateRoute(currentPos, destination, waypoints);
    }
  }, [route, destination, waypoints, loadingRoute, calculateRoute]);

  // Actualización de métricas en vivo basadas en la posición
  const updateLiveMetrics = useCallback((currentPos: Coordinates) => {
    if (!route || !route.coordinates.length) return;

    // 1. Encontrar el punto más cercano en la polilínea
    const snapped = findClosestPointOnPolyline(currentPos, route.coordinates);
    const idx = snapped.segmentIndex;

    // 2. Calcular distancia restante: 
    // Comienza desde la posición actual "proyectada" hasta el siguiente vértice, 
    // y suma todos los segmentos restantes.
    let remainingDist = getDistance(currentPos, route.coordinates[idx + 1] || route.coordinates[idx]);
    
    for (let i = idx + 1; i < route.coordinates.length - 1; i++) {
      remainingDist += getDistance(route.coordinates[i], route.coordinates[i + 1]);
    }

    setLiveDistance(remainingDist);

    // 3. Estimar duración restante
    // Mantenemos la proporción del tiempo original de la API de TomTom
    // Si la API decía 10km en 10 min, y ahora faltan 5km, estimamos 5 min.
    if (route.distance > 0) {
      const ratio = remainingDist / route.distance;
      setLiveDuration(Math.round(route.duration * ratio));
    }

    // 4. Encontrar la próxima instrucción
    // Calculamos el offset actual del usuario en la ruta (distancia acumulada hasta 'snapped')
    let currentOffset = 0;
    for (let i = 0; i < idx; i++) {
       currentOffset += getDistance(route.coordinates[i], route.coordinates[i+1]);
    }
    // Sumamos el tramo fraccional desde el último vértice hasta el 'snapped'
    currentOffset += getDistance(route.coordinates[idx], snapped.point);

    const next = route.instructions.find(ins => ins.routeOffsetInMeters > currentOffset + 10); // +10m de margen
    if (next) {
      setNextInstruction(next);
      setDistanceToNextInstruction(next.routeOffsetInMeters - currentOffset);
    } else {
      setNextInstruction(null);
      setDistanceToNextInstruction(null);
    }
  }, [route]);

  return {
    route,
    destination,
    waypoints,
    loadingRoute,
    routeError,
    isTrafficEnabled,
    liveDistance,
    liveDuration,
    nextInstruction,
    distanceToNextInstruction,
    calculateRoute,
    findAndTraceRoute,
    addWaypointBefore,
    addWaypointAfter,
    clearRoute,
    checkTrafficRefresh,
    updateLiveMetrics,
  };
}
