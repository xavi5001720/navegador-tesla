import { useState, useCallback, useRef, useEffect } from 'react';
import { findClosestPointOnPolyline, getDistance } from '@/utils/geo';

type Coordinates = [number, number]; // [latitud, longitud]

export interface RouteSection {
  start: number;
  end: number;
  color: string;
  delay: number;
  magnitude: number;
  speedLimit?: number; // km/h
}


export interface Lane {
  directions: string[];
  recommended: boolean;
}

export interface LaneGuidance {
  lanes: Lane[];
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
  laneGuidance?: LaneGuidance;
  exitNumber?: number;
  isRoundabout?: boolean;
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
const fetchRouteTomTom = async (allPoints: Coordinates[], key: string, useTraffic: boolean): Promise<RouteResult> => {
  const coordStr = allPoints.map(p => `${p[0]},${p[1]}`).join(':');
  
  // 1. TomTom prefiere parámetros repetidos para sectionType en lugar de comas
  // 2. Mantenemos departAt=now para tráfico real
  // 3. Eliminamos lanes y laneGuidance por incompatibilidad con el plan de API
  let url = `https://api.tomtom.com/routing/1/calculateRoute/${coordStr}/json?key=${key}&report=effectiveSettings&instructionsType=text&language=es-ES&departAt=now`;
  
  if (useTraffic) {
    url += `&traffic=true&routeType=fastest&sectionType=traffic`;
  }

  const res = await fetch(url);
  
  if (!res.ok) {
    let errorDetail = '';
    try {
      const errorData = await res.json();
      errorDetail = `: ${errorData.formatVersion || ''} ${errorData.error?.description || JSON.stringify(errorData)}`;
    } catch (e) {
      errorDetail = ` (no se pudo leer el cuerpo del error)`;
    }
    throw new Error(`TomTom API error ${res.status}${errorDetail}`);
  }

  const data = await res.json();
  if (!data.routes?.length) throw new Error('TomTom: no se encontró ruta.');

  const mainRoute = data.routes[0];
  const latLngs: Coordinates[] = mainRoute.legs.flatMap((leg: any) =>
    leg.points.map((p: any) => [p.latitude, p.longitude] as Coordinates)
  );

  const TRAFFIC_COLORS: Record<number, string> = {
    0: '#3b82f6',
    1: '#22c55e',
    2: '#f59e0b',
    3: '#ef4444',
    4: '#7f1d1d',
  };

  const sections: RouteSection[] = (mainRoute.sections || [])
    .map((s: any) => {
      const baseSection = {
        start: s.startPointIndex,
        end: s.endPointIndex,
        color: '#3b82f6', // Color por defecto
        delay: s.delayInSeconds || 0,
        magnitude: s.magnitudeOfDelay ?? 0,
      };

      if (s.sectionType === 'TRAFFIC') {
        return {
          ...baseSection,
          color: TRAFFIC_COLORS[s.magnitudeOfDelay ?? 0] ?? '#3b82f6',
        };
      } else if (s.sectionType === 'SPEED_LIMIT') {
        return {
          ...baseSection,
          speedLimit: s.speedLimit?.speed, // km/h (o mph si el locale cambiara, pero TomTom suele dar km/h)
        };
      }
      return null;
    })
    .filter(Boolean) as RouteSection[];


  const instructions: RouteInstruction[] = (mainRoute.guidance?.instructions || [])
    .map((ins: any) => {
      const isRoundabout = ins.maneuver?.includes('ROUNDABOUT');
      return {
        message: ins.message,
        instructionType: ins.instructionType,
        maneuver: ins.maneuver,
        routeOffsetInMeters: ins.routeOffsetInMeters,
        point: [ins.point.latitude, ins.point.longitude] as Coordinates,
        street: ins.street,
        signpostText: ins.signpostText,
        distanceAlongRouteInMeters: ins.routeOffsetInMeters,
        isRoundabout,
        exitNumber: ins.exitNumber,
        laneGuidance: ins.laneGuidance ? {
          lanes: ins.laneGuidance.lanes.map((l: any) => ({
            directions: l.directions,
            recommended: l.recommended
          }))
        } : undefined
      };
    });

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
  const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson&steps=true`);
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes.length) throw new Error('OSRM: no se encontró ruta.');

  const mainRoute = data.routes[0];
  const latLngs: Coordinates[] = mainRoute.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
  if (latLngs.length > 0) latLngs.unshift([...allPoints[0]]);

  // Mapear pasos de OSRM a instrucciones internas
  const instructions: RouteInstruction[] = (mainRoute.legs?.[0]?.steps || []).map((s: any) => {
    const maneuver = s.maneuver.type.toUpperCase();
    const modifier = s.maneuver.modifier?.toUpperCase() || '';
    
    // Mapeo básico de maniobras OSRM a nuestro formato
    let internalManeuver = 'STRAIGHT';
    if (maneuver.includes('TURN')) {
      internalManeuver = modifier.includes('LEFT') ? 'TURN_LEFT' : 'TURN_RIGHT';
    } else if (maneuver.includes('ROUNDABOUT')) {
      internalManeuver = 'ROUNDABOUT';
    }

    return {
      message: s.name ? `Gira en ${s.name}` : (s.maneuver.instruction || 'Continúa recto'),
      instructionType: internalManeuver,
      maneuver: internalManeuver,
      routeOffsetInMeters: s.distance, // Esto es relativo, necesitaremos acumularlo
      point: [s.maneuver.location[1], s.maneuver.location[0]] as Coordinates,
      street: s.name,
      isRoundabout: internalManeuver === 'ROUNDABOUT'
    };
  });

  // Calculamos el offset acumulado para que el contador de distancia funcione correctamente
  let accumulatedOffset = 0;
  instructions.forEach(ins => {
    const originalDist = ins.routeOffsetInMeters;
    ins.routeOffsetInMeters = accumulatedOffset;
    accumulatedOffset += originalDist;
  });

  return {
    coordinates: latLngs,
    distance: mainRoute.distance,
    duration: mainRoute.duration,
    sections: [], // OSRM no da tráfico detallado por tramos en este endpoint
    instructions: instructions,
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
  const [activeLaneGuidance, setActiveLaneGuidance] = useState<LaneGuidance | null>(null);
  const [distanceToNextInstruction, setDistanceToNextInstruction] = useState<number | null>(null);
  const [originalTotalDistance, setOriginalTotalDistance] = useState<number>(0);
  const [originalTotalDuration, setOriginalTotalDuration] = useState<number>(0);

  const lastTrafficPosRef = useRef<Coordinates | null>(null);
  const lastTrafficTimeRef = useRef<number>(0);

  const getDist = (p1: Coordinates, p2: Coordinates) => {
    const R = 6371e3;
    const dLat = (p2[0] - p1[0]) * Math.PI / 180;
    const dLon = (p2[1] - p1[1]) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // Routing principal — TomTom si hay clave, OSRM si no
  const calculateRoute = useCallback(async (origin: Coordinates, destination: Coordinates, stops: Coordinates[] = [], isRecalculation = false, enableTrafficRequested = true) => {
    setLoadingRoute(true);
    setRouteError(null);
    const allPoints: Coordinates[] = [origin, ...stops, destination];

    try {
      let result: RouteResult;

      if (TOMTOM_KEY) {
        try {
          result = await fetchRouteTomTom(allPoints, TOMTOM_KEY, enableTrafficRequested);
          setIsTrafficEnabled(enableTrafficRequested);
          
          if (!isRecalculation) {
            lastTrafficPosRef.current = origin;
            lastTrafficTimeRef.current = Date.now();
          }
          console.log(`[useRoute V2] Ruta con TomTom ✅ (Tráfico: ${enableTrafficRequested ? 'ON' : 'OFF'})`);
        } catch (ttErr) {
          console.warn('[useRoute V2] TomTom falló, usando OSRM:', ttErr);
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
      
      if (!isRecalculation) {
        setOriginalTotalDistance(result.distance);
        setOriginalTotalDuration(result.duration);
      }
    } catch (err: any) {
      setRouteError(err.message || 'Error calculando ruta.');
      setRoute(null);
      setIsTrafficEnabled(false);
    } finally {
      setLoadingRoute(false);
    }
  }, []);

  const findAndTraceRoute = useCallback(async (origin: Coordinates, destinationQuery: string, useTraffic = true) => {
    setLoadingRoute(true);
    setRouteError(null);
    const destCoords = await geocodeAddress(destinationQuery);
    if (!destCoords) {
      setRouteError('No he podido encontrar el destino.');
      setLoadingRoute(false);
      return false;
    }
    await calculateRoute(origin, destCoords, [], false, useTraffic);
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
    setActiveLaneGuidance(null);
    setDistanceToNextInstruction(null);
    setOriginalTotalDistance(0);
    setOriginalTotalDuration(0);
  }, []);

  // Refresco automático de tráfico: cada 30 minutos, pero SOLO si nos hemos movido más de 1km
  const checkTrafficRefresh = useCallback((currentPos: Coordinates) => {
    if (!route || !destination || !lastTrafficPosRef.current || loadingRoute) return;
    
    // Si no tenemos tiempo inicial guardado por alguna razón, usar ahora
    if (!lastTrafficTimeRef.current) lastTrafficTimeRef.current = Date.now();

    const now = Date.now();
    const timeSinceLastFetchMs = now - lastTrafficTimeRef.current;
    
    // Revisamos al pasar 30 minutos (1800000 ms)
    if (timeSinceLastFetchMs > 30 * 60 * 1000) {
      const distSinceLastFetch = getDist(currentPos, lastTrafficPosRef.current);
      
      // Solo lanzamos API si nos hemos alejado al menos 1 kilómetro (1000m)
      if (distSinceLastFetch > 1000) {
        console.log(`[useRoute] 30m superados y 1km recorrido (${Math.round(distSinceLastFetch)}m). Repintando ruta para recaucular tráfico TomTom...`);
        lastTrafficTimeRef.current = now;
        lastTrafficPosRef.current = currentPos;
        calculateRoute(currentPos, destination, waypoints, true, isTrafficEnabled);
      } else {
        // Rearmar el reloj, porque no nos hemos movido (ej: estamos en un atasco inmenso o parados).
        // Así evitamos volver a entrar en esta condición cada segundo a partir del minuto 30.
        lastTrafficTimeRef.current = now;
      }
    }
  }, [route, destination, waypoints, loadingRoute, calculateRoute]);

  // Actualización de métricas en vivo basadas en la posición
  const updateLiveMetrics = useCallback((currentPos: Coordinates) => {
    if (!route || !route.coordinates.length) return;

    // 1. Encontrar el punto más cercano en la polilínea
    const snapped = findClosestPointOnPolyline(currentPos, route.coordinates);
    const idx = snapped.segmentIndex;

    // 2. Calcular distancia restante
    let remainingDist = getDistance(currentPos, route.coordinates[idx + 1] || route.coordinates[idx]);
    for (let i = idx + 1; i < route.coordinates.length - 1; i++) {
      remainingDist += getDistance(route.coordinates[i], route.coordinates[i + 1]);
    }
    setLiveDistance(remainingDist);

    if (route.distance > 0) {
      const ratio = remainingDist / route.distance;
      setLiveDuration(Math.round(route.duration * ratio));
    }

    // 3. Calcular offset actual del usuario
    let currentOffset = 0;
    for (let i = 0; i < idx; i++) {
       currentOffset += getDistance(route.coordinates[i], route.coordinates[i+1]);
    }
    currentOffset += getDistance(route.coordinates[idx], snapped.point);

    // 4. Buscar próxima instrucción con lógica anticipatoria
    const next = route.instructions.find(ins => ins.routeOffsetInMeters > currentOffset + 5); 
    if (next) {
      setNextInstruction(next);
      const distToNext = next.routeOffsetInMeters - currentOffset;
      setDistanceToNextInstruction(distToNext);

      // ACTIVACIÓN INTELIGENTE DE CARRILES (Anticipación 800m)
      if (next.laneGuidance && distToNext < 800) {
        setActiveLaneGuidance(next.laneGuidance);
      } else {
        setActiveLaneGuidance(null);
      }
    } else {
      setNextInstruction(null);
      setDistanceToNextInstruction(null);
      setActiveLaneGuidance(null);
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
    activeLaneGuidance,
    distanceToNextInstruction,
    originalTotalDistance,
    originalTotalDuration,
    calculateRoute,
    findAndTraceRoute,
    addWaypointBefore,
    addWaypointAfter,
    clearRoute,
    checkTrafficRefresh,
    updateLiveMetrics,
  };
}

