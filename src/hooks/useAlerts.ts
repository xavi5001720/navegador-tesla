import { useState, useEffect, useRef } from 'react';
import { Radar } from './useRadars';

// Fórmula de Haversine para distancia en metros entre dos puntos
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Radio de la tierra en metros
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

export function useAlerts(
  userPos: [number, number] | null, 
  radars: Radar[], 
  isSoundEnabled: boolean = true, 
  alertVolume: number = 0.5,
  currentSpeed: number = 0
) {
  const [nearestRadar, setNearestRadar] = useState<Radar | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isAlertActive, setIsAlertActive] = useState(false);
  const [alertType, setAlertType] = useState<'safe' | 'danger'>('safe');
  const [passedRadarIds, setPassedRadarIds] = useState<Set<string>>(new Set());
  
  const prevDistanceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!userPos || radars.length === 0) return;

    // Filtramos radares que ya hemos pasado
    const pendingRadars = radars.filter(r => !passedRadarIds.has(String(r.id)));
    
    if (pendingRadars.length === 0) {
      setIsAlertActive(false);
      return;
    }

    let minDistance = Infinity;
    let closestRadar: Radar | null = null;

    pendingRadars.forEach(radar => {
      const dist = getDistance(userPos[0], userPos[1], radar.lat, radar.lon);
      if (dist < minDistance) {
        minDistance = dist;
        closestRadar = radar;
      }
    });

    setNearestRadar(closestRadar);
    
    // Lógica de auto-descarte
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

      if (!isAlertActive) {
         if (isSoundEnabled) {
            playAlertSound(alertVolume, type);
         }
      }
      setIsAlertActive(true);
    } else {
      setIsAlertActive(false);
    }

  }, [userPos, radars, isSoundEnabled, alertVolume, currentSpeed, passedRadarIds, isAlertActive]);

  const playAlertSound = (volume: number, type: 'safe' | 'danger') => {
    if (typeof window !== 'undefined') {
      try {
        const isDanger = type === 'danger';
        
        // Voz diferenciada
        const msg = isDanger ? 'Peligro, exceso de velocidad en radar' : 'Atención, radar próximo';
        const utterance = new SpeechSynthesisUtterance(msg);
        utterance.lang = 'es-ES';
        utterance.volume = volume;
        utterance.pitch = isDanger ? 1.2 : 1; 
        window.speechSynthesis.speak(utterance);

        // Sonido diferenciado
        const audioUrl = isDanger 
          ? 'https://actions.google.com/sounds/v1/alarms/alarm_clock_beeping.ogg' // Más urgente
          : 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg';
        
        const audio = new Audio(audioUrl);
        audio.volume = volume;
        audio.play().catch(e => console.warn("Audio play blocked by browser:", e));
      } catch (err) {
        console.error("Error playing alert sound:", err);
      }
    }
  };

  return { nearestRadar, distance, isAlertActive, alertType, remainingRadars: radars.length - passedRadarIds.size };
}
