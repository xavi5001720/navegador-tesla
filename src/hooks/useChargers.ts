import { useState, useEffect, useRef, useMemo } from 'react';
import { logger } from '@/lib/logger';

export interface ChargerFilters {
  isFree?: boolean;
  connectors?: ('ccs' | 'tipo2' | 'enchufe' | 'chademo')[];
  minPower?: number;
}

export interface Charger {
  id: number; lat: number; lon: number; title: string; address: string;
  operator: string; usageCost: string; maxPower: number; connections: any[];
}

const CONSTANTS = {
  CHUNK_DISTANCE_M: 50000,
  BASE_URL: '/api/chargers',
  CONNECTOR_MAP: { 'ccs': '33,32', 'tipo2': '25,1036', 'enchufe': '28', 'chademo': '2' }
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
  let prevLat = 0, prevLon = 0;
  for (let i = 0; i < coordinates.length; i++) {
    const lat = Math.round(coordinates[i][0] * 1e5), lon = Math.round(coordinates[i][1] * 1e5);
    const dLat = lat - prevLat, dLon = lon - prevLon;
    prevLat = lat; prevLon = lon;
    const encode = (v: number) => {
      v = v < 0 ? ~(v << 1) : v << 1;
      let chunk = '';
      while (v >= 0x20) { chunk += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; }
      chunk += String.fromCharCode(v + 63); return chunk;
    };
    result += encode(dLat) + encode(dLon);
  }
  return result;
}

