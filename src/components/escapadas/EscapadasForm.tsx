'use client';

import React, { useState } from 'react';
import { EscapadaSearchQuery, AIRPORTS_MAP } from '@/lib/travelpayouts';

interface EscapadasFormProps {
  onSearch: (query: EscapadaSearchQuery) => void;
  isLoading: boolean;
}

const ORIGIN_AIRPORTS = [
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
  const [destination, setDestination] = useState('ANY');
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);

  const [durationDays, setDurationDays] = useState(2);
  const [flexibility, setFlexibility] = useState<'weekend' | 'month' | 'dates'>('weekend');
  const [month, setMonth] = useState('2026-10');
  const [minStars, setMinStars] = useState(3);
  const [evChargingOnly, setEvChargingOnly] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({
      origin,
      destination,
      adults,
      children,
      infants,
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
      {/* SECCIÓN 1: DÓNDE Y A DÓNDE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Origen */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            ✈️ Origen (Desde dónde vuelas)
          </label>
          <select
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 transition-all cursor-pointer"
          >
            {ORIGIN_AIRPORTS.map((a) => (
              <option key={a.code} value={a.code}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {/* Destino */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            🗺️ Destino (¿A dónde quieres ir?)
          </label>
          <select
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 transition-all cursor-pointer font-medium text-amber-400"
          >
            <option value="ANY">🌍 Cualquier Destino (Buscar los Chollos Más Baratos)</option>
            {Object.entries(AIRPORTS_MAP).map(([code, info]) => (
              <option key={code} value={code} className="text-white">
                📍 {info.city} ({info.country})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* SECCIÓN 2: QUIÉNES VIAJAN (EDADES) */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
          <span>👥 ¿Quiénes Viajan? (Selección por Edades)</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Adultos */}
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Adultos (+12 años)</label>
            <select
              value={adults}
              onChange={(e) => setAdults(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-red-500 focus:outline-none"
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} Adulto{n > 1 ? 's' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Niños */}
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Niños (2-11 años)</label>
            <select
              value={children}
              onChange={(e) => setChildren(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-red-500 focus:outline-none"
            >
              {[0, 1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n} Niño{n !== 1 ? 's' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Bebés */}
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Bebés (0-2 años)</label>
            <select
              value={infants}
              onChange={(e) => setInfants(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-red-500 focus:outline-none"
            >
              {[0, 1, 2].map((n) => (
                <option key={n} value={n}>
                  {n} Bebé{n !== 1 ? 's' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* SECCIÓN 3: FECHAS, DURACIÓN Y HOTEL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Duración */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            ⏳ Duración
          </label>
          <select
            value={durationDays}
            onChange={(e) => setDurationDays(Number(e.target.value))}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 transition-all cursor-pointer"
          >
            <option value={2}>2 Días (Fin de Semana corto)</option>
            <option value={3}>3 Días (Fin de Semana largo)</option>
            <option value={4}>4-5 Días (Puente)</option>
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
            <option value="weekend">Próximos Fines de Semana</option>
            <option value="month">En un Mes Concreto</option>
          </select>
        </div>

        {/* Categoría de Hotel */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            🏨 Mínimo Hotel
          </label>
          <select
            value={minStars}
            onChange={(e) => setMinStars(Number(e.target.value))}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 transition-all cursor-pointer"
          >
            <option value={3}>3★ Confort</option>
            <option value={4}>4★ Calidad Superior</option>
            <option value={5}>5★ Lujo & Premium</option>
          </select>
        </div>
      </div>

      {/* EXTRAS Y BOTÓN DE BÚSQUEDA */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-800">
        <label className="flex items-center space-x-3 cursor-pointer text-sm text-slate-300 hover:text-white transition-colors">
          <input
            type="checkbox"
            checked={evChargingOnly}
            onChange={(e) => setEvChargingOnly(e.target.checked)}
            className="w-4 h-4 rounded border-slate-700 text-red-600 focus:ring-red-500 bg-slate-800"
          />
          <span>⚡ Prevalecer hoteles con punto de carga Coche Eléctrico / Tesla</span>
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
              <span>Buscando mejores ofertas...</span>
            </>
          ) : (
            <>
              <span>🔍 Buscar la Mejor Combinación Chollo</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};
