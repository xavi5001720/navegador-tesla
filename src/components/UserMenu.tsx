'use client';

import { Car, Users, Settings, LogOut, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface UserMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenGarage: () => void;
  onOpenSocial: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export default function UserMenu({ 
  isOpen, 
  onClose, 
  onOpenGarage, 
  onOpenSocial, 
  onOpenSettings, 
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
                icon={<Settings className="h-5 w-5" />} 
                label="Preferencias" 
                onClick={() => { onOpenSettings(); onClose(); }} 
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
