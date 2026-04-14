import { useState, useEffect, useRef } from 'react';
import { Radar, RadarZone } from './useRadars';
import { playRadarAlert, VoiceType } from '@/utils/sound';
import { getDistance } from '@/utils/geo';

// Helper to get angle difference (0 to 180)
function getHeadingDiff(heading1: number, heading2: number) {
  let diff = Math.abs(heading1 - heading2) % 360;
  return diff > 180 ? 360 - diff : diff;
}

export function useAlerts(
  userPos: [number, number] | null,
  radars: Radar[],
  isSoundEnabled: boolean = true,
  voiceType: VoiceType = 'mujer',
  currentSpeed: number = 0,
  carHeading: number = 0,
  radarZones: RadarZone[] = [],
  audioMode: 'voice' | 'beep' = 'voice'
) {
  const [nearestRadar, setNearestRadar] = useState<Radar | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isAlertActive, setIsAlertActive] = useState(false);
  const [alertType, setAlertType] = useState<'safe' | 'danger'>('safe');
  const [passedRadarIds, setPassedRadarIds] = useState<Set<string>>(new Set());
  
  const prevDistanceRef = useRef<number | null>(null);

  // Section radar state
  const [inSectionRadar, setInSectionRadar] = useState(false);
  const [sectionAverageSpeed, setSectionAverageSpeed] = useState<number | null>(null);
  
  // Ref para controlar el estado de alerta actual por radar
  const alertStateRef = useRef<{ radarId: string | null; phase: number; lastDangerAlertTime: number }>({
    radarId: null,
    phase: 0,
    lastDangerAlertTime: 0
  });

  // Variables para la máquina de estados de los radares de tramo
  const sectionStateRef = useRef<{
    active: boolean;
    startPoint: [number, number] | null;
    startTime: number | null;
    lastDistanceToEndpoint: number;
  }>({
    active: false,
    startPoint: null,
    startTime: null,
    lastDistanceToEndpoint: Infinity
  });

  // Ref con los IDs de la última lista conocida + zonas móviles
  const knownRadarIdsRef = useRef<string>('');
  const passedZoneIdsRef = useRef<Set<string>>(new Set());

  // Cuando cambia el conjunto de radares reseteamos los radares "pasados"
  useEffect(() => {
    const currentIds = radars.map(r => String(r.id)).sort().join(',');
    if (currentIds !== knownRadarIdsRef.current) {
      knownRadarIdsRef.current = currentIds;
      setPassedRadarIds(new Set());
      alertStateRef.current = { radarId: null, phase: 0, lastDangerAlertTime: 0 };
    }
  }, [radars]);

  useEffect(() => {
    if (!userPos) {
      setIsAlertActive(false);
      return;
    }

    // 1. GESTIÓN DE ZONAS DE RADAR MÓVIL (Zonas de control históricas)
    if (radarZones && radarZones.length > 0) {
      const now = Date.now();
      radarZones.forEach(zone => {
        if (passedZoneIdsRef.current.has(String(zone.id))) return;
        const distToZone = getDistance(userPos, [zone.lat, zone.lon]);
        
        // Si entramos en la zona de probabilidad (con margen)
        if (distToZone < zone.radius) {
           passedZoneIdsRef.current.add(String(zone.id));
           // Alerta acústica sutil (bloop o voz de prevención)
           if (isSoundEnabled) {
              playRadarAlert(voiceType, 'info', 'mobile_zone', audioMode);
           }
        }
      });
    }

    // 2. GESTIÓN DE RADARES FIJOS / CÁMARAS / TRAMO
    if (radars.length === 0) {
      setIsAlertActive(false);
      return;
    }

    const pendingRadars = radars.filter(r => !passedRadarIds.has(String(r.id)));
    if (pendingRadars.length === 0) {
      setIsAlertActive(false);
      return;
    }

    const { minDistance, closestRadar } = pendingRadars.reduce(
      (acc, radar) => {
        // Filtro de Validación Comunitaria
        if (radar.type === 'community_mobile') {
          // Si no es visible para todos (necesita validación) 
          // y no somos el creador (en el frontend no sabemos 100% si somos el creador aquí,
          // pero el hook useRadars ya filtra para que solo veamos lo visible o lo nuestro)
          if (!radar.is_visible && radar.category === 'mobile_radar') {
            return acc;
          }
        }

        // Filtro Direccional ALGEBRAICO 
        if (typeof radar.direction === 'number') {
          const diff = getHeadingDiff(carHeading, radar.direction);
          if (diff > 60) return acc;
        }

        const dist = getDistance(userPos, [radar.lat, radar.lon]);
        if (dist < acc.minDistance) {
          return { minDistance: dist, closestRadar: radar };
        }
        return acc;
      },
      { minDistance: Infinity, closestRadar: null as Radar | null }
    );

    if (!closestRadar) {
      setNearestRadar(null);
      setIsAlertActive(false);
      return;
    }

    setNearestRadar(closestRadar);
    setDistance(minDistance);

    // Auto-descarte por inercia: Si la distancia al más cercano empieza a subir, lo hemos cruzado.
    if (alertStateRef.current.radarId === String(closestRadar.id)) {
        if (minDistance > (prevDistanceRef.current ?? Infinity) && minDistance <= 150) {
           const radarId = String(closestRadar.id);
           setPassedRadarIds(prev => new Set(prev).add(radarId));
           setIsAlertActive(false);
           prevDistanceRef.current = null;
           
           // Si el radar cruzado era 'section', arrancamos el cronómetro del tramo
           if (closestRadar.type === 'section') {
             sectionStateRef.current = {
               active: true,
               startPoint: userPos,
               startTime: Date.now(),
               lastDistanceToEndpoint: Infinity // Reset to find next section
             };
             setInSectionRadar(true);
           }
           return;
        }
    }
    
    // Cálculo Dinámico de Distancia de Aviso
    // A >100km/h avisar a 800m. A 50km/h avisar a 300m.
    const warningDistance = currentSpeed > 100 ? 800 : (currentSpeed > 60 ? 500 : 300);

    // Activamos alerta
    if (minDistance < warningDistance && closestRadar) {
      const limit = closestRadar.speedLimit || 120;
      const isOverLimit = currentSpeed > limit;
      const type = isOverLimit ? 'danger' : 'safe';
      setAlertType(type);
      
      const radarId = String(closestRadar.id);
      const state = alertStateRef.current;
      
      if (state.radarId !== radarId) {
        state.radarId = radarId;
        state.phase = 0;
        state.lastDangerAlertTime = 0;
      }

      const now = Date.now();

      if (isSoundEnabled) {
         if (isOverLimit) {
            // Peligro por velocidad: Alerta persistente cada 5 segundos si sigues pasándote (Cooldown)
            if (now - state.lastDangerAlertTime > 5000) {
               playRadarAlert(voiceType, 'danger', closestRadar.type as any, audioMode);
               state.lastDangerAlertTime = now;
            }
         } else {
            // Velocidad segura: Escalonado
            if (state.phase === 0) {
               playRadarAlert(voiceType, 'safe_first', closestRadar.type as any, audioMode);
               state.phase = 1;
            } else if (state.phase === 1 && minDistance < warningDistance / 2) {
               playRadarAlert(voiceType, 'safe_second', closestRadar.type as any, audioMode);
               state.phase = 2;
            }
         }
      }
      
      setIsAlertActive(true);
    } else {
      setIsAlertActive(false);
    }

    // Guardar referencia
    if (closestRadar) {
      prevDistanceRef.current = minDistance;
    }

    // 3. MÁQUINA DE ESTADOS - RADARES DE TRAMO EN TIEMPO REAL
    if (sectionStateRef.current.active && sectionStateRef.current.startPoint && sectionStateRef.current.startTime) {
      const now = Date.now();
      const timeElapsedMs = now - sectionStateRef.current.startTime;
      // Convertir ms a horas
      const timeElapsedH = timeElapsedMs / 1000 / 3600;
      
      // Distancia recorrida desde el inicio del túnel/tramo (línea recta aproxima curva por ahora)
      const distanceTraveledKm = getDistance(sectionStateRef.current.startPoint, userPos) / 1000;
      
      // Si el vehículo aún no se ha movido o ha pasado medio segundo, evitamos picos irreales
      if (timeElapsedH > 0.001) {
         const avgSpeed = distanceTraveledKm / timeElapsedH;
         setSectionAverageSpeed(Math.round(avgSpeed));
      }

      // Desactivación del tramo: Timeout de seguridad (10 minutos) o si hemos avanzado más de 15km
      if (timeElapsedH * 60 > 10 || distanceTraveledKm > 15) {
        sectionStateRef.current.active = false;
        setInSectionRadar(false);
        setSectionAverageSpeed(null);
      }
      // Note: El tramo se podría desactivar también al detectar físicamente otra cámara "section" cercana (fin).
    }

  }, [userPos, radars, radarZones, isSoundEnabled, voiceType, currentSpeed, carHeading, passedRadarIds, audioMode]);

  const remainingRadars = Math.max(0, radars.length - passedRadarIds.size);
  return { 
    nearestRadar, distance, isAlertActive, alertType, remainingRadars,
    inSectionRadar, sectionAverageSpeed
  };
}
