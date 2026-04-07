'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Navigation } from 'lucide-react';
import ManeuverIcon from './ManeuverIcon';
import LaneGuidance from './LaneGuidance';

interface NavigationPanelProps {
  isVisible: boolean;
  instruction: {
    message: string;
    maneuver: string;
    street?: string;
    exitNumber?: number;
    isRoundabout?: boolean;
  } | null;
  distance: number | null;
  activeLaneGuidance?: {
    lanes: { directions: string[], recommended: boolean }[]
  } | null;
  isSimulating?: boolean;
  isMinimized?: boolean;
  onMinimize?: () => void;
  isSidebarOpen?: boolean;
}

export default function NavigationPanel({ 
  isVisible, 
  instruction, 
  distance, 
  activeLaneGuidance,
  isSimulating = false,
  isMinimized = false,
  onMinimize,
  isSidebarOpen = false,
}: NavigationPanelProps) {
  if (!isVisible || !instruction || isMinimized) return null;

  const formatDistance = (m: number) => {
    if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
    return `${Math.round(m)} m`;
  };

  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={{ x: -400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -400, opacity: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 100 }}
      className="fixed top-[8px] left-[120px] z-[1000] w-[320px] cursor-grab active:cursor-grabbing pointer-events-auto"
    >
      <div className="bg-black/80 backdrop-blur-3xl border border-white/10 rounded-[2rem] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.9)] relative group/panel">
        
        {/* Botón Minimizar */}
        {onMinimize && !isSidebarOpen && (
          <button 
            onClick={(e) => { e.stopPropagation(); onMinimize(); }}
            className="absolute top-4 right-4 z-50 h-8 w-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all pointer-events-auto"
          >
            <div className="h-0.5 w-3 bg-white rounded-full" />
          </button>
        )}

        {/* Indicador de Simulación */}
        {isSimulating && (
          <div className="bg-amber-500/90 py-1.5 px-4 text-center">
            <span className="text-[10px] font-black italic text-black tracking-widest uppercase leading-none">MODO SIMULACIÓN ACTIVO</span>
          </div>
        )}

        {/* Encabezado Compacto */}
        <div className="flex items-center gap-5 p-5 bg-gradient-to-br from-white/[0.08] to-transparent">
          <div className="relative group flex-shrink-0">
            <div className="absolute inset-0 bg-blue-500/30 blur-2xl rounded-full scale-110 opacity-50 transition-all duration-700" />
            <div className="relative h-16 w-16 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 shadow-2xl overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 to-transparent" />
               <ManeuverIcon 
                 maneuver={instruction.maneuver} 
                 exitNumber={instruction.exitNumber}
                 className="h-10 w-10 drop-shadow-[0_0_15px_rgba(59,130,246,0.6)] relative z-10" 
               />
            </div>
          </div>

          <div className="flex flex-col overflow-hidden pr-6">
            <span className="text-4xl font-black italic text-white tracking-tighter tabular-nums drop-shadow-md leading-none">
              {distance !== null ? formatDistance(distance) : '-- m'}
            </span>
            <span className="text-sm font-bold text-white leading-tight truncate mt-1">
              {instruction.street || instruction.message}
            </span>
          </div>
        </div>

        {/* Carriles si existen */}
          {activeLaneGuidance && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden px-5 pb-5"
            >
              <LaneGuidance lanes={activeLaneGuidance.lanes} />
            </motion.div>
          )}
      </div>
    </motion.div>
  );
}


