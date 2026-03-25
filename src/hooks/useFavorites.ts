'use client';

import { useState, useEffect, useCallback } from 'react';

export interface Favorite {
  id: string;
  name: string;
  lat: number;
  lon: number;
  createdAt: number;
}

const STORAGE_KEY = 'radarKiller_favorites';

export function useFavorites() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setFavorites(JSON.parse(raw));
    } catch {}
  }, []);

  const saveFavorite = useCallback((lat: number, lon: number, name?: string) => {
    const fav: Favorite = {
      id: `${lat.toFixed(5)}_${lon.toFixed(5)}`,
      name: name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
      lat,
      lon,
      createdAt: Date.now(),
    };
    setFavorites(prev => {
      // Evitar duplicados por coordenada
      const next = [fav, ...prev.filter(f => f.id !== fav.id)];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    return fav;
  }, []);

  const removeFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      const next = prev.filter(f => f.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (lat: number, lon: number) => {
      const id = `${lat.toFixed(5)}_${lon.toFixed(5)}`;
      return favorites.some(f => f.id === id);
    },
    [favorites]
  );

  return { favorites, saveFavorite, removeFavorite, isFavorite };
}
