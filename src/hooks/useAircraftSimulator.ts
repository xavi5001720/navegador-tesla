'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import type { Aircraft } from './usePegasus';
import { SPANISH_AIRPORTS, AIRPORT_LANDING_RADIUS_M } from '@/utils/airports';

const SIM_TICK_MS   = 1_000;
const TAU_S         = 4;
const MAX_DRIFT_M   = 5_000;
const MIN_MOVE_DEG  = 1e-7;

function extrapolate(lat: number, lon: number, velocity: number, track: number, dt: number) {
  if (velocity < 0.5 || dt <= 0) return { lat, lon };
  const trackRad = track * (Math.PI / 180);
  const dlat = (velocity * Math.cos(trackRad) * dt) / 111_111;
  const cosLat = Math.cos(lat * (Math.PI / 180));
  const dlon = (velocity * Math.sin(trackRad) * dt) / (111_111 * (cosLat || 1));
  return { lat: lat + dlat, lon: lon + dlon };
}

function distDegreesApprox(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6_371_000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  return R * Math.sqrt(dLat * dLat + dLon * dLon);
}

interface SimState {
  realLat: number; realLon: number; realTs: number;
  simLat: number; simLon: number;
  velocity: number; track: number;
  lostTs?: number;
  meta: Omit<Aircraft, 'lat' | 'lon'>;
}

export function useAircraftSimulator(realAircrafts: Aircraft[]): Aircraft[] {
  const simMapRef = useRef<Map<string, SimState>>(new Map());
  const [simAircraftsState, setSimAircraftsState] = useState<Aircraft[]>([]);
  
  // Guardamos los datos reales en un Ref para que el Tick los procese de forma asíncrona
  const realAircraftsRef = useRef<Aircraft[]>(realAircrafts);
  useEffect(() => {
    realAircraftsRef.current = realAircrafts;
  }, [realAircrafts]);

  // 1. DERIVACIÓN (Reactiva)
  // Devolvemos el estado simulado. El Tick se encarga de vaciarlo si no hay aviones.
  const effectiveAircrafts = simAircraftsState;

  // 2. TICK DE SIMULACIÓN: Aquí es donde ocurre la impureza controlada
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const map = simMapRef.current;
      const latestReal = realAircraftsRef.current;

      // Sincronizar datos reales con el mapa interno
      const incomingIds = new Set<string>();
      for (const ac of latestReal) {
        incomingIds.add(ac.icao24);
        const existing = map.get(ac.icao24);
        if (!existing) {
          map.set(ac.icao24, {
            realLat: ac.lat, realLon: ac.lon, realTs: now,
            simLat: ac.lat, simLon: ac.lon,
            velocity: ac.velocity, track: ac.track,
            meta: { ...ac },
          });
        } else {
          existing.realLat = ac.lat; existing.realLon = ac.lon; existing.realTs = now;
          existing.velocity = ac.velocity; existing.track = ac.track;
          existing.lostTs = undefined;
          existing.meta = { ...ac };
        }
      }

      // Procesar simulación y limpieza
      if (map.size === 0) {
        setSimAircraftsState([]);
        return;
      }

      const next: Aircraft[] = [];
      for (const [id, st] of map) {
        // Marcar como fantasma si ya no está en el batch real
        if (!incomingIds.has(id) && !st.lostTs) {
          st.lostTs = now;
        }

        if (st.lostTs && now - st.lostTs > 60_000) {
          map.delete(id);
          continue;
        }

        const isNearAirport = SPANISH_AIRPORTS.some(airport => 
          distDegreesApprox(st.realLat, st.realLon, airport.lat, airport.lon) < AIRPORT_LANDING_RADIUS_M
        );

        const dtReal = (now - st.realTs) / 1_000;
        const isLanding = st.meta.altitude < 50 && isNearAirport;
        const effectiveVelocity = (st.lostTs || isLanding) ? 0 : st.velocity;

        const proj = extrapolate(st.realLat, st.realLon, effectiveVelocity, st.track, dtReal);
        const drift = distDegreesApprox(st.simLat, st.simLon, proj.lat, proj.lon);

        let newLat, newLon;
        if (drift > MAX_DRIFT_M) {
          newLat = proj.lat; newLon = proj.lon;
        } else {
          const alpha = effectiveVelocity === 0 ? 0.2 : (1 - Math.exp(-SIM_TICK_MS / 1_000 / TAU_S));
          newLat = st.simLat + alpha * (proj.lat - st.simLat);
          newLon = st.simLon + alpha * (proj.lon - st.simLon);
        }

        st.simLat = newLat; st.simLon = newLon;
        const isActuallyAtGround = st.meta.altitude < 50;
        const finalAltitude = (isLanding || (st.lostTs && isActuallyAtGround)) ? 0 : Math.max(0, st.meta.altitude);
        const finalVelocity = (isLanding || (st.lostTs && isActuallyAtGround)) ? 0 : st.meta.velocity;

        next.push({
          ...st.meta,
          lat: newLat, lon: newLon,
          altitude: finalAltitude, velocity: finalVelocity,
        });
      }

      setSimAircraftsState(next);
    };

    const id = setInterval(tick, SIM_TICK_MS);
    return () => clearInterval(id);
  }, []);

  return effectiveAircrafts;
}
