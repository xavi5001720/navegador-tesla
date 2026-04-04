'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Navigation, Route } from 'lucide-react';
import ManeuverIcon from './ManeuverIcon';

interface NavigationPanelProps {
  isVisible: boolean;
  instruction: {
    message: string;
    maneuver: string;
    street?: string;
  } | null;
  distance: number | null;
}

export default function NavigationPanel({ isVisible, instruction, distance }: NavigationPanelProps) {
  if (!isVisible || !instruction) return null;

  const formatDistance = (m: number) => {
    if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
    return `${Math.round(m)} m`;
  };

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      className="fixed top-8 left-8 z-[1000] w-[340px]"
    >
      <div className="bg-black/70 backdrop-blur-3xl border border-white/10 rounded-3xl overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)]">
        
        {/* Encabezado: Distancia y Siguiente Maniobra */}
        <div className="flex items-center gap-6 p-6 bg-gradient-to-br from-white/[0.08] to-transparent">
          <div className="relative group">
            <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full scale-110 opacity-50 transition-all duration-700" />
            <div className="relative h-16 w-16 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 shadow-2xl">
              <ManeuverIcon maneuver={instruction.maneuver} className="h-10 w-10 drop-shadow-[0_0_15px_rgba(59,130,246,0.6)]" />
            </div>
          </div>

          <div className="flex flex-col">
            <span className="text-4xl font-black italic text-white tracking-tighter tabular-nums drop-shadow-md">
              {distance !== null ? formatDistance(distance) : '-- m'}
            </span>
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest mt-1 opacity-80">PROXIMA MANIOBRA</span>
          </div>
        </div>

        {/* Cuerpo: Texto de la Instrucción */}
        <div className="p-6 pt-2 bg-black/20">
          <div className="flex flex-col gap-1">
             <p className="text-xl font-bold text-white leading-tight italic tracking-tight">
                {instruction.street || instruction.message}
             </p>
             <p className="text-sm font-medium text-gray-400 leading-snug">
                {instruction.message}
             </p>
          </div>
        </div>

        {/* Línea decorativa inferior de progreso sutil */}
        <div className="h-1 w-full bg-white/5 relative">
           <motion.div 
             initial={{ width: '0%' }}
             animate={{ width: '100%' }}
             transition={{ duration: 15, ease: "linear", repeat: Infinity }}
             className="absolute top-0 left-0 h-full bg-blue-500/30"
           />
        </div>

      </div>
    </motion.div>
  );
}
