'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

interface DevModeContextType {
  isDevMode: boolean;
  setDevMode: (active: boolean) => void;
}

const DevModeContext = createContext<DevModeContextType | undefined>(undefined);

export function DevModeProvider({ children }: { children: React.ReactNode }) {
  const [isDevMode, setIsDevMode] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    const xaviParam = searchParams.get('xavi');

    // Desactivar si se pasa ?xavi=off, ?xavi=0, ?xavi=salir
    if (xaviParam === 'off' || xaviParam === '0' || xaviParam === 'false' || xaviParam === 'salir') {
      setIsDevMode(false);
      localStorage.removeItem('tesla_dev_mode');
      return;
    }

    // Activación vía URL: /?xavi=...
    if (xaviParam !== null) {
      const pass = prompt('Modo Desarrollador Protegido. Introduce la clave:');
      if (pass === 'tesla2026') {
        setIsDevMode(true);
        localStorage.setItem('tesla_dev_mode', 'active');
      }
    } else if (localStorage.getItem('tesla_dev_mode') === 'active') {
      // Solo mantener activo si no estamos en producción o si fue activado explícitamente
      setIsDevMode(true);
    }
  }, [searchParams]);

  const setDevMode = (active: boolean) => {
    setIsDevMode(active);
    if (!active) localStorage.removeItem('tesla_dev_mode');
  };

  return (
    <DevModeContext.Provider value={{ isDevMode, setDevMode }}>
      {children}
    </DevModeContext.Provider>
  );
}

export const useDevMode = () => {
  const context = useContext(DevModeContext);
  if (!context) throw new Error('useDevMode must be used within a DevModeProvider');
  return context;
};
