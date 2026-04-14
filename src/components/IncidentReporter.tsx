'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, 
  Construction, 
  ShieldAlert, 
  Package, 
  Car, 
  PawPrint,
  Check
} from 'lucide-react';

interface IncidentReporterProps {
  onReport: (lat: number, lon: number, category: string) => Promise<void>;
  userPos: [number, number];
  isReporting: boolean;
  cooldownRemaining: number;
  userId?: string;
}

const CATEGORIES = [
  { id: 'accident', label: 'Accidente', icon: AlertTriangle, color: 'bg-rose-600', hover: 'hover:bg-rose-500' },
  { id: 'works', label: 'Obras', icon: Construction, color: 'bg-orange-600', hover: 'hover:bg-orange-500' },
  { id: 'mobile_radar', label: 'Radar / Policía', icon: ShieldAlert, color: 'bg-blue-600', hover: 'hover:bg-blue-500' },
  { id: 'object', label: 'Objeto en vía', icon: Package, color: 'bg-amber-600', hover: 'hover:bg-amber-500' },
  { id: 'stopped_vehicle', label: 'Vehículo', icon: Car, color: 'bg-slate-600', hover: 'hover:bg-slate-500' },
  { id: 'animal', label: 'Animal', icon: PawPrint, color: 'bg-emerald-600', hover: 'hover:bg-emerald-500' },
];

export default function IncidentReporter({ 
  onReport, 
  userPos, 
  isReporting, 
  cooldownRemaining,
  userId 
}: IncidentReporterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);

  const handleReport = async (category: string) => {
    try {
      await onReport(userPos[0], userPos[1], category);
      setIsOpen(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    } catch (err) {
      console.error('Error reporting incident:', err);
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;
  };

  const onClickButton = () => {
    // Si ha habido arrastre significativo, no abrir el menú
    if (isDraggingRef.current) return;
    setIsOpen(!isOpen);
  };

  if (!userId) return null;

  return (
    <div className="relative pointer-events-none">
      <motion.div
        drag
        dragMomentum={false}
        onDragStart={() => { isDraggingRef.current = true; }}
        style={{ touchAction: 'none' }}
        className="pointer-events-auto flex flex-col items-end"
      >
        <AnimatePresence mode="wait">
          {!isOpen ? (
            <div className="flex flex-col items-center gap-2">
              <motion.button
                key="main-button"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                onPointerDown={onPointerDown}
                onTap={onClickButton}
                disabled={cooldownRemaining > 0 || isReporting}
                className={`h-20 w-20 rounded-3xl flex items-center justify-center border-4 border-white shadow-2xl transition-all cursor-grab active:cursor-grabbing select-none ${
                  cooldownRemaining > 0 ? 'bg-gray-600 grayscale opacity-50' : 'bg-blue-700 hover:bg-blue-600 hover:shadow-blue-500/50'
                }`}
              >
                {cooldownRemaining > 0 ? (
                  <span className="text-white font-black text-xl">{Math.ceil(cooldownRemaining / 60000)}m</span>
                ) : (
                  <img src="/ALERTAS.png" alt="Informar" className="h-14 w-14 object-contain pointer-events-none drop-shadow-lg" />
                )}
              </motion.button>
              <span className="text-[10px] font-black text-white uppercase tracking-widest text-center shadow-black drop-shadow-xl whitespace-nowrap">
                Informar de Alerta
              </span>
            </div>
          ) : (
            <motion.div
              key="incident-menu"
              initial={{ scale: 0.9, opacity: 0, x: 20 }}
              animate={{ scale: 1, opacity: 1, x: 0 }}
              exit={{ scale: 0.9, opacity: 0, x: 20 }}
              className="bg-black/95 backdrop-blur-2xl border-2 border-white/20 rounded-[2.5rem] p-6 w-80 shadow-2xl pointer-events-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-xl font-black text-white uppercase tracking-tighter italic">Informar</h4>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 -mr-2 text-white/30 hover:text-white"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {CATEGORIES.map((cat) => (
                  <motion.button
                    key={cat.id}
                    onTap={() => handleReport(cat.id)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`${cat.color} ${cat.hover} aspect-square rounded-[2rem] flex flex-col items-center justify-center gap-2 transition-all shadow-lg border-2 border-white/10`}
                  >
                    <cat.icon className="h-8 w-8 text-white" />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest text-center px-2">
                      {cat.label}
                    </span>
                  </motion.button>
                ))}
              </div>
              
              <p className="text-center mt-6 text-[9px] font-bold text-white/30 uppercase tracking-[0.2em]">
                Selección de un solo toque
              </p>
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
            <span className="text-white font-black uppercase tracking-tighter text-sm">Aviso Compartido</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function X({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
    </svg>
  );
}
