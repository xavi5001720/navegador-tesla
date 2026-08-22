import { useState, useEffect, useRef, useMemo } from 'react';
import { Radar, RadarZone } from './useRadars';
import { playRadarAlert, isVoiceSpeaking, VoiceType, AlertPreferences } from '@/utils/sound';
import { getDistance } from '@/utils/geo';

function getHeadingDiff(heading1: number, heading2: number) {
  const diff = Math.abs(heading1 - heading2) % 360;
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
  audioMode: 'voice' | 'beep' = 'voice',
  alertPreferences?: AlertPreferences
) {
  const [passedRadarIds, setPassedRadarIds] = useState<Set<string>>(new Set());
  const [inSectionRadar, setInSectionRadar] = useState(false);
  const [sectionAverageSpeed, setSectionAverageSpeed] = useState<number | null>(null);
  
  // Sincronización reactiva: Resetear si cambian los radares (Sin usar Refs en render)
  const currentRadarsKey = useMemo(() => radars.map(r => String(r.id)).sort().join(','), [radars]);
  const [prevRadarsKey, setPrevRadarsKey] = useState(currentRadarsKey);

  if (currentRadarsKey !== prevRadarsKey) {
    setPassedRadarIds(new Set());
    setPrevRadarsKey(currentRadarsKey);
  }

  const prevDistanceRef = useRef<number | null>(null);
  const alertStateRef = useRef<{ radarId: string | null; phase: number; lastDangerAlertTime: number }>({
    radarId: null, phase: 0, lastDangerAlertTime: 0
  });

  const sectionStateRef = useRef<{
    active: boolean; startPoint: [number, number] | null; startTime: number | null;
  }>({ active: false, startPoint: null, startTime: null });

  const passedZoneIdsRef = useRef<Set<string>>(new Set());

  // 1. CÁLCULO DERIVADO
  const { nearestRadar, distance, isAlertActive, alertType, timeSeconds } = useMemo(() => {
    if (!userPos || radars.length === 0) {
      return { nearestRadar: null, distance: null, isAlertActive: false, alertType: 'safe' as const, timeSeconds: 0 };
    }

    const pendingRadars = radars.filter(r => !passedRadarIds.has(String(r.id)));
    if (pendingRadars.length === 0) {
      return { nearestRadar: null, distance: null, isAlertActive: false, alertType: 'safe' as const, timeSeconds: 0 };
    }

    const { minDistance, closestRadar } = pendingRadars.reduce(
      (acc, radar) => {
        if (radar.type === 'community_mobile' && !radar.is_visible && radar.category === 'mobile_radar') return acc;
        
        // FILTRO 1: Rumbo / Heading (ángulo de avance)
        if (typeof radar.direction === 'number') {
          if (getHeadingDiff(carHeading, radar.direction) > 45) return acc;
        }

        // FILTRO 2: Anti-Falsos Positivos Vías Paralelas / Servicio
        const limit = radar.speedLimit || 120;
        if (limit === 30 && currentSpeed > 80) return acc;
        if (limit === 50 && currentSpeed > 100) return acc;
        if (limit === 60 && currentSpeed > 115) return acc;

        const dist = getDistance(userPos, [radar.lat, radar.lon]);
        return dist < acc.minDistance ? { minDistance: dist, closestRadar: radar } : acc;
      },
      { minDistance: Infinity, closestRadar: null as Radar | null }
    );

    if (!closestRadar) {
      return { nearestRadar: null, distance: null, isAlertActive: false, alertType: 'safe' as const, timeSeconds: 0 };
    }

    // Zona de alerta dinámica: 60 segundos al límite del radar
    const limit = closestRadar.speedLimit || 120;
    const limitMs = limit / 3.6;
    const alertRadius = limitMs * 60; // 1 minuto al límite
    const isAlertActive = minDistance <= alertRadius;
    const alertType = currentSpeed > limit ? ('danger' as const) : ('safe' as const);

    // timeSeconds basado en velocidad actual real (para info)
    const effectiveSpeedKmh = Math.max(currentSpeed, 40);
    const calculatedTimeSeconds = minDistance / (effectiveSpeedKmh / 3.6);

    return { nearestRadar: closestRadar, distance: minDistance, isAlertActive, alertType, timeSeconds: calculatedTimeSeconds };
  }, [userPos, radars, passedRadarIds, carHeading, currentSpeed]);

  // 2. EFECTOS SECUNDARIOS
  useEffect(() => {
    if (!userPos || !nearestRadar || distance === null) return;

    if (alertStateRef.current.radarId === String(nearestRadar.id)) {
      if (distance > (prevDistanceRef.current ?? Infinity) && distance <= 150) {
        const radarId = String(nearestRadar.id);
        
        // Mover a microtask para evitar renderizado en cascada síncrono
        Promise.resolve().then(() => {
          setPassedRadarIds(prev => new Set(prev).add(radarId));
          if (nearestRadar.type === 'section') {
            sectionStateRef.current = { active: true, startPoint: userPos, startTime: Date.now() };
            setInSectionRadar(true);
          }
        });
        
        prevDistanceRef.current = null;
        return;
      }
    }
    prevDistanceRef.current = distance;

    if (isAlertActive && isSoundEnabled) {
      const now = Date.now();
      const state = alertStateRef.current;
      const radarId = String(nearestRadar.id);
      const radarType = nearestRadar.type as 'fixed' | 'mobile' | 'section' | 'camera' | 'community_mobile';

      if (state.radarId !== radarId) {
        state.radarId = radarId; state.phase = 0; state.lastDangerAlertTime = 0;
      }

      // Filtrado por categorías
      const isFixedCategory = ['fixed', 'section', 'camera'].includes(radarType);
      const isMobileCategory = ['mobile', 'community_mobile'].includes(radarType);
      
      const shouldSpeak = (isFixedCategory && alertPreferences?.fixedRadars) || 
                          (isMobileCategory && alertPreferences?.mobileRadars);

      if (!shouldSpeak) return;

      if (alertType === 'danger') {
        // En exceso de velocidad: repetir aviso corto cada 10 segundos
        if (now - state.lastDangerAlertTime > 10000) {
          playRadarAlert(voiceType, 'danger', radarType, audioMode, nearestRadar.speedLimit, distance, currentSpeed);
          state.lastDangerAlertTime = now;
        }
      } else {
        // Distancias dinámicas basadas en el límite del radar (60s / 30s / 15s)
        const limitKmh = nearestRadar.speedLimit || 120;
        const limitMs = limitKmh / 3.6;
        const dist1 = limitMs * 60; // 1 minuto = 1er aviso
        const dist2 = limitMs * 30; // 30 segundos = 2º aviso
        const dist3 = limitMs * 15; // 15 segundos = 3er aviso (al pasar)

        // Fase 0 (1er aviso: al entrar en zona, distancia <= dist1)
        if (state.phase === 0) {
          playRadarAlert(voiceType, 'safe_first', radarType, audioMode, nearestRadar.speedLimit, distance, currentSpeed);
          state.phase = 1;
          state.lastDangerAlertTime = now;
        }
        // Fase 1 (2º aviso: al llegar a 30s del radar)
        else if (state.phase === 1 && distance <= dist2) {
          playRadarAlert(voiceType, 'safe_second', radarType, audioMode, nearestRadar.speedLimit, distance, currentSpeed);
          state.phase = 2;
          state.lastDangerAlertTime = now;
        }
        // Fase 2 (3er aviso: al llegar a 15s del radar, mínimo 5s desde el aviso anterior)
        else if (state.phase === 2 && distance <= dist3 && (now - state.lastDangerAlertTime > 5000)) {
          playRadarAlert(voiceType, 'safe_passing', radarType, audioMode, nearestRadar.speedLimit, undefined, currentSpeed);
          state.phase = 3;
        }
      }
    }
  }, [userPos, nearestRadar, distance, isAlertActive, alertType, isSoundEnabled, voiceType, audioMode, currentSpeed, timeSeconds, alertPreferences]);

  useEffect(() => {
    if (!userPos) return;

    radarZones.forEach(zone => {
      if (passedZoneIdsRef.current.has(String(zone.id))) return;
      const dist = getDistance(userPos, [zone.lat, zone.lon]);
      if (dist < zone.radius) {
        passedZoneIdsRef.current.add(String(zone.id));
        if (isSoundEnabled && alertPreferences?.mobileRadars) {
          playRadarAlert(voiceType, 'info', 'mobile_zone', audioMode, undefined, dist, currentSpeed);
        }
      }
    });

    if (sectionStateRef.current.active && sectionStateRef.current.startPoint && sectionStateRef.current.startTime) {
      const timeElapsedH = (Date.now() - sectionStateRef.current.startTime) / 3600000;
      const distanceTraveledKm = getDistance(sectionStateRef.current.startPoint, userPos) / 1000;
      
      if (timeElapsedH > 0.0001) {
        Promise.resolve().then(() => setSectionAverageSpeed(Math.round(distanceTraveledKm / timeElapsedH)));
      }
      if (timeElapsedH * 60 > 15 || distanceTraveledKm > 20) {
        sectionStateRef.current.active = false;
        Promise.resolve().then(() => {
          setInSectionRadar(false);
          setSectionAverageSpeed(null);
        });
      }
    }
  }, [userPos, radarZones, isSoundEnabled, voiceType, audioMode]);

  const remainingRadars = Math.max(0, radars.length - passedRadarIds.size);

  return { 
    nearestRadar, distance, isAlertActive, alertType, remainingRadars,
    inSectionRadar, sectionAverageSpeed
  };
}
