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
}

export default function NavigationPanel({ 
  isVisible, 
  instruction, 
  distance, 
  activeLaneGuidance,
  isSimulating = false 
}: NavigationPanelProps) {
  if (!isVisible || !instruction) return null;

  const formatDistance = (m: number) => {
    if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
    return `${Math.round(m)} m`;
  };

  return (
    <motion.div
      initial={{ x: -400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -400, opacity: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 100 }}
      className="fixed top-8 left-8 z-[1000] w-[380px]"
    >
      <div className="bg-black/80 backdrop-blur-3xl border border-white/10 rounded-[2rem] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.9)]">
        
        {/* Indicador de Simulación */}
        {isSimulating && (
          <div className="bg-amber-500/90 py-1.5 px-4 text-center">
            <span className="text-[10px] font-black italic text-black tracking-widest uppercase">MODO SIMULACIÓN ACTIVO</span>
          </div>
        )}

        {/* Encabezado: Distancia y Siguiente Maniobra */}
        <div className="flex items-center gap-6 p-7 bg-gradient-to-br from-white/[0.08] to-transparent">
          <div className="relative group">
            <div className="absolute inset-0 bg-blue-500/30 blur-2xl rounded-full scale-110 opacity-50 transition-all duration-700" />
            <div className="relative h-20 w-20 flex items-center justify-center rounded-[1.5rem] bg-white/5 border border-white/10 shadow-2xl overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 to-transparent" />
               <ManeuverIcon 
                 maneuver={instruction.maneuver} 
                 exitNumber={instruction.exitNumber}
                 className="h-12 w-12 drop-shadow-[0_0_15px_rgba(59,130,246,0.6)] relative z-10" 
               />
            </div>
          </div>

          <div className="flex flex-col">
            <span className="text-5xl font-black italic text-white tracking-tighter tabular-nums drop-shadow-md">
              {distance !== null ? formatDistance(distance) : '-- m'}
            </span>
            <div className="flex items-center gap-2 mt-1">
               <span className="text-[11px] font-black text-blue-400 uppercase tracking-widest opacity-80">EN TU RUTA</span>
               {instruction.isRoundabout && (
                 <span className="px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-[10px] font-bold text-blue-300 uppercase tracking-tighter">
                    {instruction.exitNumber ? `${instruction.exitNumber}ª Salida` : 'Rotonda'}
                 </span>
               )}
            </div>
          </div>
        </div>

        {/* Cuerpo: Texto de la Instrucción y Carriles */}
        <div className="p-7 pt-2 flex flex-col gap-4">
          <AnimatePresence mode="wait">
            <motion.div 
              key={instruction.message}
              initial={{ y: 5, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -5, opacity: 0 }}
              className="flex flex-col gap-1.5"
            >
               <p className="text-2xl font-bold text-white leading-tight italic tracking-tight drop-shadow-sm">
                  {instruction.street || instruction.message}
               </p>
               <p className="text-sm font-medium text-gray-400 leading-snug opacity-80">
                  {instruction.message}
               </p>
            </motion.div>
          </AnimatePresence>

          {/* Carriles anticipados */}
          {activeLaneGuidance && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <LaneGuidance lanes={activeLaneGuidance.lanes} />
            </motion.div>
          )}
        </div>

        {/* Barra de progreso sutil (solo si hay distancia) */}
        <div className="h-1.5 w-full bg-white/5 relative">
           <motion.div 
             className="absolute top-0 left-0 h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
             initial={{ width: '0%' }}
             animate={{ width: '100%' }}
             transition={{ duration: 10, ease: "linear", repeat: Infinity }}
           />
        </div>

      </div>
    </motion.div>
  );
}


