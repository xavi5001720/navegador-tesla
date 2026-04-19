'use client';

/**
 * useAircraftSimulator
 * ─────────────────────────────────────────────────────────────────────────────
 * Recibe el array "real" de aeronaves (actualizado cada ~30 s desde OpenSky) y
 * devuelve un array con posiciones extrapoladas que se actualiza cada 1 s.
 *
 * Algoritmo:
 *   1. Extrapolación física: usando velocity (m/s) + track (°) proyectamos la
 *      posición N segundos hacia adelante desde el último dato real.
 *   2. Corrección suave: cuando llegan nuevos datos reales, interpolamos
 *      exponencialmente hacia ellos (tau = 4 s) para evitar saltos visuales.
 *   3. Control de error: si la distancia entre posición simulada y real supera
 *      MAX_DRIFT_M, hacemos reset directo (avión que giró bruscamente).
 */

import { useEffect, useRef, useState } from 'react';
import type { Aircraft } from './usePegasus';
import { SPANISH_AIRPORTS, AIRPORT_LANDING_RADIUS_M } from '@/utils/airports';

// ── Constantes ────────────────────────────────────────────────────────────────
const SIM_TICK_MS   = 1_000;   // tick de simulación (1 s)
const TAU_S         = 4;       // constante de tiempo de la interpolación (s)
const MAX_DRIFT_M   = 5_000;   // umbral de reset directo (m)
const MIN_MOVE_DEG  = 1e-7;    // umbral mínimo para considerar que ha cambiado

// ── Física ────────────────────────────────────────────────────────────────────
// Aproximación plana válida para distancias <100 km
function extrapolate(
  lat      : number,
  lon      : number,
  velocity : number,   // m/s
  track    : number,   // grados desde el norte, sentido horario
  dt       : number    // segundos
): { lat: number; lon: number } {
  if (velocity < 0.5 || dt <= 0) return { lat, lon };
  const trackRad = track * (Math.PI / 180);
  // 1 grado de latitud ≈ 111_111 m
  const dlat = (velocity * Math.cos(trackRad) * dt) / 111_111;
  // 1 grado de longitud ≈ 111_111 * cos(lat) m
  const cosLat = Math.cos(lat * (Math.PI / 180));
  const dlon   = (velocity * Math.sin(trackRad) * dt) / (111_111 * (cosLat || 1));
  return { lat: lat + dlat, lon: lon + dlon };
}

// Haversine simplificado para control de drift (no necesita alta precisión)
function distDegreesApprox(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6_371_000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  return R * Math.sqrt(dLat * dLat + dLon * dLon); // plano → suficientemente preciso aquí
}

// ── Estado interno por aeronave ───────────────────────────────────────────────
interface SimState {
  // Última posición conocida de la API (fuente de verdad)
  realLat   : number;
  realLon   : number;
  realTs    : number;   // timestamp (ms) en que llegó este dato real
  // Posición actualmente mostrada (interpolada)
  simLat    : number;
  simLon    : number;
  // Datos cinéticos (sin cambio entre updates)
  velocity  : number;
  track     : number;
  // Fantasma / Aterrizaje
  lostTs?   : number;   // tiempo (ms) en que lo perdimos
  // Resto de campos Aircraft (se pasan tal cual)
  meta      : Omit<Aircraft, 'lat' | 'lon'>;
}

