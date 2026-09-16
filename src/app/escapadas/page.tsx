'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { EscapadasForm } from '@/components/escapadas/EscapadasForm';
import { EscapadaCard } from '@/components/escapadas/EscapadaCard';
import { FlightDeal, EscapadaSearchQuery } from '@/lib/travelpayouts';

export default function EscapadasPage() {
  const [deals, setDeals] = useState<FlightDeal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentQuery, setCurrentQuery] = useState<EscapadaSearchQuery>({
    origin: 'MAD',
    destination: 'ANY',
    adults: 2,
    children: 0,
    infants: 0,
    durationDays: 2,
    flexibility: 'weekend',
    minStars: 3,
    evChargingOnly: false,
  });

  const runSearch = async (query: EscapadaSearchQuery) => {
    setIsLoading(true);
    setCurrentQuery(query);
    try {
      const params = new URLSearchParams({
        origin: query.origin,
        destination: query.destination || 'ANY',
        adults: (query.adults || 2).toString(),
        children: (query.children || 0).toString(),
        infants: (query.infants || 0).toString(),
        durationDays: query.durationDays.toString(),
        flexibility: query.flexibility,
        minStars: (query.minStars || 3).toString(),
        evChargingOnly: query.evChargingOnly ? 'true' : 'false',
      });
      if (query.month) params.append('month', query.month);

      const res = await fetch(`/api/escapadas/search?${params.toString()}`);
      const data = await res.json();
      if (data.success && data.deals) {
        setDeals(data.deals);
      }
    } catch (err) {
      console.error('Error cargando escapadas:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runSearch(currentQuery);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-red-500 selection:text-white">
      {/* Header NAVEGACIÓN DISCRETA */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-lg border-b border-slate-800/80 px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3 group">
            <span className="text-2xl">⚡</span>
            <span className="font-extrabold text-lg lg:text-xl tracking-tight text-white group-hover:text-red-500 transition-colors">
              Viajando en Tesla <span className="text-red-500 text-sm font-semibold">| Viajes</span>
            </span>
          </Link>

          <nav className="flex items-center space-x-4 text-sm font-medium">
            <Link
              href="/"
              className="text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800/60"
            >
              🛒 Chuches & Accesorios
            </Link>
            <Link
              href="/navegador"
              className="text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800/60"
            >
              📡 Navegador & Radares
            </Link>
            <Link
              href="/escapadas"
              className="text-white bg-red-600/90 hover:bg-red-600 px-3.5 py-1.5 rounded-lg shadow-sm transition-all font-semibold"
            >
              ✈️ Escapadas Chollo
            </Link>
          </nav>
        </div>
      </header>

      {/* HERO BANNER & BUSCADOR */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8 w-full space-y-10 flex-1">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-red-950/80 border border-red-800/50 text-red-400 text-xs font-bold tracking-wide">
            <span>🚀 BUSCADOR AUTOMÁTICO DE ESCAPADAS CHOLLO</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Vuelo + Hotel al <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-rose-400">Mejor Precio Garantizado</span>
          </h1>
          <p className="text-slate-400 text-sm sm:text-base">
            Encuentra las mejores combinaciones de viaje desde tu provincia para los próximos fines de semana. Paquetes optimizados para gastar lo mínimo.
          </p>
        </div>

        {/* Formulador del Buscador */}
        <EscapadasForm onSearch={runSearch} isLoading={isLoading} />

        {/* SECCIÓN DE RESULTADOS */}
        <div className="space-y-6 pt-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800 pb-4 gap-2">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                <span>🔥 Mejores Combinaciones Encontradas</span>
                <span className="text-xs bg-slate-800 text-slate-300 font-semibold px-2.5 py-0.5 rounded-full">
                  {deals.length} chollos
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Ordenado de menor a mayor precio total (Vuelo Ida/Vuelta + {currentQuery.durationDays} Noches de Hotel)
              </p>
            </div>

            <div className="text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
              Origen: <span className="text-white font-bold">{currentQuery.origin}</span>
            </div>
          </div>

          {/* GRID DE CARDS */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-96 bg-slate-900 border border-slate-800 rounded-2xl" />
              ))}
            </div>
          ) : deals.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/50 border border-slate-800 rounded-2xl space-y-3">
              <span className="text-4xl">🔍</span>
              <h3 className="text-lg font-bold text-white">No se encontraron combinaciones con estos filtros</h3>
              <p className="text-xs text-slate-400">Prueba a cambiar el origen o ampliar la duración del viaje.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {deals.map((deal) => (
                <EscapadaCard key={deal.id} deal={deal} />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-800/80 py-8 bg-slate-950 mt-16 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p>© 2026 Viajando en Tesla. Plataforma independiente para la comunidad de viajes y vehículos eléctricos.</p>
          <p className="text-slate-600">
            Los precios mostrados son estimaciones en tiempo real proporcionadas por las APIs oficiales de Travelpayouts / Aviasales.
          </p>
        </div>
      </footer>
    </div>
  );
}
