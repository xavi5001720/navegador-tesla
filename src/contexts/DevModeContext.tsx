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
    // Activación vía URL: /?xavi
    if (searchParams.get('xavi') !== null) {
      const pass = prompt('Modo Desarrollador Protegido. Introduce la clave:');
      if (pass === 'tesla2026') { // Contraseña de ejemplo, el usuario puede cambiarla
        setIsDevMode(true);
        localStorage.setItem('tesla_dev_mode', 'active');
      }
    } else if (localStorage.getItem('tesla_dev_mode') === 'active') {
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