// ─────────────────────────────────────────────────────────────────────────────
export function useAircraftSimulator(realAircrafts: Aircraft[]): Aircraft[] {
  // Map icao24 → estado simulado
  const simMapRef = useRef<Map<string, SimState>>(new Map());

  // Array que se expone al componente — solo se cambia cuando hay movimiento real
  const [simAircrafts, setSimAircrafts] = useState<Aircraft[]>([]);

  // ── Sincronizar simMap cuando llegan datos reales ─────────────────────────
  useEffect(() => {
    const now = Date.now();
    const map = simMapRef.current;

    // Añadir / actualizar aeronaves del nuevo batch
    const incomingIds = new Set<string>();
    for (const ac of realAircrafts) {
      incomingIds.add(ac.icao24);
      const existing = map.get(ac.icao24);

      if (!existing) {
        // Primera vez que vemos esta aeronave → inicializar directamente
        map.set(ac.icao24, {
          realLat : ac.lat,
          realLon : ac.lon,
          realTs  : now,
          simLat  : ac.lat,
          simLon  : ac.lon,
          velocity: ac.velocity,
          track   : ac.track,
          meta    : { icao24: ac.icao24, callsign: ac.callsign, origin_country: ac.origin_country, altitude: ac.altitude, velocity: ac.velocity, track: ac.track, isSuspect: ac.isSuspect, distanceToUser: ac.distanceToUser },
        });
      } else {
        // Actualizar fuente de verdad y datos cinéticos
        // (la posición simulada sigue con su valor actual — se corregirá en el tick)
        existing.realLat  = ac.lat;
        existing.realLon  = ac.lon;
        existing.realTs   = now;
        existing.velocity = ac.velocity;
        existing.track    = ac.track;
        existing.lostTs   = undefined; // Rescatado de ser fantasma
        existing.meta     = { icao24: ac.icao24, callsign: ac.callsign, origin_country: ac.origin_country, altitude: ac.altitude, velocity: ac.velocity, track: ac.track, isSuspect: ac.isSuspect, distanceToUser: ac.distanceToUser };
      }
    }

    // Identificar fantasmas (aeronaves que ya no están) en lugar de borrar inmediato
    for (const [id, st] of map.entries()) {
      if (!incomingIds.has(id)) {
        if (!st.lostTs) st.lostTs = now; // empezamos cuenta atrás
      }
    }
    
    // Si dejamos de recibir aviones (ej. apagamos botón)
    if (realAircrafts.length === 0 && map.size === 0) {
      setSimAircrafts([]);
    }
  }, [realAircrafts]);

  // ── Tick de simulación (1 s) ──────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const map = simMapRef.current;
      if (map.size === 0) return;

      let changed = false;

      // Preparamos el snapshot para el estado de React
      const next: Aircraft[] = [];

      for (const [id, st] of map) {
        const isNearAirport = SPANISH_AIRPORTS.some(airport => 
          distDegreesApprox(st.realLat, st.realLon, airport.lat, airport.lon) < AIRPORT_LANDING_RADIUS_M
        );

        // Si es fantasma (lo perdimos de vista), le damos 60s de gracia antes de borrarlo
        // para absorber huecos en la señal de OpenSky o lag de red.
        if (st.lostTs) {
          if (now - st.lostTs > 60_000) {
            map.delete(id);
            changed = true;
            continue;
          }
        }

        const dtReal = (now - st.realTs) / 1_000; // segundos desde dato real

        // Detección de aterrizaje activo (aterrizando sobre la pista: baja altura < 50m y en aeropuerto)
        const isLanding = st.meta.altitude < 50 && isNearAirport;
        
        let effectiveVelocity = st.velocity;
        if (st.lostTs || isLanding) {
          // Si lo perdimos en aeropuerto o está aterrizando activamente, lo dejamos aparcado
          effectiveVelocity = 0;
        }

        // 1. Extrapolamos desde la posición REAL con el tiempo transcurrido
        const proj = extrapolate(st.realLat, st.realLon, effectiveVelocity, st.track, dtReal);

        // 2. Calculamos drift entre posición simulada actual y proyección
        const drift = distDegreesApprox(st.simLat, st.simLon, proj.lat, proj.lon);

        let newLat: number;
        let newLon: number;

        if (drift > MAX_DRIFT_M) {
          // Reset directo — el avión se desvió demasiado (giro brusco u outlier)
          newLat = proj.lat;
          newLon = proj.lon;
        } else {
          // Interpolación exponencial suave hacia la proyección
          // Si está aterrizando/fantasma, forzamos un imán inmediato al sitio donde aterrizó
          const alpha = effectiveVelocity === 0 ? 0.2 : (1 - Math.exp(-SIM_TICK_MS / 1_000 / TAU_S));
          newLat = st.simLat + alpha * (proj.lat - st.simLat);
          newLon = st.simLon + alpha * (proj.lon - st.simLon);
        }

        // Detectar si ha cambiado lo suficiente para marcar como dirty
        if (
          Math.abs(newLat - st.simLat) > MIN_MOVE_DEG ||
          Math.abs(newLon - st.simLon) > MIN_MOVE_DEG
        ) {
          changed = true;
        }

        st.simLat = newLat;
        st.simLon = newLon;

        // Solo forzamos 0/0 si realmente estamos tocando tierra o aterrizando en aeropuerto
        const isActuallyAtGround = st.meta.altitude < 50;
        const finalAltitude = (isLanding || (st.lostTs && isActuallyAtGround)) ? 0 : Math.max(0, st.meta.altitude);
        const finalVelocity = (isLanding || (st.lostTs && isActuallyAtGround)) ? 0 : st.meta.velocity;

        next.push({
          ...st.meta,
          lat: newLat,
          lon: newLon,
          altitude: finalAltitude,
          velocity: finalVelocity,
        });
      }

      setSimAircrafts(next);
    };

    const id = setInterval(tick, SIM_TICK_MS);
    return () => clearInterval(id);
   
  }, []);

  return simAircrafts;
}
