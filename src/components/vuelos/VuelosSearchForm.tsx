'use client';

import React, { useState } from 'react';

const ORIGINS = [
  { code: 'MAD', city: 'Madrid' },
  { code: 'BCN', city: 'Barcelona' },
  { code: 'VLC', city: 'Valencia' },
  { code: 'AGP', city: 'Málaga' },
  { code: 'SVQ', city: 'Sevilla' },
  { code: 'BIO', city: 'Bilbao' },
  { code: 'ALC', city: 'Alicante' },
  { code: 'SCQ', city: 'Santiago' },
];

const DESTINATIONS = [
  { code: 'ANY', city: '🌍 Cualquier destino (chollos)', country: '' },
  { code: 'MIL', city: 'Milán', country: 'Italia 🇮🇹' },
  { code: 'ROM', city: 'Roma', country: 'Italia 🇮🇹' },
  { code: 'PAR', city: 'París', country: 'Francia 🇫🇷' },
  { code: 'LON', city: 'Londres', country: 'Reino Unido 🇬🇧' },
  { code: 'BER', city: 'Berlín', country: 'Alemania 🇩🇪' },
  { code: 'AMS', city: 'Ámsterdam', country: 'Países Bajos 🇳🇱' },
  { code: 'PRG', city: 'Praga', country: 'Rep. Checa 🇨🇿' },
  { code: 'VIE', city: 'Viena', country: 'Austria 🇦🇹' },
  { code: 'BUD', city: 'Budapest', country: 'Hungría 🇭🇺' },
  { code: 'OPO', city: 'Oporto', country: 'Portugal 🇵🇹' },
  { code: 'LIS', city: 'Lisboa', country: 'Portugal 🇵🇹' },
  { code: 'PMI', city: 'Mallorca', country: 'España 🇪🇸' },
  { code: 'IBZ', city: 'Ibiza', country: 'España 🇪🇸' },
  { code: 'TFN', city: 'Tenerife', country: 'España 🇪🇸' },
  { code: 'RAK', city: 'Marrakech', country: 'Marruecos 🇲🇦' },
];

// Next weekend helper
function nextWeekendDates(): { dep: string; ret: string } {
  const now = new Date();
  const day = now.getDay(); // 0=sun, 6=sat
  const daysUntilSat = (6 - day + 7) % 7 || 7;
  const sat = new Date(now.getTime() + daysUntilSat * 86400000);
  const sun = new Date(sat.getTime() + 86400000);
  return {
    dep: sat.toISOString().slice(0, 10),
    ret: sun.toISOString().slice(0, 10),
  };
}

const DURATION_OPTIONS = [
  { label: '2 días', days: 2 },
  { label: '3 días', days: 3 },
  { label: '5 días', days: 5 },
  { label: '7 días', days: 7 },
  { label: '10 días', days: 10 },
];

export interface VuelosQuery {
  origin: string;
  destination: string;
  departureAt: string;
  returnAt: string;
  adults: number;
  children: number;
  infants: number;
  oneWay: boolean;
  dateMode: 'exact' | 'flexible';
  flexDeparture: string;  // fecha aproximada de salida
  flexDuration: number;   // duración en días
}

interface Props {
  onSearch: (q: VuelosQuery) => void;
  isLoading: boolean;
}

const { dep: defDep, ret: defRet } = nextWeekendDates();

