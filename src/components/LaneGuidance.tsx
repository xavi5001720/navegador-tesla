'use client';

import { motion } from 'framer-motion';

interface Lane {
  directions: string[];
  recommended: boolean;
}

interface LaneGuidanceProps {
  lanes: Lane[];
}

const LaneArrow = ({ directions, isRecommended }: { directions: string[], isRecommended: boolean }) => {
  // Simplificamos: si tiene múltiples direcciones, mostramos la más relevante
  // En un sistema real, dibujaríamos iconos combinados (ej: recto + derecha)
  const mainDirection = directions[0] || 'straight';
  
  const getRotation = (dir: string) => {
    switch (dir) {
      case 'left': return -90;
      case 'sharpLeft': return -135;
      case 'slightLeft': return -45;
      case 'right': return 90;
      case 'sharpRight': return 135;
      case 'slightRight': return 45;
      case 'uTurn': return 180;
      default: return 0;
    }
  };

  return (
    <div className={`relative flex flex-col items-center transition-all duration-500 ${isRecommended ? 'scale-110' : 'scale-90 opacity-40 grayscale'}`}>
      <svg 
        viewBox="0 0 24 24" 
        className={`h-8 w-8 ${isRecommended ? 'text-white' : 'text-gray-400'}`}
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        style={{ transform: `rotate(${getRotation(mainDirection)}deg)` }}
      >
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
      {isRecommended && (
        <motion.div 
          layoutId="lane-indicator"
          className="absolute -bottom-1 h-1 w-4 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]"
        />
      )}
    </div>
  );
};

export default function LaneGuidance({ lanes }: LaneGuidanceProps) {
  if (!lanes || lanes.length === 0) return null;

  return (
    <div className="flex items-center justify-center gap-3 py-3 px-4 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-sm">
      {lanes.map((lane, i) => (
        <LaneArrow 
          key={i} 
          directions={lane.directions} 
          isRecommended={lane.recommended} 
        />
      ))}
    </div>
  );
}
