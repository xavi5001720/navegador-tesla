'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import VuelosSearchForm, { VuelosQuery } from '@/components/vuelos/VuelosSearchForm';
import VueloCard, { VueloResult } from '@/components/vuelos/VueloCard';

const ORIGIN_NAMES: Record<string, string> = {
  MAD: 'Madrid',
  BCN: 'Barcelona',
  VLC: 'Valencia',
  AGP: 'Málaga',
  SVQ: 'Sevilla',
  BIO: 'Bilbao',
  ALC: 'Alicante',
  SCQ: 'Santiago',
  PMI: 'Palma de Mallorca',
  TFS: 'Tenerife Sur',
  TFN: 'Tenerife Norte',
  LPA: 'Gran Canaria',
  ACE: 'Lanzarote',
  FUE: 'Fuerteventura',
  IBZ: 'Ibiza',
  SDR: 'Santander',
  VGO: 'Vigo',
  OVD: 'Asturias',
  ZAZ: 'Zaragoza',
  GRX: 'Granada',
  MJV: 'Murcia',
  XRY: 'Jerez',
  REU: 'Reus',
  GRO: 'Girona',
  MAH: 'Menorca',
  SPC: 'La Palma',
};

function nextWeekendDates(): { dep: string; ret: string } {
  const now = new Date();
  const day = now.getDay();
  const daysUntilSat = ((6 - day + 7) % 7) || 7;
  const sat = new Date(now.getTime() + daysUntilSat * 86400000);
  const sun = new Date(sat.getTime() + 86400000);
  return { dep: sat.toISOString().slice(0, 10), ret: sun.toISOString().slice(0, 10) };
}

const { dep: defDep, ret: defRet } = nextWeekendDates();

const DEFAULT_QUERY: VuelosQuery = {
  origin: 'MAD',
  destination: 'ANY',
  departureAt: defDep,
  returnAt: defRet,
  adults: 2,
  children: 0,
  infants: 0,
  oneWay: false,
  dateMode: 'flexible',
  flexDeparture: defDep,
  flexDepartureEnd: defRet,
  flexDurationMin: 3,
  flexDurationMax: 7,
};


