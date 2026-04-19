import { useState, useEffect, useRef, useMemo } from 'react';
import { Radar, RadarZone } from './useRadars';
import { playRadarAlert, VoiceType } from '@/utils/sound';
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
  audioMode: 'voice' | 'beep' = 'voice'
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
  const { nearestRadar, distance, isAlertActive, alertType } = useMemo(() => {
    if (!userPos || radars.length === 0) {
      return { nearestRadar: null, distance: null, isAlertActive: false, alertType: 'safe' as const };
    }

    const pendingRadars = radars.filter(r => !passedRadarIds.has(String(r.id)));
    if (pendingRadars.length === 0) {
      return { nearestRadar: null, distance: null, isAlertActive: false, alertType: 'safe' as const };
    }

    const { minDistance, closestRadar } = pendingRadars.reduce(
      (acc, radar) => {
        if (radar.type === 'community_mobile' && !radar.is_visible && radar.category === 'mobile_radar') return acc;
        if (typeof radar.direction === 'number') {
          if (getHeadingDiff(carHeading, radar.direction) > 60) return acc;
        }
        const dist = getDistance(userPos, [radar.lat, radar.lon]);
        return dist < acc.minDistance ? { minDistance: dist, closestRadar: radar } : acc;
      },
      { minDistance: Infinity, closestRadar: null as Radar | null }
    );

    if (!closestRadar) {
      return { nearestRadar: null, distance: null, isAlertActive: false, alertType: 'safe' as const };
    }

    const warningDistance = currentSpeed > 100 ? 800 : (currentSpeed > 60 ? 500 : 300);
    const isAlertActive = minDistance < warningDistance;
    const limit = closestRadar.speedLimit || 120;
    const alertType = currentSpeed > limit ? ('danger' as const) : ('safe' as const);

    return { nearestRadar: closestRadar, distance: minDistance, isAlertActive, alertType };
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

      if (alertType === 'danger') {
        if (now - state.lastDangerAlertTime > 5000) {
          playRadarAlert(voiceType, 'danger', radarType, audioMode);
          state.lastDangerAlertTime = now;
        }
      } else {
        if (state.phase === 0) {
          playRadarAlert(voiceType, 'safe_first', radarType, audioMode);
          state.phase = 1;
        } else if (state.phase === 1 && distance < (currentSpeed > 100 ? 400 : 250)) {
          playRadarAlert(voiceType, 'safe_second', radarType, audioMode);
          state.phase = 2;
        }
      }
    }
  }, [userPos, nearestRadar, distance, isAlertActive, alertType, isSoundEnabled, voiceType, audioMode, currentSpeed]);

  useEffect(() => {
    if (!userPos) return;

    radarZones.forEach(zone => {
      if (passedZoneIdsRef.current.has(String(zone.id))) return;
      if (getDistance(userPos, [zone.lat, zone.lon]) < zone.radius) {
        passedZoneIdsRef.current.add(String(zone.id));
        if (isSoundEnabled) playRadarAlert(voiceType, 'info', 'mobile_zone', audioMode);
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
