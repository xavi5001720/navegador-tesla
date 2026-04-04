'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, MapPin, Navigation, XCircle, Camera } from 'lucide-react';

interface RouteDashboardProps {
  totalDistance: number;    // metros
  totalDuration: number;    // segundos
  remainingDistance: number; // metros
  remainingDuration: number; // segundos
  remainingRadarsCount: number;
  onEndRoute: () => void;
}

export default function RouteDashboard({
  totalDistance,
  totalDuration,
  remainingDistance,
  remainingDuration,
  remainingRadarsCount,
  onEndRoute
}: RouteDashboardProps) {
  
  // Cálculo de progreso
  const progress = useMemo(() => {
    if (!totalDistance) return 0;
    const completed = Math.max(0, totalDistance - remainingDistance);
    return Math.min(100, (completed / totalDistance) * 100);
  }, [totalDistance, remainingDistance]);

  // Cálculo de hora de llegada
  const arrivalTime = useMemo(() => {
    const now = new Date();
    return new Date(now.getTime() + remainingDuration * 1000);
  }, [remainingDuration]);

  // Formatear distancias (m -> km)
  const formatDistance = (m: number) => {
    if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
    return `${Math.round(m)} m`;
  };

  // Formatear duración (s -> HH:mm o mm min)
  const formatDuration = (s: number) => {
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes} min`;
  };

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[600] w-[90%] max-w-2xl"
    >
      <div className="bg-black/60 backdrop-blur-2xl border border-white/10 rounded-3xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
        
        {/* Línea de progreso superior */}
        <div className="relative h-1.5 w-full bg-white/5 rounded-full mb-4 overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-600 to-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
          />
        </div>

        <div className="flex items-center justify-between gap-6">
          {/* Hora de llegada */}
          <div className="flex flex-col items-center flex-1">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">LLEGADA</span>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-400" />
              <span className="text-xl font-black text-white italic">
                {arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          <div className="h-10 w-[1px] bg-white/10" />

          {/* Tiempo restante */}
          <div className="flex flex-col items-center flex-1 text-center">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">TIEMPO</span>
            <span className="text-xl font-black text-white italic">
              {formatDuration(remainingDuration)}
            </span>
          </div>

          <div className="h-10 w-[1px] bg-white/10" />

          {/* Distancia restante */}
          <div className="flex flex-col items-center flex-1">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">DISTANCIA</span>
            <div className="flex items-center gap-2">
              <Navigation className="h-4 w-4 text-blue-400 transform rotate-45" />
              <span className="text-xl font-black text-white italic">
                {formatDistance(remainingDistance)}
              </span>
            </div>
          </div>

          <div className="h-10 w-[1px] bg-white/10" />

          {/* Radares */}
          <div className="flex flex-col items-center flex-1">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">RADARES</span>
            <div className="flex items-center gap-2">
              <div className="bg-rose-500/20 px-2 py-0.5 rounded-lg border border-rose-500/30 flex items-center gap-1.5">
                <Camera className="h-3 w-3 text-rose-500" />
                <span className="text-lg font-black text-rose-400 italic leading-none">{remainingRadarsCount}</span>
              </div>
            </div>
          </div>

          <div className="h-10 w-[1px] bg-white/10" />

          {/* Botón Finalizar */}
          <button
            onClick={onEndRoute}
            className="flex flex-col items-center group transition-all"
          >
            <span className="text-[9px] font-black text-rose-500/60 uppercase tracking-tighter mb-1.5 group-hover:text-rose-500 transition-colors">CANCELAR</span>
            <div className="h-10 w-10 flex items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20 group-hover:bg-rose-500 group-hover:border-rose-500 transition-all shadow-xl">
              <XCircle className="h-6 w-6 text-rose-500 group-hover:text-white transition-colors" />
            </div>
          </button>
        </div>

      </div>
    </motion.div>
  );
}