export default function VuelosPage() {
  const [results, setResults] = useState<VueloResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastQuery, setLastQuery] = useState<VuelosQuery>(DEFAULT_QUERY);
  const [source, setSource] = useState<'api' | 'fallback' | null>(null);

  const runSearch = useCallback(async (q: VuelosQuery) => {
    setIsLoading(true);
    setResults([]);
    setLastQuery(q);
    try {
      const params = new URLSearchParams({
        origin: q.origin,
        destination: q.destination || 'ANY',
        departureAt: q.departureAt,
        departureEndAt: q.flexDepartureEnd || q.departureAt,
        returnAt: q.oneWay ? '' : q.returnAt,
        adults: String(q.adults),
        children: String(q.children),
        infants: String(q.infants),
        oneWay: q.oneWay ? 'true' : 'false',
        durationMin: String(q.flexDurationMin ?? 1),
        durationMax: String(q.flexDurationMax ?? 30),
        _t: String(Date.now()),
      });
      const res = await fetch(`/api/vuelos/search?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success && data.results) {
        setResults(data.results);
        setSource(data.source);
      }
    } catch (err) {
      console.error('Error buscando vuelos:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    runSearch(DEFAULT_QUERY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const originName = ORIGIN_NAMES[lastQuery.origin] || lastQuery.origin;
  const isAnyDest = !lastQuery.destination || lastQuery.destination === 'ANY';
  const cheapestPrice = results.length > 0 ? results[0].totalPrice : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-sky-500 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-950/85 backdrop-blur-lg border-b border-slate-800/80 px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2.5 group">
            <span className="text-2xl">⚡</span>
            <span className="font-extrabold text-lg tracking-tight text-white group-hover:text-sky-400 transition-colors">
              Viajando en Tesla <span className="text-sky-500 text-sm font-semibold">| Vuelos</span>
            </span>
          </Link>
          <nav className="flex items-center space-x-2 text-sm font-medium">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800/60 hidden sm:block">
              🛒 Accesorios
            </Link>
            <Link href="/navegador" className="text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800/60 hidden sm:block">
              📡 Navegador
            </Link>
            <Link href="/vuelos" className="text-white bg-sky-600/90 hover:bg-sky-600 px-3.5 py-1.5 rounded-lg shadow-sm transition-all font-semibold">
              ✈️ Vuelos
            </Link>
            <Link href="/escapadas" className="text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800/60">
              🏨 Escapadas
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8 w-full flex-1 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-sky-950/80 border border-sky-800/50 text-sky-400 text-xs font-bold tracking-wide">
            <span>✈️ BUSCADOR DE VUELOS BARATOS</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Encuentra el vuelo{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300">
              más barato
            </span>
          </h1>
          <p className="text-slate-400 text-sm sm:text-base">
            Compara precios reales en tiempo real. Redirigimos directamente a Skyscanner para que reserves con total seguridad.
          </p>
        </div>

        {/* Search Form */}
        <VuelosSearchForm onSearch={runSearch} isLoading={isLoading} />

        {/* Results header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800 pb-4 gap-2">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center space-x-2 flex-wrap gap-y-1">
              <span>
                {isAnyDest
                  ? `🔥 Mejores chollos desde ${originName}`
                  : `✈️ Vuelos desde ${originName}`}
              </span>
              {!isLoading && (
                <span className="text-xs bg-slate-800 text-slate-300 font-semibold px-2.5 py-0.5 rounded-full">
                  {results.length} {results.length === 1 ? 'resultado' : 'resultados'}
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Ordenado por precio total · {lastQuery.oneWay ? 'Solo Ida' : 'Ida y Vuelta'} ·{' '}
              {lastQuery.adults + lastQuery.children + lastQuery.infants} viajero{lastQuery.adults + lastQuery.children + lastQuery.infants !== 1 ? 's' : ''}
              {source === 'fallback' && (
                <span className="ml-2 text-amber-500">· Precios orientativos (abre Skyscanner para precio exacto)</span>
              )}
            </p>
          </div>

          {cheapestPrice !== null && !isLoading && (
            <div className="text-right">
              <div className="text-xs text-slate-500">Desde</div>
              <div className="text-2xl font-black text-sky-400">{cheapestPrice} €</div>
              <div className="text-[10px] text-slate-500">precio total</div>
            </div>
          )}
        </div>

        {/* Results grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 animate-pulse">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-72 bg-slate-900 border border-slate-800 rounded-2xl" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/50 border border-slate-800 rounded-2xl space-y-3">
            <span className="text-5xl">🔍</span>
            <h3 className="text-lg font-bold text-white">No encontramos vuelos con estos filtros</h3>
            <p className="text-sm text-slate-400">Prueba a cambiar el origen o ampliar el rango de fechas.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {results.map((flight, idx) => (
              <VueloCard key={flight.id} flight={flight} rank={idx + 1} />
            ))}
          </div>
        )}

        {/* Info disclaimer */}
        {!isLoading && results.length > 0 && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex items-start space-x-3 text-xs text-slate-500">
            <span className="text-lg">ℹ️</span>
            <div>
              <strong className="text-slate-300">¿Cómo funciona?</strong> Buscamos los precios más bajos disponibles en tiempo real a través de la API de Aviasales. Al hacer clic en "Ver vuelo en Skyscanner.es" se abre Skyscanner con tu búsqueda pre-rellenada para que puedas reservar directamente con total seguridad.
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 bg-slate-950 text-center text-xs text-slate-600">
        <div className="max-w-7xl mx-auto px-4 space-y-1">
          <p>© 2026 Viajando en Tesla · Plataforma independiente para la comunidad de viajes y vehículos eléctricos.</p>
          <p>Los precios mostrados son estimaciones en tiempo real. Visita Skyscanner para ver el precio final confirmado.</p>
        </div>
      </footer>
    </div>
  );
}
