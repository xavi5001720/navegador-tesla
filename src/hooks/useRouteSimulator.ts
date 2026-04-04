'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getDistance, getBearing, interpolatePoint } from '@/utils/geo';
import { RouteSection } from './useRoute';

interface useRouteSimulatorProps {
  routeCoordinates: [number, number][] | undefined;
  sections: RouteSection[] | undefined;
  setUserPos: (pos: [number, number]) => void;
  setHeading: (heading: number) => void;
  setSpeed: (speed: number) => void;
}

export function useRouteSimulator({
  routeCoordinates,
  sections,
  setUserPos,
  setHeading,
  setSpeed
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

  const stopSimulation = useCallback(() => {
    setIsSimulating(false);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setSpeed(0);
    lastTimeRef.current = null;
    distanceTraveledRef.current = 0;
    setProgress(0);
  }, [setSpeed]);

  const startSimulation = useCallback(() => {
    if (!routeCoordinates || routeCoordinates.length < 2) return;
    setIsSimulating(true);
    distanceTraveledRef.current = 0;
    setProgress(0);
    lastTimeRef.current = performance.now();
  }, [routeCoordinates]);

  useEffect(() => {
    if (!isSimulating || !routeCoordinates || cumulativeDistances.length === 0) return;

    const animate = (time: number) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = time;
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      let deltaTime = (time - lastTimeRef.current) / 1000; 
      if (deltaTime > 0.1) deltaTime = 0.1; 
      lastTimeRef.current = time;

      const currentDist = distanceTraveledRef.current;
      
      // 1. Determinar el límite de velocidad del tramo actual
      // Usamos findIndex de forma robusta
      let currentIdx = cumulativeDistances.findIndex((d) => d > currentDist) - 1;
      if (currentIdx < 0) currentIdx = 0;
      
      if (currentIdx >= routeCoordinates.length - 1) {
        stopSimulation();
        return;
      }

      const speedSection = sections?.find(s => s.speedLimit && currentIdx >= s.start && currentIdx < s.end);
      const limitKmh = speedSection?.speedLimit || 90;
      
      // 2. Avanzar distancia
      const speedMps = limitKmh / 3.6;
      let newDist = currentDist + speedMps * deltaTime;

      if (newDist >= totalRouteDistance) {
        stopSimulation();
        return;
      }

      // 3. ACTUALIZAR REFERENCIA (Solo hacia adelante)
      distanceTraveledRef.current = Math.max(distanceTraveledRef.current, newDist);

      // 4. Calcular posición exacta por interpolación (usando newDist)
      const p1Idx = Math.max(0, cumulativeDistances.findIndex((d) => d > newDist) - 1);
      const p1 = routeCoordinates[p1Idx];
      const p2 = routeCoordinates[p1Idx + 1];
      
      if (p1 && p2) {
        const segmentDist = cumulativeDistances[p1Idx + 1] - cumulativeDistances[p1Idx];
        const distInSegment = newDist - cumulativeDistances[p1Idx];
        const fraction = segmentDist > 0 ? Math.min(1, Math.max(0, distInSegment / segmentDist)) : 0;

        const pos = interpolatePoint(p1, p2, fraction);
        
        setUserPos(pos);
        setHeading(getBearing(p1, p2));
        setSpeed(limitKmh);
      }

      // 5. Actualizar el estado de progreso solo de vez en cuando
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


