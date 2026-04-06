import { useState, useEffect, useRef } from 'react';

// Usando nueva key OWM: teslaapp
const API_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY || 'd78521d9d03fc712e2a7ec84c6b58de2';
const API_URL = 'https://api.openweathermap.org/data/2.5/weather';

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
  
  const lastFetchRef = useRef<{ type: 'route' | 'local', pos: [number, number], routeLength: number, timestamp: number } | null>(null);

  const routeLength = routeCoordinates?.length ?? 0;

  useEffect(() => {
    if (!isEnabled || !userPos) {
      if (!isEnabled) {
        if (weatherPoints.length > 0) setWeatherPoints([]);
        lastFetchRef.current = null; // Permite refetch al volver a activar
      }
      return;
    }

    const hasRoute = routeCoordinates && routeCoordinates.length > 0;
    const currentType = hasRoute ? 'route' : 'local';
    const now = Date.now();

    let shouldFetch = false;
    
    // Evitar spam si ha fallado recientemente (debounce de 15 segundos)
    const isDebounced = lastFetchRef.current && (now - lastFetchRef.current.timestamp < 15000);

    if (isDebounced) {
      shouldFetch = false;
    } else if (!lastFetchRef.current) {
      shouldFetch = true;
    } else if (lastFetchRef.current.type !== currentType) {
      shouldFetch = true;
    } else if (currentType === 'route' && lastFetchRef.current.routeLength !== routeLength) {
      shouldFetch = true;
    } else if (currentType === 'local') {
      const dist = getDist(lastFetchRef.current.pos, userPos);
      if (dist > 10000) shouldFetch = true; // Auto refresh cada 10km que el coche avance sin ruta
    } else if (weatherPoints.length === 0 && !loading && (now - lastFetchRef.current.timestamp > 30000)) {
      // Si tenemos estado validado vacío (fallo previo) y han pasado 30 segs, reintentar
      shouldFetch = true;
    }

    if (!shouldFetch) return;

    const fetchWeather = async () => {
      setLoading(true);
      
      const targetPoints: [number, number][] = [];
      
      if (hasRoute && routeCoordinates) {
        // En ruta: muestreo cada 50km
        targetPoints.push(routeCoordinates[0]); // Siempre el punto actual
        let currentDist = 0;
        for (let i = 1; i < routeCoordinates.length - 1; i++) {
          const d = getDist(routeCoordinates[i - 1], routeCoordinates[i]);
          currentDist += d;
          if (currentDist >= 50000) { // 50km
            targetPoints.push(routeCoordinates[i]);
            currentDist = 0;
          }
        }
        // Siempre añadimos el destino final
        targetPoints.push(routeCoordinates[routeCoordinates.length - 1]);
      } else {
        // Modo local
        targetPoints.push(userPos);
      }

      try {
        if (!API_KEY) {
          console.warn('[useWeather] ⚠️ No se detectó la NEXT_PUBLIC_OPENWEATHER_API_KEY en las variables de entorno.');
        }
        
        const fetchPromises = targetPoints.map(async (point) => {
          const params = new URLSearchParams({
            lat: point[0].toString(),
            lon: point[1].toString(),
            appid: API_KEY,
            units: 'metric',
            lang: 'es'
          });
          const res = await fetch(`${API_URL}?${params.toString()}`);
          
          if (!res.ok) {
            console.error(`[useWeather] ❌ Error en la API de OWM: ${res.status} ${res.statusText}`);
            return null;
          }

          const data = await res.json();
          if (data && data.main) {
            return {
              id: `${point[0].toFixed(3)},${point[1].toFixed(3)}`,
              lat: point[0],
              lon: point[1],
              temp: data.main.temp,
              windSpeed: data.wind.speed * 3.6, // m/s a km/h
              description: data.weather[0].description,
              condition: data.weather[0].main // Clear, Clouds, Rain...
            } as WeatherPoint;
          }
          return null;
        });

        const results = await Promise.all(fetchPromises);
        const validResults = results.filter(r => r !== null) as WeatherPoint[];
        
        setWeatherPoints(validResults);
        lastFetchRef.current = { type: currentType, pos: userPos, routeLength, timestamp: Date.now() };

      } catch (err) {
        console.error('[useWeather] ❌ Error fatal al conectar con OWM:', err);
        lastFetchRef.current = { type: currentType, pos: userPos, routeLength, timestamp: Date.now() };
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
    
    // Auto-refresh timer for weather data (every 30 mins)
    const intervalId = setInterval(() => {
      fetchWeather();
    }, 1800000);

    return () => clearInterval(intervalId);

  }, [userPos, isEnabled, routeCoordinates, routeLength]);

  return { weatherPoints, loadingWeather: loading, currentWeather: weatherPoints[0] || null };
}
