'use client';

import React from 'react';
import { 
  ArrowUp, 
  ArrowUpLeft, 
  ArrowUpRight, 
  ArrowLeft, 
  ArrowRight, 
  CornerUpLeft, 
  CornerUpRight, 
  Navigation,
  RotateCcw,
  MapPin,
  Split
} from 'lucide-react';

interface ManeuverIconProps {
  maneuver: string;
  className?: string;
}

export default function ManeuverIcon({ maneuver, className = "h-8 w-8" }: ManeuverIconProps) {
  // Normalizar el string de maniobra
  const m = maneuver?.toUpperCase() || '';

  // Mapeo de maniobras a iconos
  if (m.includes('SHARP_LEFT')) return <CornerUpLeft className={`${className} text-blue-400`} />;
  if (m.includes('SHARP_RIGHT')) return <CornerUpRight className={`${className} text-blue-400`} />;
  
  if (m.includes('SLIGHT_LEFT')) return <ArrowUpLeft className={`${className} text-blue-400`} />;
  if (m.includes('SLIGHT_RIGHT')) return <ArrowUpRight className={`${className} text-blue-400`} />;

  if (m.includes('TURN_LEFT')) return <ArrowLeft className={`${className} text-blue-400`} />;
  if (m.includes('TURN_RIGHT')) return <ArrowRight className={`${className} text-blue-400`} />;

  if (m.includes('ROUNDABOUT')) {
    return (
      <div className="relative flex items-center justify-center">
        <RotateCcw className={`${className} text-blue-400 animate-spin-slow`} />
        <span className="absolute text-[10px] font-black text-white">i</span>
      </div>
    );
  }

  if (m.includes('EXIT')) return <ArrowUpRight className={`${className} text-emerald-400`} />;
  if (m.includes('FORK')) return <Split className={`${className} text-blue-400`} />;
  
  if (m.includes('ARRIVE')) return <MapPin className={`${className} text-rose-500`} />;
  if (m.includes('DEPART')) return <Navigation className={`${className} text-blue-500`} />;
  
  if (m.includes('STRAIGHT')) return <ArrowUp className={`${className} text-blue-400`} />;

  // Default
  return <Navigation className={`${className} text-blue-400 transform rotate-45`} />;
}
