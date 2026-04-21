'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef } from 'react';
import { X, Check, Settings2 } from 'lucide-react';
import DevGuard from './DevGuard';

interface SpeedometerProps {
  speed: number;
}

type SpeedFormat = 'NORMAL' | 'MPH' | 'KNOTS' | 'MACH' | 'LIGHT' | 'BINARY' | 'ROMAN' | 'KLINGON';

const FORMAT_OPTIONS: { id: SpeedFormat, label: string, unit: string }[] = [
  { id: 'NORMAL', label: 'Estándar', unit: 'km/h' },
  { id: 'MPH', label: 'Millas por hora', unit: 'mph' },
  { id: 'KNOTS', label: 'Nudos Náuticos', unit: 'nudos' },
  { id: 'MACH', label: 'Número de Mach', unit: 'Mach' },
  { id: 'LIGHT', label: 'Velocidad Luz', unit: 'c' },
  { id: 'BINARY', label: 'Binario Humano', unit: 'bin' },
  { id: 'ROMAN', label: 'Numeración Romana', unit: 'Roman' },
  { id: 'KLINGON', label: 'Imperio Klingon', unit: 'Klingon' },
];

export default function Speedometer({ speed }: SpeedometerProps) {
  const [format, setFormat] = useState<SpeedFormat>('NORMAL');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [tempFormat, setTempFormat] = useState<SpeedFormat>('NORMAL');
  
  // Refs para diferenciar Drag de Click
  const startPosRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const [isDraggingUI, setIsDraggingUI] = useState(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    startPosRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 5) {
      isDraggingRef.current = true;
    }
  };

  const handleSave = () => {
    setFormat(tempFormat);
    setIsMenuOpen(false);
  };

  const toRoman = (num: number): string => {
    if (num <= 0) return "0";
    if (num > 3999) return "MAX";
    const lookup: { [key: string]: number } = {
      M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1
    };
    let roman = "";
    let n = Math.floor(num);
    for (let i in lookup) {
      while (n >= lookup[i]) {
        roman += i;
        n -= lookup[i];
      }
    }
    return roman;
  };

  const toKlingon = (num: number): string => {
    return Math.floor(num).toString();
  };

  const formatValue = () => {
    switch (format) {
      case 'MPH': return Math.floor(speed * 0.621371);
      case 'KNOTS': return Math.floor(speed * 0.539957);
      case 'MACH': return (speed / 1234.8).toFixed(2);
      case 'LIGHT': return (speed / 1079252848.8).toExponential(2);
      case 'BINARY': return Math.floor(speed).toString(2);
      case 'ROMAN': return toRoman(speed);
      case 'KLINGON': return toKlingon(speed);
      default: return Math.floor(speed);
    }
  };

  const currentUnit = FORMAT_OPTIONS.find(o => o.id === format)?.unit || 'km/h';

  // Generador de fondos temáticos dinámicos (Pure CSS)
  const getThematicBackground = () => {
    switch (format) {
      case 'MPH': // USA Style
        return 'linear-gradient(135deg, rgba(0,35,102,0.6) 0%, rgba(20,20,20,0.8) 50%, rgba(187,19,62,0.4) 100%)';
      case 'KNOTS': // Deep Sea / Sonar
        return 'radial-gradient(circle at 50% 50%, rgba(0,105,148,0.4) 0%, rgba(0,35,102,0.7) 100%)';
      case 'MACH': // Aerospace Metallic
        return 'linear-gradient(135deg, #1a1a1a 0%, #333 45%, #666 50%, #333 55%, #1a1a1a 100%)';
      case 'LIGHT': // Deep Space
        return `
          radial-gradient(circle at 20% 30%, white 0.5px, transparent 1px),
          radial-gradient(circle at 70% 60%, white 0.5px, transparent 1px),
          radial-gradient(circle at 40% 80%, white 0.5px, transparent 1px),
          radial-gradient(circle at 80% 20%, white 0.5px, transparent 1px),
          linear-gradient(to bottom, #000, #050505)
        `;
      case 'BINARY': // Matrix
        return 'linear-gradient(to bottom, #000 0%, #001a00 100%)';
      case 'ROMAN': // Parchment/Marble
        return 'linear-gradient(135deg, #d4c4a8 0%, #b8a689 100%)';
      case 'KLINGON': // Bird of Prey
        return 'linear-gradient(45deg, #000 0%, #4a0000 70%, #900 100%)';
      default: // Estándar Tesla
        return 'linear-gradient(180deg, rgba(30,30,30,0.8) 0%, rgba(10,10,10,0.9) 100%)';
    }
  };

  const getTextStyles = () => {
    if (format === 'ROMAN') return 'text-amber-900 drop-shadow-sm';
    if (format === 'KLINGON') return 'text-white drop-shadow-[0_0_15px_rgba(255,0,0,0.8)] font-klingon';
    if (format === 'BINARY') return 'text-green-500 drop-shadow-[0_0_10px_rgba(34,197,94,0.6)]';
    return 'text-white drop-shadow-[0_5px_15px_rgba(0,0,0,0.5)]';
  };

  return (
    <>
      <style jsx global>{`
        @font-face {
          font-family: 'pIqaD';
          src: url('/fonts/klingon.ttf') format('truetype');
        }
        .font-klingon {
          font-family: 'pIqaD', sans-serif !important;
        }
      `}</style>

      <DevGuard moduleId="[MAP-01]">
        <motion.div 
          drag 
          dragMomentum={false}
          onPointerDown={(e) => {
            handlePointerDown(e);
            setIsDraggingUI(true);
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={() => setIsDraggingUI(false)}
          onDragEnd={() => setIsDraggingUI(false)}
          onClick={(e) => {
            if (isDraggingRef.current) {
              e.stopPropagation();
              return;
            }
            setTempFormat(format);
            setIsMenuOpen(true);
          }}
          style={{ 
            touchAction: 'none',
            background: getThematicBackground()
          }}
          whileTap={{ scale: 0.95 }}
          className={`flex flex-col items-center justify-center backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl min-w-[180px] cursor-pointer transition-all duration-700 pointer-events-auto select-none group relative overflow-hidden ${isDraggingUI ? 'arrastrando' : ''}`}
        >
          {/* Brillo dinámico según modo */}
          <div className={`absolute inset-0 opacity-20 pointer-events-none transition-opacity duration-700 ${format === 'BINARY' ? 'bg-green-500/10' : ''}`}></div>
          
          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-40 transition-opacity">
            <Settings2 className="h-4 w-4 text-white" />
          </div>

          <span className={`text-7xl font-black tabular-nums tracking-tighter transition-all duration-700 ${getTextStyles()}`}>
            {formatValue()}
          </span>
          <span className={`text-[10px] font-black uppercase tracking-[0.2em] mt-2 transition-colors duration-700 ${format === 'ROMAN' ? 'text-amber-800' : 'text-blue-400'}`}>
            {currentUnit}
          </span>
        </motion.div>
      </DevGuard>

      <AnimatePresence>
        {isMenuOpen && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 pointer-events-none">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
              onClick={() => setIsMenuOpen(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-zinc-900 border border-white/10 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl pointer-events-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Velocímetro</h3>
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1">Configuración de pantalla</p>
                </div>
                <button 
                  onClick={() => setIsMenuOpen(false)}
                  className="h-10 w-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 mb-8 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {FORMAT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setTempFormat(opt.id)}
                    className={`flex items-center justify-between px-6 py-4 rounded-2xl transition-all border ${
                      tempFormat === opt.id 
                        ? 'bg-blue-600/20 border-blue-500 text-white' 
                        : 'bg-white/5 border-transparent text-zinc-400 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-black uppercase tracking-tight">{opt.label}</span>
                      <span className="text-[10px] opacity-50 font-bold">{opt.unit}</span>
                    </div>
                    {tempFormat === opt.id && <Check className="h-5 w-5 text-blue-500" />}
                  </button>
                ))}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="flex-1 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-xs transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-blue-900/20 transition-all"
                >
                  Guardar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        
        /* Optimización de arrastre: el estilo se hereda de globals.css (.arrastrando) */
      `}</style>
    </>
  );
}
