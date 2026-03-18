import { useState, useEffect } from 'react';
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

export function useAlerts(userPos: [number, number] | null, radars: Radar[]) {
  const [nearestRadar, setNearestRadar] = useState<Radar | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isAlertActive, setIsAlertActive] = useState(false);

  useEffect(() => {
    if (!userPos || radars.length === 0) return;

    let minDistance = Infinity;
    let closest: Radar | null = null;

    radars.forEach(radar => {
      const dist = getDistance(userPos[0], userPos[1], radar.lat, radar.lon);
      if (dist < minDistance) {
        minDistance = dist;
        closest = radar;
      }
    });

    setNearestRadar(closest);
    setDistance(minDistance);

    // Activamos alerta si está a menos de 500 metros
    if (minDistance < 500) {
      if (!isAlertActive) {
         // Aquí podríamos lanzar un sonido
         playAlertSound();
      }
      setIsAlertActive(true);
    } else {
      setIsAlertActive(false);
    }

  }, [userPos, radars]);

  const playAlertSound = () => {
    // Solo si el navegador lo permite (interacción previa necesaria)
    if (typeof window !== 'undefined') {
      const utterance = new SpeechSynthesisUtterance('Atención, radar próximo');
      utterance.lang = 'es-ES';
      window.speechSynthesis.speak(utterance);
    }
  };

  return { nearestRadar, distance, isAlertActive };
}
