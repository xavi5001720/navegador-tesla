'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, ShieldAlert } from 'lucide-react';

interface RadarReporterProps {
  onReport: (lat: number, lon: number) => Promise<void>;
  userPos: [number, number];
  isReporting: boolean;
  cooldownRemaining: number;
  userId?: string;
}

export default function RadarReporter({ 
  onReport, 
  userPos, 
  isReporting, 
  cooldownRemaining,
  userId 
}: RadarReporterProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleReport = async () => {
    try {
      await onReport(userPos[0], userPos[1]);
      setShowConfirm(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    } catch (err) {
      console.error('Error reporting radar:', err);
    }
  };

  if (!userId) return null;

  return (
    <div className="relative pointer-events-none">
      <motion.div
        drag
        dragMomentum={false}
        style={{ touchAction: 'none' }}
        className="pointer-events-auto flex flex-col items-end"
      >
        <AnimatePresence mode="wait">
          {!showConfirm ? (
            <motion.button
              key="report-button"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={() => setShowConfirm(true)}
              disabled={cooldownRemaining > 0 || isReporting}
              className={`h-20 w-20 rounded-3xl flex items-center justify-center border-4 border-white shadow-2xl transition-all cursor-grab active:cursor-grabbing select-none ${
                cooldownRemaining > 0 ? 'bg-gray-600 grayscale opacity-50' : 'bg-blue-600 hover:bg-blue-500 hover:shadow-blue-500/50'
              }`}
            >
              {cooldownRemaining > 0 ? (
                <span className="text-white font-black text-xl">{Math.ceil(cooldownRemaining / 60000)}m</span>
              ) : (
                <img src="/radarpolicia.png" alt="Reportar" className="h-12 w-12 object-contain pointer-events-none" />
              )}
            </motion.button>
          ) : (
            <motion.div
              key="confirm-panel"
              initial={{ scale: 0.9, opacity: 0, x: 20 }}
              animate={{ scale: 1, opacity: 1, x: 0 }}
              exit={{ scale: 0.9, opacity: 0, x: 20 }}
              className="bg-black/90 backdrop-blur-2xl border-2 border-white/20 rounded-[2.5rem] p-6 w-72 shadow-2xl pointer-events-auto"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="h-12 w-12 bg-blue-600 rounded-2xl flex items-center justify-center border border-white/20 shrink-0 shadow-lg">
                  <ShieldAlert className="h-6 w-6 text-white" />
                </div>
                <h4 className="text-lg font-black text-white uppercase tracking-tighter leading-none">Radar / Policía</h4>
              </div>
              
              <p className="text-white/60 text-[11px] font-bold uppercase tracking-widest mb-6 leading-relaxed">
                Informa de un radar móvil o control en tu posición actual.
              </p>
              
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleReport}
                  disabled={isReporting}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                >
                  <Check className="h-4 w-4" />
                  Confirmar Aviso
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="w-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-bold py-3 rounded-2xl transition-all uppercase tracking-widest text-[10px]"
                >
                  Salir
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Mensaje de éxito */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-24 right-0 bg-emerald-600 border border-white/20 rounded-2xl px-6 py-3 shadow-2xl pointer-events-auto flex items-center gap-3"
          >
            <Check className="h-5 w-5 text-white" />
            <span className="text-white font-black uppercase tracking-tighter text-sm">Reporte Enviado</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
