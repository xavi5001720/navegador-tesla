'use client';

import { motion } from 'framer-motion';

interface SpeedometerProps {
  speed: number;
}

export default function Speedometer({ speed }: SpeedometerProps) {
  return (
    <motion.div 
      drag 
      dragMomentum={false}
      style={{ touchAction: 'none' }}
      className="flex flex-col items-center justify-center bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl min-w-[140px] cursor-grab active:cursor-grabbing hover:bg-black/50 transition-colors pointer-events-auto"
    >
      <span className="text-6xl font-black text-white tabular-nums tracking-tighter">
        {speed}
      </span>
      <span className="text-xs font-bold text-blue-500 uppercase tracking-widest mt-1">
        km/h
      </span>
    </motion.div>
  );
}
