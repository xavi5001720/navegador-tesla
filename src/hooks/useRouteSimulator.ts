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
  const [distanceTraveled, setDistanceTraveled] = useState(0); // metros
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

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
  }, [setSpeed]);

  const startSimulation = useCallback(() => {
    if (!routeCoordinates || routeCoordinates.length < 2) return;
    setIsSimulating(true);
    setDistanceTraveled(0);
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

      const deltaTime = (time - lastTimeRef.current) / 1000; // segundos
      lastTimeRef.current = time;

      setDistanceTraveled((prevDist) => {
        // 1. Encontrar el índice del segmento actual
        const idx = cumulativeDistances.findIndex((d, i) => d > prevDist) - 1;
        const currentIdx = idx < 0 ? 0 : idx;
        
        if (currentIdx >= routeCoordinates.length - 1) {
          stopSimulation();
          return prevDist;
        }

        // 2. Determinar el límite de velocidad del tramo
        // Buscamos en 'sections' si hay un limite definido para este indice
        const speedSection = sections?.find(s => s.speedLimit && currentIdx >= s.start && currentIdx < s.end);
        const limitKmh = speedSection?.speedLimit || 90; // Default 90 si no hay dato
        
        // 3. Avanzar distancia
        const speedMps = limitKmh / 3.6;
        let newDist = prevDist + speedMps * deltaTime;

        if (newDist >= totalRouteDistance) {
          stopSimulation();
          return totalRouteDistance;
        }

        // 4. Calcular posición exacta por interpolación
        const p1Idx = cumulativeDistances.findIndex((d) => d > newDist) - 1;
        const p1 = routeCoordinates[p1Idx];
        const p2 = routeCoordinates[p1Idx + 1];
        
        const segmentDist = cumulativeDistances[p1Idx + 1] - cumulativeDistances[p1Idx];
        const distInSegment = newDist - cumulativeDistances[p1Idx];
        const fraction = segmentDist > 0 ? distInSegment / segmentDist : 0;

        const pos = interpolatePoint(p1, p2, fraction);
        setUserPos(pos);
        setHeading(getBearing(p1, p2));
        setSpeed(limitKmh);

        return newDist;
      });

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
    progress: totalRouteDistance > 0 ? (distanceTraveled / totalRouteDistance) * 100 : 0
  };
}

