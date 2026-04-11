// src/hooks/useFriendPlayback.ts
'use client';

import { useState, useEffect, useRef } from 'react';
import type { Friend, Breadcrumb } from './useSocial';

interface InterpolatedState {
  lat: number;
  lon: number;
  heading: number;
  speed: number;
}

export function useFriendPlayback(friends: Friend[], friendBatches: Record<string, Breadcrumb[]>) {
  const [interpolatedPositions, setInterpolatedPositions] = useState<Record<string, InterpolatedState>>({});
  const rafRef = useRef<number | null>(null);
  
  // Guardamos las distancias mínimas calculadas en useSocial para ajustar el delay
  // (Aunque useFriendPlayback podría calcularlas también, useSocial ya lo hace)
  // Para simplificar, calcularemos un delay dinámico basado en la zona.

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const nextPositions: Record<string, InterpolatedState> = {};

      friends.forEach(friend => {
        const batch = friendBatches[friend.id];
        if (!batch || batch.length === 0) {
          // Si no hay batch, usamos la última posición conocida (estática)
          if (friend.last_lat && friend.last_lon) {
            nextPositions[friend.id] = {
              lat: friend.last_lat,
              lon: friend.last_lon,
              heading: 0,
              speed: 0
            };
          }
          return;
        }

        // 1. Determinar el delay (Zona 1: 5s, Zona 2+: 22s)
        // El delay debe ser ligeramente superior al intervalo de envío para tener siempre buffer.
        // Como no tenemos la zona exacta aquí, podemos estimarla por la frecuencia de los puntos
        // o simplemente usar un valor conservador si el batch es corto.
        
        let playbackDelay = 22000;
        if (batch.length > 2) {
          const avgInterval = (batch[batch.length - 1].t - batch[0].t) / batch.length;
          if (avgInterval < 5000) playbackDelay = 6000; // Mucha frecuencia -> Zona 1
        }

        const targetTime = now - playbackDelay;

        // 2. Encontrar los dos puntos para interpolar
        let p1: Breadcrumb | null = null;
        let p2: Breadcrumb | null = null;

        for (let i = 0; i < batch.length - 1; i++) {
          if (batch[i].t <= targetTime && batch[i + 1].t > targetTime) {
            p1 = batch[i];
            p2 = batch[i + 1];
            break;
          }
        }

        if (p1 && p2) {
          // 3. Interpolación Lineal
          const factor = (targetTime - p1.t) / (p2.t - p1.t);
          
          nextPositions[friend.id] = {
            lat: p1.lat + (p2.lat - p1.lat) * factor,
            lon: p1.lon + (p2.lon - p1.lon) * factor,
            heading: interpolateHeading(p1.h || 0, p2.h || 0, factor),
            speed: (p1.s || 0) + ((p2.s || 0) - (p1.s || 0)) * factor
          };
        } else if (targetTime > batch[batch.length - 1].t) {
          // Si el tiempo target supera el último punto, nos quedamos en el último punto
          // (Significa que hay lag o el usuario se ha detenido)
          const last = batch[batch.length - 1];
          nextPositions[friend.id] = {
            lat: last.lat,
            lon: last.lon,
            heading: last.h || 0,
            speed: last.s || 0
          };
        } else {
          // Si el tiempo target es demasiado antiguo (fuera de buffer), usamos el primero disponible
          const first = batch[0];
          nextPositions[friend.id] = {
            lat: first.lat,
            lon: first.lon,
            heading: first.h || 0,
            speed: first.s || 0
          };
        }
      });

      setInterpolatedPositions(nextPositions);
      rafRef.current = requestAnimationFrame(update);
    };

    rafRef.current = requestAnimationFrame(update);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [friends, friendBatches]);

  return interpolatedPositions;
}

// Función auxiliar para interpolar ángulos (heading) evitando el salto 359->0
function interpolateHeading(h1: number, h2: number, factor: number) {
  let diff = h2 - h1;
  while (diff < -180) diff += 360;
  while (diff > 180) diff -= 360;
  return (h1 + diff * factor + 360) % 360;
}
