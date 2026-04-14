import { useState, useEffect, useRef } from 'react';
import { Radar } from './useRadars';
import { playRadarAlert, VoiceType } from '@/utils/sound';
import { getDistance } from '@/utils/geo';

// FIX I7: Eliminada la función Haversine local duplicada. Se importa de utils/geo.

export function useAlerts(
  userPos: [number, number] | null,
  radars: Radar[],
  isSoundEnabled: boolean = true,
  voiceType: VoiceType = 'mujer',
  currentSpeed: number = 0
) {
  const [nearestRadar, setNearestRadar] = useState<Radar | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isAlertActive, setIsAlertActive] = useState(false);
  const [alertType, setAlertType] = useState<'safe' | 'danger'>('safe');
  const [passedRadarIds, setPassedRadarIds] = useState<Set<string>>(new Set());
  
  const prevDistanceRef = useRef<number | null>(null);
  
  // Ref para controlar el estado de alerta actual por radar sin re-renders excesivos
  const alertStateRef = useRef<{ radarId: string | null; phase: number; lastDangerAlertTime: number }>({
    radarId: null,
    phase: 0,
    lastDangerAlertTime: 0
  });

  // Ref con los IDs de la última lista de radares conocida
  const knownRadarIdsRef = useRef<string>('');

  // Cuando cambia el conjunto de radares (nueva ruta), reseteamos los radares "pasados"
  useEffect(() => {
    const currentIds = radars.map(r => String(r.id)).sort().join(',');
    if (currentIds !== knownRadarIdsRef.current) {
      knownRadarIdsRef.current = currentIds;
      setPassedRadarIds(new Set());
      prevDistanceRef.current = null;
      alertStateRef.current = { radarId: null, phase: 0, lastDangerAlertTime: 0 };
    }
  }, [radars]);

  // FIX C2: Eliminado `isAlertActive` de las dependencias para cortar el bucle infinito.
  // El estado de alerta se gestiona sólo a través de refs y solo se escribe al estado cuando cambia.
  useEffect(() => {
    if (!userPos || radars.length === 0) {
      setIsAlertActive(false);
      return;
    }

    // Filtramos radares que ya hemos pasado
    const pendingRadars = radars.filter(r => !passedRadarIds.has(String(r.id)));
    
    if (pendingRadars.length === 0) {
      setIsAlertActive(false);
      return;
    }

    let minDistance = Infinity;
    let closestRadar: Radar | null = null;

    pendingRadars.forEach(radar => {
      const dist = getDistance(userPos, [radar.lat, radar.lon]);
      if (dist < minDistance) {
        minDistance = dist;
        closestRadar = radar;
      }
    });

    setNearestRadar(closestRadar);
    
    // Lógica de auto-descarte: si ya pasamos el radar (nos alejamos tras estar muy cerca)
    if (prevDistanceRef.current !== null && closestRadar) {
       if (minDistance > prevDistanceRef.current && prevDistanceRef.current < 100) {
          const radarId = String((closestRadar as Radar).id);
          setPassedRadarIds(prev => {
             const next = new Set(prev);
             next.add(radarId);
             return next;
          });
          setIsAlertActive(false);
          prevDistanceRef.current = null;
          return;
       }
    }
    
    prevDistanceRef.current = minDistance;
    setDistance(minDistance);

    // Activamos alerta si está a menos de 500 metros
    if (minDistance < 500 && closestRadar) {
      const isOverLimit = currentSpeed > ((closestRadar as Radar).speedLimit || 120);
      const type = isOverLimit ? 'danger' : 'safe';
      setAlertType(type);
      
      const radarId = String((closestRadar as Radar).id);
      const state = alertStateRef.current;
      
      // Si el radar cambia, reseteamos el estado de alerta
      if (state.radarId !== radarId) {
        state.radarId = radarId;
        state.phase = 0;
        state.lastDangerAlertTime = 0;
      }

      const now = Date.now();

      if (isSoundEnabled) {
         if (isOverLimit) {
            // Peligro permanente: Alerta repetitiva cada 5 segundos si sigue corriendo
            if (now - state.lastDangerAlertTime > 5000) {
               playRadarAlert(voiceType, 'danger');
               state.lastDangerAlertTime = now;
            }
         } else {
            // Velocidad segura: 2 fases (Aviso a <500m y aviso a <200m)
            if (state.phase === 0) {
               playRadarAlert(voiceType, 'safe_first');
               state.phase = 1;
            } else if (state.phase === 1 && minDistance < 200) {
               playRadarAlert(voiceType, 'safe_second');
               state.phase = 2;
            }
         }
      }
      
      setIsAlertActive(true);
    } else {
      setIsAlertActive(false);
    }

  // FIX C2: `isAlertActive` eliminado de las deps — era la causa del bucle infinito.
  }, [userPos, radars, isSoundEnabled, voiceType, currentSpeed, passedRadarIds]);

  const remainingRadars = Math.max(0, radars.length - passedRadarIds.size);
  return { nearestRadar, distance, isAlertActive, alertType, remainingRadars };
}
