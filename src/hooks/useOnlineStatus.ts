'use client';

/**
 * useOnlineStatus
 * ─────────────────────────────────────────────────────────────────────────────
 * Directiva Core #4 — Fallback elegante sin cobertura.
 *
 * Escucha los eventos nativos del navegador `online` / `offline` y devuelve
 * un booleano reactivo. Cuando el Tesla pierde la conexión de datos, la app
 * puede mostrar un indicador visual sin romper nada.
 *
 * Limpia los listeners al desmontar (Directiva Core #3 — sin memory leaks).
 */

import { useState, useEffect } from 'react';

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
