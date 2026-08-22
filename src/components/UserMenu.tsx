'use client';

import { useState } from 'react';
import { Car, Users, Maximize, Minimize, LogOut, X, Map as MapIcon, Info, EyeOff, Search, Gauge, AlertTriangle, Navigation, LayoutDashboard, MonitorPlay } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DevGuard from './DevGuard';

interface UserMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenGarage: () => void;
  onOpenSocial: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  mapMode: 'satellite' | 'light';
  onToggleMapMode: () => void;
  onOpenAbout: () => void;
  onLogout: () => void;
  hiddenElements: Set<string>;
  onToggleHidden: (key: string) => void;
}

const HIDE_OPTIONS = [
  { key: 'searchBar',        label: 'Buscador de ruta',         icon: Search },
  { key: 'friends',          label: 'Amigos conectados',         icon: Users },
  { key: 'incidentReporter', label: 'Informar de alerta',        icon: AlertTriangle },
  { key: 'speedometer',      label: 'Velocímetro',               icon: Gauge },
  { key: 'routeDashboard',   label: 'Barra de ruta',             icon: LayoutDashboard },
  { key: 'nextInstruction',  label: 'Próximo cruce',             icon: Navigation },
  { key: 'viewModeButtons',  label: 'Vista General / Conducción',icon: MonitorPlay },
];

export default function UserMenu({ 
  isOpen, 
  onClose, 
  onOpenGarage, 
  onOpenSocial, 
  isFullscreen,
  onToggleFullscreen, 
  mapMode,
  onToggleMapMode,
  onOpenAbout,
  onLogout,
  hiddenElements,
  onToggleHidden,
}: UserMenuProps) {
  const [isHidePanelOpen, setIsHidePanelOpen] = useState(false);

  const hiddenCount = hiddenElements.size;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop for close on click outside */}
          <div 
            className="fixed inset-0 z-[550]" 
            onClick={() => { setIsHidePanelOpen(false); onClose(); }}
          />
          
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 right-6 z-[600] w-64 overflow-hidden rounded-3xl bg-black/80 backdrop-blur-2xl border border-white/10 shadow-2xl"
          >
            <div className="p-2 space-y-1">
              <DevGuard moduleId="[SUP-03]">
                <MenuButton 
                  icon={<Car className="h-5 w-5" />} 
                  label="Mi vehículo" 
                  onClick={() => { onOpenGarage(); setIsHidePanelOpen(false); onClose(); }} 
                />
              </DevGuard>

              <DevGuard moduleId="[SUP-01]">
                <MenuButton 
                  icon={<Users className="h-5 w-5" />} 
                  label="Viajar con Amigos" 
                  onClick={() => { onOpenSocial(); setIsHidePanelOpen(false); onClose(); }} 
                />
              </DevGuard>

              <DevGuard moduleId="[MAP-03]">
                <MenuButton 
                  icon={isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />} 
                  label={isFullscreen ? "Ver menú" : "Ver pantalla completa"} 
                  onClick={() => { onToggleFullscreen(); setIsHidePanelOpen(false); onClose(); }} 
                />
              </DevGuard>

              {/* Nueva opción: Ocultar botones */}
              <DevGuard moduleId="[MAP-03]">
                <button
                  onClick={() => setIsHidePanelOpen(p => !p)}
                  className="flex w-full items-center gap-3 rounded-2xl p-4 text-sm font-bold text-gray-300 hover:bg-white/10 hover:text-white transition-all group"
                >
                  <div className="text-gray-400 group-hover:text-blue-500 transition-colors">
                    <EyeOff className="h-5 w-5" />
                  </div>
                  <span className="flex-1 text-left">Ocultar botones</span>
                  {hiddenCount > 0 && (
                    <span className="text-[10px] font-black bg-blue-600 text-white px-2 py-0.5 rounded-full leading-none">
                      {hiddenCount}
                    </span>
                  )}
                  <motion.span
                    animate={{ rotate: isHidePanelOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-gray-600 text-xs"
                  >
                    ▾
                  </motion.span>
                </button>
              </DevGuard>

              {/* Sublista expandible */}
              <AnimatePresence>
                {isHidePanelOpen && (
                  <motion.div
                    key="hide-panel"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mx-2 mb-1 rounded-2xl bg-white/5 border border-white/5 p-2 space-y-0.5">
                      <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest px-2 pb-1">
                        Solo en pantalla completa
                      </p>
                      {HIDE_OPTIONS.map(({ key, label, icon: Icon }) => {
                        const isHidden = hiddenElements.has(key);
                        return (
                          <button
                            key={key}
                            onClick={() => onToggleHidden(key)}
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold transition-all ${
                              isHidden
                                ? 'bg-white/5 text-gray-600'
                                : 'text-gray-300 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <Icon className={`h-4 w-4 flex-shrink-0 ${isHidden ? 'text-gray-700' : 'text-blue-500'}`} />
                            <span className="flex-1 text-left">{label}</span>
                            {/* Toggle visual */}
                            <div className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${isHidden ? 'bg-gray-700' : 'bg-blue-600'}`}>
                              <motion.div
                                animate={{ x: isHidden ? 2 : 18 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow"
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <DevGuard moduleId="[MAP-02]">
                <MenuButton 
                  icon={<MapIcon className="h-5 w-5" />} 
                  label={mapMode === 'satellite' ? "Mapa modo ligero" : "Mapa modo satélite"} 
                  onClick={() => { onToggleMapMode(); setIsHidePanelOpen(false); onClose(); }} 
                />
              </DevGuard>

              <DevGuard moduleId="[SUP-02]">
                <MenuButton 
                  icon={<Info className="h-5 w-5" />} 
                  label="Acerca de" 
                  onClick={() => { onOpenAbout(); setIsHidePanelOpen(false); onClose(); }} 
                />
              </DevGuard>
              
              <div className="h-px bg-white/5 my-2 mx-4" />
              
              <button
                onClick={onLogout}
                className="flex w-full items-center gap-3 rounded-2xl p-4 text-sm font-bold text-rose-500 hover:bg-rose-500/10 transition-all"
              >
                <LogOut className="h-5 w-5" />
                Cerrar sesión
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function MenuButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl p-4 text-sm font-bold text-gray-300 hover:bg-white/10 hover:text-white transition-all group"
    >
      <div className="text-gray-400 group-hover:text-blue-500 transition-colors">
        {icon}
      </div>
      {label}
    </button>
  );
}
