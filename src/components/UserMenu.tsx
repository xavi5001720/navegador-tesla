'use client';

import { Car, Users, Maximize, Minimize, LogOut, X, Map as MapIcon, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
}

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
  onLogout 
}: UserMenuProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop for close on click outside */}
          <div 
            className="fixed inset-0 z-[550]" 
            onClick={onClose}
          />
          
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 right-6 z-[600] w-64 overflow-hidden rounded-3xl bg-black/80 backdrop-blur-2xl border border-white/10 shadow-2xl"
          >
            <div className="p-2 space-y-1">
              <MenuButton 
                icon={<Car className="h-5 w-5" />} 
                label="Mi vehículo" 
                onClick={() => { onOpenGarage(); onClose(); }} 
              />
              <MenuButton 
                icon={<Users className="h-5 w-5" />} 
                label="Viajar con Amigos" 
                onClick={() => { onOpenSocial(); onClose(); }} 
              />
              <MenuButton 
                icon={isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />} 
                label={isFullscreen ? "Ver menú" : "Ver pantalla completa"} 
                onClick={() => { onToggleFullscreen(); onClose(); }} 
              />
              <MenuButton 
                icon={<MapIcon className="h-5 w-5" />} 
                label={mapMode === 'satellite' ? "Mapa modo ligero" : "Mapa modo satélite"} 
                onClick={() => { onToggleMapMode(); onClose(); }} 
              />
              <MenuButton 
                icon={<Info className="h-5 w-5" />} 
                label="Acerca de" 
                onClick={() => { onOpenAbout(); onClose(); }} 
              />
              
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
