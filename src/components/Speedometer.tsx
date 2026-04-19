'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { X, Check, Settings2 } from 'lucide-react';

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
    // Klingon digits (pIqaD) Unicode mapping
    const klingonDigits = ['\uF8E0', '\uF8E1', '\uF8E2', '\uF8E3', '\uF8E4', '\uF8E5', '\uF8E6', '\uF8E7', '\uF8E8', '\uF8E9'];
    return Math.floor(num).toString().split('').map(d => klingonDigits[parseInt(d)]).join('');
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

  return (
    <>
      <style jsx global>{`
        @font-face {
          font-family: 'pIqaD';
          src: url('https://raw.githubusercontent.com/Deiz/pIqaD/master/fonts/pIqaD.ttf') format('truetype');
        }
        .font-klingon {
          font-family: 'pIqaD', sans-serif !important;
        }
      `}</style>

      <motion.div 
        drag 
        dragMomentum={false}
        onClick={() => {
          setTempFormat(format);
          setIsMenuOpen(true);
        }}
        style={{ touchAction: 'none' }}
        whileTap={{ scale: 0.95 }}
        className="flex flex-col items-center justify-center bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl min-w-[140px] cursor-pointer hover:bg-black/50 transition-colors pointer-events-auto select-none group relative"
      >
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-40 transition-opacity">
          <Settings2 className="h-3 w-3 text-white" />
        </div>
        <span className={`text-6xl font-black text-white tabular-nums tracking-tighter ${format === 'KLINGON' ? 'font-klingon text-amber-500' : ''}`}>
          {formatValue()}
        </span>
        <span className="text-xs font-bold text-blue-500 uppercase tracking-widest mt-1">
          {currentUnit}
        </span>
      </motion.div>

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
      `}</style>
    </>
  );
}
