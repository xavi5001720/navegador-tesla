'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

interface SpeedometerProps {
  speed: number;
}

type SpeedFormat = 'NORMAL' | 'MPH' | 'KNOTS' | 'MACH' | 'LIGHT' | 'BINARY' | 'ROMAN' | 'KLINGON';

export default function Speedometer({ speed }: SpeedometerProps) {
  const [format, setFormat] = useState<SpeedFormat>('NORMAL');

  const cycleFormat = () => {
    const formats: SpeedFormat[] = ['NORMAL', 'MPH', 'KNOTS', 'MACH', 'LIGHT', 'BINARY', 'ROMAN', 'KLINGON'];
    const nextIndex = (formats.indexOf(format) + 1) % formats.length;
    setFormat(formats[nextIndex]);
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
    // Klingon digits (pIqaD) from CSUR (0xF8E0 - 0xF8E9)
    const klingonDigits = ['', '', '', '', '', '', '', '', '', ''];
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

  const getLabel = () => {
    switch (format) {
      case 'MPH': return 'mph';
      case 'KNOTS': return 'kts';
      case 'MACH': return 'Mach';
      case 'LIGHT': return 'c';
      case 'BINARY': return 'km/h (bin)';
      case 'ROMAN': return 'Roman';
      case 'KLINGON': return 'pIqaD';
      default: return 'km/h';
    }
  };

  return (
    <motion.div 
      drag 
      dragMomentum={false}
      onClick={cycleFormat}
      style={{ touchAction: 'none' }}
      whileTap={{ scale: 0.95 }}
      className="flex flex-col items-center justify-center bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl min-w-[140px] cursor-pointer hover:bg-black/50 transition-colors pointer-events-auto select-none"
    >
      <span className={`text-6xl font-black text-white tabular-nums tracking-tighter ${format === 'KLINGON' ? 'font-serif' : ''}`}>
        {formatValue()}
      </span>
      <span className="text-xs font-bold text-blue-500 uppercase tracking-widest mt-1">
        {getLabel()}
      </span>
    </motion.div>
  );
}
