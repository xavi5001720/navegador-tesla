import { useState, useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';

const API_URL = '/api/weather';

export interface WeatherPoint {
  id: string; // lat,lon key
  lat: number;
  lon: number;
  temp: number;
  windSpeed: number; // m/s to km/h conversion applied
  description: string;
  condition: string; // Clear, Clouds, Rain, Snow, Thunderstorm
}

// Para calcular la distancia entre dos coordenadas y repartir las llamadas API en puntos de 50km
const getDist = (p1: [number, number], p2: [number, number]) => {
  const R = 6371e3;
  const dLat = (p2[0] - p1[0]) * Math.PI / 180;
  const dLon = (p2[1] - p1[1]) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + 
            Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) * 
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

export function useWeather(userPos: [number, number] | null, routeCoordinates?: [number, number][], isEnabled: boolean = false) {
  const [weatherPoints, setWeatherPoints] = useState<WeatherPoint[]>([]);
  const [loading, setLoading] = useState(false);
  
  // FIX C1: Usar valores primitivos estables como deps en lugar del array
  const routeLength = routeCoordinates?.length ?? 0;
  const routeFirstKey = routeCoordinates?.[0] ? `${routeCoordinates[0][0].toFixed(3)},${routeCoordinates[0][1].toFixed(3)}` : '';
  const routeLastKey = routeLength > 0 ? `${routeCoordinates![routeLength-1][0].toFixed(3)},${routeCoordinates![routeLength-1][1].toFixed(3)}` : '';

  const lastFetchRef = useRef<{ type: 'route' | 'local', pos: [number, number], routeKey: string, timestamp: number } | null>(null);
  const isFetchingRef = useRef(false);

  const fetchWeather = async (pos: [number, number], coords: [number, number][] | undefined, enabled: boolean) => {
    if (!enabled || !pos || isFetchingRef.current) return;

    const hasRoute = coords && coords.length > 0;
    const currentType = hasRoute ? 'route' : 'local';
    const now = Date.now();
    const currentRouteKey = `${routeFirstKey}|${routeLastKey}`;

    // Debounce: si ya fetcheamos hace menos de 15s, no repetir
    const isDebounced = lastFetchRef.current && (now - lastFetchRef.current.timestamp < 15000);
    if (isDebounced) return;

    // No refetch si nada ha cambiado
    if (lastFetchRef.current) {
      const last = lastFetchRef.current;
      if (last.type === currentType && last.routeKey === currentRouteKey) {
        if (currentType === 'route') return; // Ruta igual → no refetch
        if (currentType === 'local' && getDist(last.pos, pos) < 10000) return; // < 10km → no refetch
      }
    }

    isFetchingRef.current = true;

    isFetchingRef.current = true;
    setLoading(true);
    
    const targetPoints: [number, number][] = [];
    
    if (hasRoute && coords) {
      targetPoints.push(coords[0]);
      let currentDist = 0;
      for (let i = 1; i < coords.length - 1; i++) {
        const d = getDist(coords[i - 1], coords[i]);
        currentDist += d;
        if (currentDist >= 50000) {
          targetPoints.push(coords[i]);
          currentDist = 0;
        }
      }
      targetPoints.push(coords[coords.length - 1]);
    } else {
      targetPoints.push(pos);
    }

    try {
      const fetchPromises = targetPoints.map(async (point) => {
        const params = new URLSearchParams({
          lat: point[0].toString(),
          lon: point[1].toString(),
          units: 'metric',
          lang: 'es'
        });
        try {
          const res = await fetch(`${API_URL}?${params.toString()}`);
          if (!res.ok) {
            logger.error('useWeather', `Error API OWM: ${res.status} ${res.statusText}`);
            return null;
          }
          const data = await res.json();
          if (data && data.main) {
            return {
              id: `${point[0].toFixed(3)},${point[1].toFixed(3)}`,
              lat: point[0],
              lon: point[1],
              temp: data.main.temp,
              windSpeed: data.wind?.speed ? data.wind.speed * 3.6 : 0,
              description: data.weather[0].description,
              condition: data.weather[0].main
            } as WeatherPoint;
          }
          return null;
        } catch (err) {
          logger.error('useWeather', 'Error en fetch individual de punto', err);
          return null;
        }
      });

      const results = await Promise.all(fetchPromises);
      const validResults = results.filter(r => r !== null) as WeatherPoint[];
      setWeatherPoints(validResults);
      lastFetchRef.current = { type: currentType, pos, routeKey: currentRouteKey, timestamp: Date.now() };
      logger.info('useWeather', `${validResults.length} puntos meteorológicos cargados.`);
    } catch (err) {
      logger.error('useWeather', 'Error fatal conectando con OWM', err);
      // Anotamos timestamp para el debounce incluso en error
      lastFetchRef.current = { type: currentType, pos, routeKey: currentRouteKey, timestamp: Date.now() };
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  // FIX C1: El fetch reactivo usa valores primitivos como deps (no el array entero)
  useEffect(() => {
    if (!isEnabled) {
      setWeatherPoints([]);
      lastFetchRef.current = null;
      return;
    }
    if (!userPos) return;

    fetchWeather(userPos, routeCoordinates, isEnabled);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPos?.[0], userPos?.[1], isEnabled, routeLength, routeFirstKey, routeLastKey]);

  // FIX C1: El auto-refresh de 30min está en un useEffect SEPARADO con deps estables
  // Así no se acumulan múltiples timers cuando cambia la ruta o la posición
  useEffect(() => {
    if (!isEnabled || !userPos) return;

    const intervalId = setInterval(() => {
      // Forzamos refetch limpiando el timestamp
      lastFetchRef.current = null;
      fetchWeather(userPos, routeCoordinates, isEnabled);
    }, 1800000); // 30 minutos

    return () => clearInterval(intervalId);
  // Este effect SOLO depende de isEnabled para evitar re-crear el timer
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnabled]);

  return { weatherPoints, loadingWeather: loading, currentWeather: weatherPoints[0] || null };
}
