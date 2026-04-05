'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getDistance, getBearing, interpolatePoint, getPointAtDistance, getOffsetPoint } from '@/utils/geo';
import { RouteSection } from './useRoute';

interface useRouteSimulatorProps {
  routeCoordinates: [number, number][] | undefined;
  sections: RouteSection[] | undefined;
  setUserPos: (pos: [number, number]) => void;
  setHeading: (heading: number) => void;
  setSpeed: (speed: number) => void;
  setIsSimulating?: (val: boolean) => void;
}

export function useRouteSimulator({
  routeCoordinates,
  sections,
  setUserPos,
  setHeading,
  setSpeed,
  setIsSimulating: setIsSimulatingExt
}: useRouteSimulatorProps) {
  const [isSimulating, setIsSimulating] = useState(false);

  const [progress, setProgress] = useState(0); 
  
  const distanceTraveledRef = useRef(0); // metros - Usamos Ref para física fluida
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const lastProgressUpdateRef = useRef(0);

  // Pre-calculamos las distancias acumuladas de cada punto de la ruta
  const cumulativeDistances = useMemo(() => {
    if (!routeCoordinates || routeCoordinates.length < 2) return [];
    const distances = [0];
    let total = 0;
    for (let i = 0; i < routeCoordinates.length - 1; i++) {
      total += getDistance(routeCoordinates[i], routeCoordinates[i + 1]);
      distances.push(total);
    }
    return distances;
  }, [routeCoordinates]);

  const totalRouteDistance = cumulativeDistances[cumulativeDistances.length - 1] || 0;

  const currentSpeedRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);

  const stopSimulation = useCallback(() => {
    setIsSimulating(false);
    if (setIsSimulatingExt) setIsSimulatingExt(false);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setSpeed(0);
    lastTimeRef.current = null;
    startTimeRef.current = null;
    distanceTraveledRef.current = 0;
    currentSpeedRef.current = 0;
    setProgress(0);
  }, [setSpeed, setIsSimulatingExt]);

  const startSimulation = useCallback(() => {
    if (!routeCoordinates || routeCoordinates.length < 2) return;
    setIsSimulating(true);
    if (setIsSimulatingExt) setIsSimulatingExt(true);
    distanceTraveledRef.current = 0;
    currentSpeedRef.current = 0;
    setProgress(0);
    lastTimeRef.current = performance.now();
    startTimeRef.current = performance.now();
  }, [routeCoordinates, setIsSimulatingExt]);


  useEffect(() => {
    if (!isSimulating || !routeCoordinates || cumulativeDistances.length === 0) return;

    const animate = (time: number) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = time;
        startTimeRef.current = time;
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      let deltaTime = (time - lastTimeRef.current) / 1000; 
      if (deltaTime > 0.1) deltaTime = 0.1; 
      lastTimeRef.current = time;

      // 1. Calcular fase de velocidad (Ciclo de 30s)
      const totalElapsed = (time - (startTimeRef.current || time)) / 1000;
      const phase = totalElapsed % 30;

      const currentDist = distanceTraveledRef.current;
      let currentIdx = cumulativeDistances.findIndex((d) => d > currentDist) - 1;
      if (currentIdx < 0) currentIdx = 0;
      
      if (currentIdx >= routeCoordinates.length - 1) {
        stopSimulation();
        return;
      }

      const speedSection = sections?.find(s => s.speedLimit && currentIdx >= s.start && currentIdx < s.end);
      const limitKmh = speedSection?.speedLimit || 90;

      // Lógica de "Stress Test": 30 -> Límite -> 2x Límite
      let targetSpeedKmh = 30;
      if (phase >= 10 && phase < 20) targetSpeedKmh = limitKmh;
      else if (phase >= 20) targetSpeedKmh = limitKmh * 2;

      // ACELERACIÓN PROGRESIVA (Inercia)
      // Ajustamos un factor de aceleración/frenado suave
      const accelerationFactor = 0.04; 
      currentSpeedRef.current = currentSpeedRef.current + (targetSpeedKmh - currentSpeedRef.current) * accelerationFactor;
      
      // 2. Avanzar distancia
      const speedMps = currentSpeedRef.current / 3.6;
      let newDist = currentDist + speedMps * deltaTime;

      if (newDist >= totalRouteDistance) {
        stopSimulation();
        return;
      }

      // 3. ACTUALIZAR REFERENCIA
      distanceTraveledRef.current = Math.max(distanceTraveledRef.current, newDist);

      // 4. Calcular posición exacta por interpolación
      const p1Idx = Math.max(0, cumulativeDistances.findIndex((d) => d > newDist) - 1);
      const p1 = routeCoordinates[p1Idx];
      const p2 = routeCoordinates[p1Idx + 1];
      
      if (p1 && p2) {
        const segmentDist = cumulativeDistances[p1Idx + 1] - cumulativeDistances[p1Idx];
        const distInSegment = newDist - cumulativeDistances[p1Idx];
        const fraction = segmentDist > 0 ? Math.min(1, Math.max(0, distInSegment / segmentDist)) : 0;

        const pos = interpolatePoint(p1, p2, fraction);
        
        // NAVEGACIÓN POR CARRIL: 2.2 metros a la derecha de la trayectoria
        const roadBearing = getBearing(p1, p2);
        const lanePos = getOffsetPoint(pos, roadBearing + 90, 2.2);
        
        setUserPos(lanePos);
        setHeading(roadBearing); // Mantiene el paralelismo total con la vía
        setSpeed(Math.round(currentSpeedRef.current));
      }

      // 5. Actualizar el estado de progreso
      if (time - lastProgressUpdateRef.current > 500) {
        setProgress((newDist / totalRouteDistance) * 100);
        lastProgressUpdateRef.current = time;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };


    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isSimulating, routeCoordinates, cumulativeDistances, sections, setUserPos, setHeading, setSpeed, stopSimulation, totalRouteDistance]);

  return {
    isSimulating,
    startSimulation,
    stopSimulation,
    progress
  };
}


