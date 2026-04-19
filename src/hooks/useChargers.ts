import { useState, useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';

export interface ChargerFilters {
  isFree?: boolean;
  connectors?: ('ccs' | 'tipo2' | 'enchufe')[];
  minPower?: number; // 0 for all, 50, 150, etc.
}

export interface Charger {
  id: number;
  lat: number;
  lon: number;
  title: string;
  address: string;
  operator: string;
  usageCost: string;
  maxPower: number;
  connections: any[];
}

const CONSTANTS = {
  CHUNK_DISTANCE_M: 50000,
  BASE_URL: '/api/chargers',
  CONNECTOR_MAP: {
    'ccs': '33,32',
    'tipo2': '25,1036',
    'enchufe': '28'
  }
};

const getDist = (p1: [number, number], p2: [number, number]) => {
  const R = 6371e3;
  const dLat = (p2[0] - p1[0]) * Math.PI / 180;
  const dLon = (p2[1] - p1[1]) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
};

function encodePolyline(coordinates: [number, number][]) {
  let result = '';
  let prevLat = 0;
  let prevLon = 0;

  for (let i = 0; i < coordinates.length; i++) {
    const lat = Math.round(coordinates[i][0] * 1e5);
    const lon = Math.round(coordinates[i][1] * 1e5);
    const dLat = lat - prevLat;
    const dLon = lon - prevLon;
    prevLat = lat;
    prevLon = lon;

    const encode = (value: number) => {
      value = value < 0 ? ~(value << 1) : value << 1;
      let chunk = '';
      while (value >= 0x20) {
        chunk += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
        value >>= 5;
      }
      chunk += String.fromCharCode(value + 63);
      return chunk;
    };
    result += encode(dLat) + encode(dLon);
  }
  return result;
}

function isFreeCharger(costStr: string | null | undefined): boolean {
  if (!costStr) return true;
  const s = costStr.toLowerCase();
  if (s.includes('free') || s.includes('gratis') || s.includes('sin coste') || s.includes('0.00') || s.includes('0,00')) return true;
  if (s.includes('€') || s.includes('$') || s.includes('£') || s.includes('0,') || s.includes('0.') || s.match(/[1-9],/) || s.includes('kw') || s.includes('min') || s.match(/[0-9] céntimos/)) return false;
  return true;
}

export function useChargers(userPos: [number, number] | null, routeCoordinates?: [number, number][], isEnabled: boolean = false, filters: ChargerFilters = {}) {
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const lastFetchRef = useRef<{ type: 'route'|'local', pos: [number, number], routeKey: string, filtersStr: string } | null>(null);

  const routeLength = routeCoordinates?.length ?? 0;
  const routeFirstKey = routeCoordinates?.[0] ? `${routeCoordinates[0][0].toFixed(4)},${routeCoordinates[0][1].toFixed(4)}` : '';
  const routeLastKey = routeLength > 0 ? `${routeCoordinates![routeLength-1][0].toFixed(4)},${routeCoordinates![routeLength-1][1].toFixed(4)}` : '';
  const filtersStr = JSON.stringify(filters);

  useEffect(() => {
    if (!isEnabled || !userPos) {
      if (!isEnabled && chargers.length > 0) {
        setChargers([]);
      }
      return;
    }

    const hasRoute = routeCoordinates && routeLength > 0;
    const currentType = hasRoute ? 'route' : 'local';
    const currentRouteKey = `${routeFirstKey}|${routeLastKey}`;

    let shouldFetch = false;
    if (!lastFetchRef.current) {
      shouldFetch = true;
    } else if (lastFetchRef.current.type !== currentType) {
      shouldFetch = true;
    } else if (currentType === 'route' && lastFetchRef.current.routeKey !== currentRouteKey) {
      shouldFetch = true;
    } else if (lastFetchRef.current.filtersStr !== filtersStr) {
      shouldFetch = true;
    } else if (currentType === 'local') {
      const dist = getDist(lastFetchRef.current.pos, userPos);
      if (dist > 5000 || chargers.length === 0) {
        shouldFetch = true;
      }
    }

    const fetchChargers = async () => {
      setLoading(true);
      logger.groupCollapsed('⚡ useChargers', `Iniciando búsqueda (${hasRoute ? 'Modo Ruta' : 'Modo Local'})`);
      logger.time('⏱️ Fetch Cargadores');
      logger.info('useChargers', 'Filtros activos', filters);

      if (hasRoute) {
        setProgress(0);
        setChargers([]);
      }

      try {
        const params = new URLSearchParams({
          distanceunit: 'KM',
          maxresults: '250'
        });

        if (filters.minPower && filters.minPower > 0) {
          params.append('minpowerkw', filters.minPower.toString());
        }

        if (filters.connectors && filters.connectors.length > 0) {
          const ids = filters.connectors.map(c => CONSTANTS.CONNECTOR_MAP[c]).join(',');
          params.append('connectiontypeid', ids);
        }

        if (hasRoute && routeCoordinates) {
          const chunks: [number, number][][] = [];
          let currentChunk: [number, number][] = [routeCoordinates[0]];
          let currentDist = 0;

          for (let i = 1; i < routeCoordinates.length; i++) {
            const d = getDist(routeCoordinates[i-1], routeCoordinates[i]);
            currentDist += d;
            currentChunk.push(routeCoordinates[i]);
            if (currentDist >= CONSTANTS.CHUNK_DISTANCE_M) {
              chunks.push(currentChunk);
              currentChunk = [routeCoordinates[i]];
              currentDist = 0;
            }
          }
          if (currentChunk.length > 1) chunks.push(currentChunk);

          const uniqueIds = new Set<number>();
          const accumulated: Charger[] = [];

          for (let i = 0; i < chunks.length; i++) {
            const polyline = encodePolyline(chunks[i]);
            params.set('polyline', polyline);
            params.set('distance', '5');
            
            const chunkRes = await fetch(`${CONSTANTS.BASE_URL}?${params.toString()}`);
            const data = await chunkRes.json();
            
            if (Array.isArray(data)) {
                data.forEach(c => {
                  if (filters.isFree && !isFreeCharger(c.UsageCost)) return;
                  if (!uniqueIds.has(c.ID)) {
                    uniqueIds.add(c.ID);
                    const power = c.Connections?.reduce((max: number, conn: any) => Math.max(max, conn.PowerKW || 0), 0) || 0;
                    accumulated.push({
                      id: c.ID,
                      lat: c.AddressInfo.Latitude,
                      lon: c.AddressInfo.Longitude,
                      title: c.AddressInfo.Title,
                      address: c.AddressInfo.AddressLine1 || c.AddressInfo.Town || 'Ubicación Desconocida',
                      operator: c.OperatorInfo?.Title || 'Operador Desconocido',
                      usageCost: c.UsageCost || (filters.isFree ? 'Gratuito' : 'Desconocido'),
                      maxPower: power,
                      connections: c.Connections || []
                    });
                  }
                });
                setChargers([...accumulated]);
              }
            setProgress(Math.round(((i + 1) / chunks.length) * 100));
          }
        } else {
          params.set('latitude', userPos[0].toString());
          params.set('longitude', userPos[1].toString());
          params.set('distance', '15');
          
          const res = await fetch(`${CONSTANTS.BASE_URL}?${params.toString()}`);
          const data = await res.json();
          
          if (Array.isArray(data)) {
            const parsed: Charger[] = [];
            data.forEach(c => {
               if (filters.isFree && !isFreeCharger(c.UsageCost)) return;
               const power = c.Connections?.reduce((max: number, conn: any) => Math.max(max, conn.PowerKW || 0), 0) || 0;
               parsed.push({
                  id: c.ID, lat: c.AddressInfo.Latitude, lon: c.AddressInfo.Longitude,
                  title: c.AddressInfo.Title, address: c.AddressInfo.AddressLine1 || c.AddressInfo.Town || 'Ubicación Desconocida',
                  operator: c.OperatorInfo?.Title || 'Operador Desconocido',
                  usageCost: c.UsageCost || (filters.isFree ? 'Gratuito' : 'Desconocido'),
                  maxPower: power, connections: c.Connections || []
               });
            });
            setChargers(parsed);
        }
        
        logger.timeEnd('⏱️ Fetch Cargadores');
        logger.group('📊 Resumen de Cargadores');
        logger.table({
          'Total Encontrados': chargers.length,
          'Carga Rápida (>50kW)': chargers.filter(c => c.maxPower >= 50).length,
          'Ultra Rápida (>150kW)': chargers.filter(c => c.maxPower >= 150).length,
          'Solo Gratuitos': filters.isFree ? 'SÍ' : 'NO'
        });
        logger.groupEnd();
        logger.groupEnd();

        lastFetchRef.current = { type: currentType, pos: userPos, routeKey: currentRouteKey, filtersStr };
      } catch (err) {
        console.error('[useChargers] fetchChargers Error:', err);
        logger.error('useChargers', 'Error al cargar cargadores', err);
      } finally {
        setLoading(false);
      }
    };

    fetchChargers();
  }, [userPos?.[0], userPos?.[1], isEnabled, routeLength, routeFirstKey, routeLastKey, filtersStr]);

  const refreshChargers = () => {
    lastFetchRef.current = null;
    setChargers(prev => [...prev]); 
  };

  return { chargers, loading, progress, refreshChargers };
}