export default function VuelosSearchForm({ onSearch, isLoading }: Props) {
  const [origin, setOrigin] = useState('MAD');
  const [destination, setDestination] = useState('ANY');
  const [oneWay, setOneWay] = useState(false);
  const [dateMode, setDateMode] = useState<'exact' | 'flexible'>('flexible');

  // Exact dates
  const [departureAt, setDepartureAt] = useState(defDep);
  const [returnAt, setReturnAt] = useState(defRet);

  // Flexible dates: solo necesitamos la fecha de salida y cuántos días
  const [flexDeparture, setFlexDeparture] = useState(defDep);
  const [flexDuration, setFlexDuration] = useState(3);

  // Travellers
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // En modo flexible, calculamos la vuelta sumando los días elegidos a la salida
    const flexReturnAt = (() => {
      if (oneWay) return '';
      const dep = new Date(flexDeparture);
      dep.setDate(dep.getDate() + flexDuration);
      return dep.toISOString().slice(0, 10);
    })();
    onSearch({
      origin,
      destination,
      departureAt: dateMode === 'exact' ? departureAt : flexDeparture,
      returnAt: oneWay ? '' : dateMode === 'exact' ? returnAt : flexReturnAt,
      adults,
      children,
      infants,
      oneWay,
      dateMode,
      flexDeparture,
      flexDuration,
    });
  };

  const Counter = ({
    label,
    value,
    onChange,
    min = 0,
    max = 6,
    sublabel,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min?: number;
    max?: number;
    sublabel?: string;
  }) => (
    <div className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
      <div>
        <span className="text-sm font-semibold text-white">{label}</span>
        {sublabel && <p className="text-[11px] text-slate-500">{sublabel}</p>}
      </div>
      <div className="flex items-center space-x-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center transition-colors disabled:opacity-30"
          disabled={value <= min}
        >
          −
        </button>
        <span className="text-lg font-black text-white w-6 text-center">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center transition-colors disabled:opacity-30"
          disabled={value >= max}
        >
          +
        </button>
      </div>
    </div>
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-5 space-y-5 shadow-xl"
    >
      {/* Row 1: Tipo de vuelo toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wide">✈️ Buscar vuelos baratos</h2>
        <div className="flex bg-slate-950 border border-slate-800 rounded-xl overflow-hidden text-xs font-bold">
          <button
            type="button"
            onClick={() => setOneWay(false)}
            className={`px-4 py-2 transition-colors ${!oneWay ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Ida y Vuelta
          </button>
          <button
            type="button"
            onClick={() => setOneWay(true)}
            className={`px-4 py-2 transition-colors ${oneWay ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Solo Ida
          </button>
        </div>
      </div>

      {/* Row 2: Origen & Destino */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500 font-semibold mb-1.5 uppercase tracking-wide">🛫 Desde</label>
          <select
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 transition-colors"
          >
            {ORIGINS.map((o) => (
              <option key={o.code} value={o.code}>
                {o.city} ({o.code})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 font-semibold mb-1.5 uppercase tracking-wide">🛬 Hasta</label>
          <select
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 transition-colors"
          >
            {DESTINATIONS.map((d) => (
              <option key={d.code} value={d.code}>
                {d.city}{d.country ? ` — ${d.country}` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 3: Modo de Fechas */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs text-slate-500 font-semibold uppercase tracking-wide">📅 Fechas</label>
          <div className="flex bg-slate-950 border border-slate-800 rounded-xl overflow-hidden text-xs font-bold">
            <button
              type="button"
              onClick={() => setDateMode('flexible')}
              className={`px-3 py-1.5 transition-colors ${dateMode === 'flexible' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'}`}
            >
              Rango
            </button>
            <button
              type="button"
              onClick={() => setDateMode('exact')}
              className={`px-3 py-1.5 transition-colors ${dateMode === 'exact' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'}`}
            >
              Fecha exacta
            </button>
          </div>
        </div>

        {dateMode === 'exact' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Ida</label>
              <input
                type="date"
                value={departureAt}
                onChange={(e) => setDepartureAt(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 transition-colors"
              />
            </div>
            {!oneWay && (
              <div>
                <label className="block text-xs text-slate-600 mb-1">Vuelta</label>
                <input
                  type="date"
                  value={returnAt}
                  onChange={(e) => setReturnAt(e.target.value)}
                  min={departureAt}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Fecha aproximada de salida */}
            <div>
              <label className="block text-xs text-slate-600 mb-1">¿A partir de cuándo puedes salir?</label>
              <input
                type="date"
                value={flexDeparture}
                onChange={(e) => setFlexDeparture(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 transition-colors"
              />
            </div>
            {/* Duración */}
            {!oneWay && (
              <div>
                <label className="block text-xs text-slate-600 mb-2">¿Cuántos días quieres estar?</label>
                <div className="flex flex-wrap gap-2">
                  {DURATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.days}
                      type="button"
                      onClick={() => setFlexDuration(opt.days)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                        flexDuration === opt.days
                          ? 'bg-red-600 border-red-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[11px] text-slate-600">
              Buscaremos los mejores precios disponibles a partir de esa fecha
            </p>
          </div>
        )}
      </div>

      {/* Row 4: Viajeros */}
      <div>
        <label className="block text-xs text-slate-500 font-semibold uppercase tracking-wide mb-2">👥 Viajeros</label>
        <div className="bg-slate-950/60 rounded-xl border border-slate-800 px-4 py-1">
          <Counter label="Adultos" sublabel="+12 años" value={adults} onChange={setAdults} min={1} max={9} />
          <Counter label="Niños" sublabel="2–11 años" value={children} onChange={setChildren} max={8} />
          <Counter label="Bebés" sublabel="0–1 año" value={infants} onChange={setInfants} max={4} />
        </div>
        <p className="text-[11px] text-slate-600 mt-1.5 pl-1">
          Total: {adults + children + infants} viajeros · {adults} {adults === 1 ? 'adulto' : 'adultos'}
          {children > 0 ? `, ${children} ${children === 1 ? 'niño' : 'niños'}` : ''}
          {infants > 0 ? `, ${infants} ${infants === 1 ? 'bebé' : 'bebés'}` : ''}
        </p>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-3.5 bg-red-600 hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black rounded-xl text-sm transition-all duration-300 shadow-lg hover:shadow-red-600/25 flex items-center justify-center space-x-2"
      >
        {isLoading ? (
          <>
            <span className="animate-spin text-lg">⟳</span>
            <span>Buscando vuelos baratos...</span>
          </>
        ) : (
          <>
            <span>🔍</span>
            <span>Buscar vuelos más baratos</span>
          </>
        )}
      </button>
    </form>
  );
}
