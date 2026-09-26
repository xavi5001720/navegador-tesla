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
  { code: 'SCQ', city: 'Santiago de Compostela' },
  { code: 'PMI', city: 'Palma de Mallorca' },
  { code: 'TFS', city: 'Tenerife Sur' },
  { code: 'LPA', city: 'Gran Canaria' },
  { code: 'ACE', city: 'Lanzarote' },
  { code: 'FUE', city: 'Fuerteventura' },
  { code: 'IBZ', city: 'Ibiza' },
  { code: 'SDR', city: 'Santander' },
  { code: 'VGO', city: 'Vigo' },
  { code: 'OVD', city: 'Asturias' },
  { code: 'ZAZ', city: 'Zaragoza' },
  { code: 'GRX', city: 'Granada' },
  { code: 'MJV', city: 'Murcia' },
  { code: 'XRY', city: 'Jerez de la Frontera' },
  { code: 'REU', city: 'Reus (Tarragona)' },
  { code: 'GRO', city: 'Girona' },
  { code: 'MAH', city: 'Menorca' },
];

interface Dest { code: string; city: string; }
interface DestGroup { label: string; items: Dest[]; }

const DESTINATION_GROUPS: DestGroup[] = [
  { label: '🌍 Cualquier destino', items: [
    { code: 'ANY', city: 'Cualquier destino — chollos del momento' },
  ]},
  { label: '🇵🇹 Portugal', items: [
    { code: 'LIS', city: 'Lisboa' },
    { code: 'OPO', city: 'Oporto' },
    { code: 'FAO', city: 'Faro (Algarve)' },
    { code: 'FNC', city: 'Funchal (Madeira)' },
  ]},
  { label: '🇫🇷 Francia', items: [
    { code: 'PAR', city: 'París' },
    { code: 'NCE', city: 'Niza' },
    { code: 'LYS', city: 'Lyon' },
    { code: 'MRS', city: 'Marsella' },
    { code: 'BOD', city: 'Burdeos' },
    { code: 'TLS', city: 'Toulouse' },
    { code: 'NTE', city: 'Nantes' },
    { code: 'MPL', city: 'Montpellier' },
    { code: 'BIQ', city: 'Biarritz' },
  ]},
  { label: '🇮🇹 Italia', items: [
    { code: 'MIL', city: 'Milán' },
    { code: 'ROM', city: 'Roma' },
    { code: 'NAP', city: 'Nápoles' },
    { code: 'VCE', city: 'Venecia' },
    { code: 'FLR', city: 'Florencia' },
    { code: 'BLQ', city: 'Bolonia' },
    { code: 'TRN', city: 'Turín' },
    { code: 'BRI', city: 'Bari' },
    { code: 'PMO', city: 'Palermo (Sicilia)' },
    { code: 'CTA', city: 'Catania (Sicilia)' },
    { code: 'OLB', city: 'Olbia (Cerdeña)' },
    { code: 'CAG', city: 'Cagliari (Cerdeña)' },
  ]},
  { label: '🇬🇧 Reino Unido & Irlanda', items: [
    { code: 'LON', city: 'Londres' },
    { code: 'EDI', city: 'Edimburgo' },
    { code: 'MAN', city: 'Mánchester' },
    { code: 'BRS', city: 'Bristol' },
    { code: 'BHX', city: 'Birmingham' },
    { code: 'GLA', city: 'Glasgow' },
    { code: 'DUB', city: 'Dublín' },
    { code: 'BFS', city: 'Belfast' },
  ]},
  { label: '🇩🇪 Alemania', items: [
    { code: 'BER', city: 'Berlín' },
    { code: 'MUC', city: 'Múnich' },
    { code: 'FRA', city: 'Fráncfort' },
    { code: 'DUS', city: 'Düsseldorf' },
    { code: 'HAM', city: 'Hamburgo' },
    { code: 'CGN', city: 'Colonia' },
    { code: 'STR', city: 'Stuttgart' },
    { code: 'NUE', city: 'Núremberg' },
  ]},
  { label: '🇳🇱 Países Bajos & Bélgica', items: [
    { code: 'AMS', city: 'Ámsterdam' },
    { code: 'EIN', city: 'Eindhoven' },
    { code: 'BRU', city: 'Bruselas' },
    { code: 'CRL', city: 'Bruselas Charleroi' },
  ]},
  { label: '🇦🇹 Austria & Suiza', items: [
    { code: 'VIE', city: 'Viena' },
    { code: 'SZG', city: 'Salzburgo' },
    { code: 'INN', city: 'Innsbruck' },
    { code: 'ZRH', city: 'Zúrich' },
    { code: 'GVA', city: 'Ginebra' },
    { code: 'BSL', city: 'Basilea' },
  ]},
  { label: '🇨🇿 Rep. Checa, Hungría & Polonia', items: [
    { code: 'PRG', city: 'Praga' },
    { code: 'BUD', city: 'Budapest' },
    { code: 'WAW', city: 'Varsovia' },
    { code: 'KRK', city: 'Cracovia' },
    { code: 'WRO', city: 'Wroclaw' },
    { code: 'GDN', city: 'Gdansk' },
  ]},
  { label: '🇸🇪 Escandinavia & Bálticos', items: [
    { code: 'OSL', city: 'Oslo' },
    { code: 'STO', city: 'Estocolmo' },
    { code: 'GOT', city: 'Gotemburgo' },
    { code: 'CPH', city: 'Copenhague' },
    { code: 'HEL', city: 'Helsinki' },
    { code: 'REK', city: 'Reikiavik' },
    { code: 'RIX', city: 'Riga' },
    { code: 'TLL', city: 'Tallin' },
    { code: 'VNO', city: 'Vilna' },
  ]},
  { label: '🇬🇷 Grecia & Chipre', items: [
    { code: 'ATH', city: 'Atenas' },
    { code: 'SKG', city: 'Salónica' },
    { code: 'HER', city: 'Heraclión (Creta)' },
    { code: 'CHQ', city: 'Chania (Creta)' },
    { code: 'RHO', city: 'Rodas' },
    { code: 'JTR', city: 'Santorini' },
    { code: 'JMK', city: 'Mikonos' },
    { code: 'CFU', city: 'Corfú' },
    { code: 'KGS', city: 'Kos' },
    { code: 'ZTH', city: 'Zakynthos (Zante)' },
    { code: 'LCA', city: 'Larnaca (Chipre)' },
    { code: 'PFO', city: 'Pafos (Chipre)' },
  ]},
  { label: '🇹🇷 Turquía', items: [
    { code: 'IST', city: 'Estambul' },
    { code: 'AYT', city: 'Antalya' },
    { code: 'DLM', city: 'Dalaman' },
    { code: 'BJV', city: 'Bodrum' },
    { code: 'ADB', city: 'Izmir' },
  ]},
  { label: '🇭🇷 Croacia & Balcanes', items: [
    { code: 'ZAG', city: 'Zagreb' },
    { code: 'SPU', city: 'Split' },
    { code: 'DBV', city: 'Dubrovnik' },
    { code: 'ZAD', city: 'Zadar' },
    { code: 'BEG', city: 'Belgrado' },
    { code: 'TIA', city: 'Tirana' },
    { code: 'SOF', city: 'Sofía (Bulgaria)' },
    { code: 'OTP', city: 'Bucarest (Rumania)' },
  ]},
  { label: '🇲🇦 Marruecos & Norte de África', items: [
    { code: 'RAK', city: 'Marrakech' },
    { code: 'CMN', city: 'Casablanca' },
    { code: 'TNG', city: 'Tánger' },
    { code: 'FEZ', city: 'Fez' },
    { code: 'AGA', city: 'Agadir' },
    { code: 'TUN', city: 'Túnez' },
    { code: 'CAI', city: 'El Cairo' },
    { code: 'HRG', city: 'Hurghada' },
    { code: 'SSH', city: 'Sharm el-Sheikh' },
  ]},
  { label: '🇲🇹 Malta & Mediterráneo', items: [
    { code: 'MLA', city: 'Malta' },
    { code: 'SJJ', city: 'Sarajevo' },
  ]},
  { label: '🌴 Canarias', items: [
    { code: 'TFN', city: 'Tenerife Norte' },
    { code: 'TFS', city: 'Tenerife Sur' },
    { code: 'LPA', city: 'Gran Canaria' },
    { code: 'ACE', city: 'Lanzarote' },
    { code: 'FUE', city: 'Fuerteventura' },
    { code: 'SPC', city: 'La Palma' },
  ]},
  { label: '🏝️ Islas Baleares', items: [
    { code: 'PMI', city: 'Palma de Mallorca' },
    { code: 'IBZ', city: 'Ibiza' },
    { code: 'MAH', city: 'Menorca' },
  ]},
  { label: '🇺🇸 América', items: [
    { code: 'JFK', city: 'Nueva York' },
    { code: 'MIA', city: 'Miami' },
    { code: 'LAX', city: 'Los Ángeles' },
    { code: 'ORD', city: 'Chicago' },
    { code: 'BOS', city: 'Boston' },
    { code: 'CUN', city: 'Cancún' },
    { code: 'MEX', city: 'Ciudad de México' },
    { code: 'BOG', city: 'Bogotá' },
    { code: 'LIM', city: 'Lima' },
    { code: 'EZE', city: 'Buenos Aires' },
    { code: 'GRU', city: 'São Paulo' },
    { code: 'GIG', city: 'Río de Janeiro' },
    { code: 'HAV', city: 'La Habana' },
    { code: 'SDQ', city: 'Santo Domingo' },
  ]},
  { label: '🇦🇪 Oriente Medio', items: [
    { code: 'DXB', city: 'Dubái' },
    { code: 'DOH', city: 'Doha' },
    { code: 'AUH', city: 'Abu Dabi' },
    { code: 'AMM', city: 'Ammán' },
    { code: 'TLV', city: 'Tel Aviv' },
  ]},
  { label: '🌏 Asia', items: [
    { code: 'BKK', city: 'Bangkok' },
    { code: 'HKT', city: 'Phuket' },
    { code: 'SIN', city: 'Singapur' },
    { code: 'KUL', city: 'Kuala Lumpur' },
    { code: 'HKG', city: 'Hong Kong' },
    { code: 'NRT', city: 'Tokio' },
    { code: 'DEL', city: 'Delhi' },
    { code: 'BOM', city: 'Mumbai' },
    { code: 'DPS', city: 'Bali' },
  ]},
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
  flexDeparture: string;      // primer día en que puedes salir
  flexDepartureEnd: string;   // último día en que puedes salir
  flexDurationMin: number;    // mínimo de días que quieres estar
  flexDurationMax: number;    // máximo de días que quieres estar
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

  // Flexible dates: ventana de disponibilidad + rango de duración
  const [flexDeparture, setFlexDeparture] = useState(defDep);
  const [flexDepartureEnd, setFlexDepartureEnd] = useState(defRet);
  const [flexDurationMin, setFlexDurationMin] = useState(3);
  const [flexDurationMax, setFlexDurationMax] = useState(7);

  // Travellers
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // En modo flexible usamos el punto medio del rango de días como fecha de vuelta orientativa
    const flexReturnAt = (() => {
      if (oneWay) return '';
      const midDays = Math.round((flexDurationMin + flexDurationMax) / 2);
      const dep = new Date(flexDeparture);
      dep.setDate(dep.getDate() + midDays);
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
      flexDepartureEnd,
      flexDurationMin,
      flexDurationMax,
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
                {o.city}
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
            {DESTINATION_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.items.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.city}
                  </option>
                ))}
              </optgroup>
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
            {/* Ventana de disponibilidad: desde / hasta */}
            <div>
              <label className="block text-xs text-slate-600 mb-1.5">📆 ¿En qué fechas puedes viajar?</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-slate-500 mb-1">Desde (salida más pronto)</p>
                  <input
                    type="date"
                    value={flexDeparture}
                    onChange={(e) => {
                      setFlexDeparture(e.target.value);
                      // Si el fin queda antes que el inicio, lo adelantamos
                      if (flexDepartureEnd < e.target.value) setFlexDepartureEnd(e.target.value);
                    }}
                    min={new Date().toISOString().slice(0, 10)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 transition-colors"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 mb-1">Hasta (salida más tarde)</p>
                  <input
                    type="date"
                    value={flexDepartureEnd}
                    onChange={(e) => setFlexDepartureEnd(e.target.value)}
                    min={flexDeparture}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 transition-colors"
                  />
                </div>
              </div>
            </div>
            {/* Duración rango min/max */}
            {!oneWay && (
              <div>
                <label className="block text-xs text-slate-600 mb-2">¿Cuántos días quieres estar?</label>
                <div className="flex items-center gap-3">
                  {/* Mínimo */}
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-500 mb-1 text-center">Mínimo</p>
                    <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setFlexDurationMin(Math.max(1, flexDurationMin - 1))}
                        disabled={flexDurationMin <= 1}
                        className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center transition-colors disabled:opacity-30 text-sm"
                      >−</button>
                      <span className="text-lg font-black text-white w-8 text-center">{flexDurationMin}</span>
                      <button
                        type="button"
                        onClick={() => setFlexDurationMin(Math.min(flexDurationMax - 1, flexDurationMin + 1))}
                        disabled={flexDurationMin >= flexDurationMax - 1}
                        className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center transition-colors disabled:opacity-30 text-sm"
                      >+</button>
                    </div>
                  </div>

                  {/* Separador visual */}
                  <div className="flex flex-col items-center gap-0.5 pt-4">
                    <div className="w-6 h-px bg-slate-700" />
                    <span className="text-[10px] text-slate-600">a</span>
                    <div className="w-6 h-px bg-slate-700" />
                  </div>

                  {/* Máximo */}
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-500 mb-1 text-center">Máximo</p>
                    <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setFlexDurationMax(Math.max(flexDurationMin + 1, flexDurationMax - 1))}
                        disabled={flexDurationMax <= flexDurationMin + 1}
                        className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center transition-colors disabled:opacity-30 text-sm"
                      >−</button>
                      <span className="text-lg font-black text-white w-8 text-center">{flexDurationMax}</span>
                      <button
                        type="button"
                        onClick={() => setFlexDurationMax(Math.min(30, flexDurationMax + 1))}
                        disabled={flexDurationMax >= 30}
                        className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center transition-colors disabled:opacity-30 text-sm"
                      >+</button>
                    </div>
                  </div>
                </div>

                {/* Badge resumen */}
                <div className="mt-2 flex justify-center">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950/60 border border-red-900/50 text-red-400 text-xs font-bold">
                    <span>🗓️</span>
                    <span>Entre {flexDurationMin} y {flexDurationMax} días</span>
                  </span>
                </div>
              </div>
            )}
            <p className="text-[11px] text-slate-600">
              Buscaremos el mejor precio saliendo entre esas fechas y quedándote entre {flexDurationMin} y {flexDurationMax} días
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
