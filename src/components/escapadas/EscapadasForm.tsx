'use client';

import React, { useState } from 'react';
import { EscapadaSearchQuery } from '@/lib/travelpayouts';

interface EscapadasFormProps {
  onSearch: (query: EscapadaSearchQuery) => void;
  isLoading: boolean;
}

const AIRPORTS = [
  { code: 'MAD', name: 'Madrid (MAD)' },
  { code: 'BCN', name: 'Barcelona (BCN)' },
  { code: 'VLC', name: 'Valencia (VLC)' },
  { code: 'AGP', name: 'Málaga (AGP)' },
  { code: 'SVQ', name: 'Sevilla (SVQ)' },
  { code: 'BIO', name: 'Bilbao (BIO)' },
  { code: 'ALC', name: 'Alicante (ALC)' },
  { code: 'SCQ', name: 'Santiago (SCQ)' },
];

export const EscapadasForm: React.FC<EscapadasFormProps> = ({ onSearch, isLoading }) => {
  const [origin, setOrigin] = useState('MAD');
  const [durationDays, setDurationDays] = useState(2);
  const [flexibility, setFlexibility] = useState<'weekend' | 'month' | 'dates'>('weekend');
  const [month, setMonth] = useState('2026-10');
  const [minStars, setMinStars] = useState(3);
  const [evChargingOnly, setEvChargingOnly] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({
      origin,
      durationDays,
      flexibility,
      month: flexibility === 'month' ? month : undefined,
      minStars,
      evChargingOnly,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 text-white"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Aeropuerto Origen */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            ✈️ Origen (Provincia / Aeropuerto)
          </label>
          <select
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 transition-all cursor-pointer"
          >
            {AIRPORTS.map((a) => (
              <option key={a.code} value={a.code}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {/* Duración */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            ⏳ Duración del Viaje
          </label>
          <select
            value={durationDays}
            onChange={(e) => setDurationDays(Number(e.target.value))}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 transition-all cursor-pointer"
          >
            <option value={2}>2 Días (Fin de Semana Corto)</option>
            <option value={3}>3 Días (Fin de Semana Largo)</option>
            <option value={4}>4-5 Días (Escapada / Puente)</option>
            <option value={7}>7 Días (Semana Completa)</option>
          </select>
        </div>

        {/* Cuándo Viajar */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            📅 Cuándo Viajar
          </label>
          <select
            value={flexibility}
            onChange={(e) => setFlexibility(e.target.value as any)}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 transition-all cursor-pointer"
          >
            <option value="weekend">En Próximos Fines de Semana</option>
            <option value="month">En un Mes Concreto</option>
          </select>
        </div>

        {/* Categoría de Hotel */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            🏨 Mínimo Estrellas Hotel
          </label>
          <select
            value={minStars}
            onChange={(e) => setMinStars(Number(e.target.value))}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 transition-all cursor-pointer"
          >
            <option value={3}>3★ Estándar Confort</option>
            <option value={4}>4★ Calidad Superior</option>
            <option value={5}>5★ Lujo & Premium</option>
          </select>
        </div>
      </div>

      {/* Extras y Botón */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-800">
        <label className="flex items-center space-x-3 cursor-pointer text-sm text-slate-300 hover:text-white transition-colors">
          <input
            type="checkbox"
            checked={evChargingOnly}
            onChange={(e) => setEvChargingOnly(e.target.checked)}
            className="w-4 h-4 rounded border-slate-700 text-red-600 focus:ring-red-500 bg-slate-800"
          />
          <span>⚡ Solo hoteles recomendados con punto de carga Coche Eléctrico / Tesla</span>
        </label>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold rounded-xl shadow-lg hover:shadow-red-600/30 transform hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Buscando mejores combinaciones...</span>
            </>
          ) : (
            <>
              <span>🔍 Buscar la Mejor Escapada Chollo</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};