function isFreeCharger(costStr: string | null | undefined, apiIsFree: boolean | null | undefined): boolean {
  // 1. Sanitización y preparación
  const s = (costStr || '').toLowerCase();
  
  // 2. Prioridad Absoluta a la Lista Blanca (Short-circuit)
  // Si detectamos términos de gratuidad, aprobamos inmediatamente (evita falsos positivos con '0€')
  const whiteList = ['gratis', 'free', '0.00', '0,00', '0€', '0 €', 'sin coste'];
  if (whiteList.some(k => s.includes(k))) return true;

  // 3. Evaluación de la Lista Negra (Solo si falló la Blanca)
  // Si la API dice explícitamente que se paga en el sitio (apiIsFree es false) -> Bloqueamos
  if (apiIsFree === false) return false;

  // Si el texto contiene términos de pago -> Bloqueamos
  const blackList = ['€', 'kwh', 'min', 'pago', 'precio', 'tarifa'];
  if (blackList.some(k => s.includes(k))) return false;

  // 4. Regla de Relajación para Nulos / API Confirmada
  // Si no hay texto de coste pero la API confirma que NO es de pago -> Aprobamos
  if (apiIsFree === true) return true;

  // Caso por defecto: Si no hay info o es ambigua (y no pasó la blanca), bloqueamos por seguridad
  return false;
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
      if (!isEnabled && chargers.length > 0) setChargers([]);
      return;
    }

    const hasRoute = routeLength > 0;
    const currentType = hasRoute ? 'route' : 'local';
    const currentRouteKey = `${routeFirstKey}|${routeLastKey}`;

    let shouldFetch = false;
    if (!lastFetchRef.current || lastFetchRef.current.type !== currentType || lastFetchRef.current.filtersStr !== filtersStr) {
      shouldFetch = true;
    } else if (currentType === 'route' && lastFetchRef.current.routeKey !== currentRouteKey) {
      shouldFetch = true;
    } else if (currentType === 'local' && getDist(lastFetchRef.current.pos, userPos) > 5000) {
      shouldFetch = true;
    }

    if (!shouldFetch) return;

    const fetchChargers = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ distanceunit: 'KM', maxresults: '250' });
        if (filters.minPower) params.append('minpowerkw', filters.minPower.toString());
        const accumulated: Charger[] = [];
        if (hasRoute && routeCoordinates) {
          const chunks: [number, number][][] = [];
          for (let i = 0; i < routeCoordinates.length; i += 100) chunks.push(routeCoordinates.slice(i, i + 105));
          const uniqueIds = new Set<number>();
          for (let i = 0; i < chunks.length; i++) {
            params.set('polyline', encodePolyline(chunks[i]));
            params.set('distance', '1');
            const res = await fetch(`${CONSTANTS.BASE_URL}?${params.toString()}`);
            const data = await res.json();
            if (Array.isArray(data)) {
              data.forEach(c => {
                if (!uniqueIds.has(c.ID)) {
                  uniqueIds.add(c.ID);
                  const power = c.Connections?.reduce((max: number, conn: any) => Math.max(max, conn.PowerKW || 0), 0) || 0;
                  accumulated.push({ 
                    id: c.ID, 
                    lat: c.AddressInfo.Latitude, 
                    lon: c.AddressInfo.Longitude, 
                    title: c.AddressInfo.Title, 
                    address: c.AddressInfo.AddressLine1 || 'Ubicación', 
                    operator: c.OperatorInfo?.Title || 'Desconocido', 
                    usageCost: c.UsageCost || 'Desconocido', 
                    maxPower: power, 
                    connections: c.Connections || [] 
                  });
                }
              });

              // Embudo de Filtrado Estricto (Stage 1 & 2)
              const selectedConnectorIds = filters.connectors?.flatMap(c => CONSTANTS.CONNECTOR_MAP[c].split(',').map(Number)) || [];

              const finalData = accumulated.filter(charger => {
                // REGLA 1: Tipo de Conector (AND obligatorio si hay seleccionados)
                if (selectedConnectorIds.length > 0) {
                  const hasConnector = charger.connections.some((conn: any) => selectedConnectorIds.includes(conn.ConnectionTypeID));
                  if (!hasConnector) return false;
                }

                // REGLA 2: Gratuidad (AND obligatorio si el toggle está activo)
                if (filters.isFree) {
                  const original = data.find(oc => oc.ID === charger.id);
                  const isFree = isFreeCharger(charger.usageCost, original?.UsageType?.IsPayAtLocation === false);
                  if (!isFree) return false;
                }

                return true;
              });

              setChargers([...finalData]);
            }
          }
        } else {
          params.set('latitude', userPos[0].toString()); params.set('longitude', userPos[1].toString()); params.set('distance', '15');
          const res = await fetch(`${CONSTANTS.BASE_URL}?${params.toString()}`);
          const data = await res.json();
            if (Array.isArray(data)) {
              data.forEach(c => {
                const power = c.Connections?.reduce((max: number, conn: any) => Math.max(max, conn.PowerKW || 0), 0) || 0;
                accumulated.push({ id: c.ID, lat: c.AddressInfo.Latitude, lon: c.AddressInfo.Longitude, title: c.AddressInfo.Title, address: c.AddressInfo.AddressLine1 || 'Ubicación', operator: c.OperatorInfo?.Title || 'Desconocido', usageCost: c.UsageCost || 'Desconocido', maxPower: power, connections: c.Connections || [] });
              });
              
              // Embudo de Filtrado Estricto para modo Local
              const selectedConnectorIds = filters.connectors?.flatMap(c => CONSTANTS.CONNECTOR_MAP[c].split(',').map(Number)) || [];

              const finalData = accumulated.filter(charger => {
                if (selectedConnectorIds.length > 0) {
                  const hasConnector = charger.connections.some((conn: any) => selectedConnectorIds.includes(conn.ConnectionTypeID));
                  if (!hasConnector) return false;
                }
                if (filters.isFree) {
                  const original = data.find(oc => oc.ID === charger.id);
                  const isFree = isFreeCharger(charger.usageCost, original?.UsageType?.IsPayAtLocation === false);
                  if (!isFree) return false;
                }
                return true;
              });
              
              setChargers(finalData);
            }
        }
        lastFetchRef.current = { type: currentType, pos: userPos, routeKey: hasRoute ? currentRouteKey : 'LOCAL', filtersStr };
      } catch (err) {
        logger.error('useChargers', 'Error cargadores', err);
      } finally { setLoading(false); }
    };
    fetchChargers();
  }, [isEnabled, routeFirstKey, routeLastKey, filtersStr, (routeLength === 0 ? Math.floor((userPos?.[0] || 0) * 20) + ',' + Math.floor((userPos?.[1] || 0) * 20) : '0')]);

  return useMemo(() => ({ 
    chargers, 
    loading, 
    progress, 
    refreshChargers: () => { lastFetchRef.current = null; setChargers(prev => [...prev]); } 
  }), [chargers, loading, progress]);
}
