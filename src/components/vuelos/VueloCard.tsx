'use client';

import React from 'react';
import { getAirportCityName } from '@/lib/airports';

export interface VueloResult {
  id: string;
  origin: string;
  destination: string;
  destinationCity: string;
  destinationCountry: string;
  pricePerPerson: number;
  totalPrice: number;
  adults: number;
  children: number;
  infants: number;
  departureAt: string;
  returnAt: string | null;
  airline: string | null;
  transfers: number | null;
  skyscannerUrl: string;
  includeHotel?: boolean;
  hotelStars?: number;
  hotelName?: string;
  hotelNights?: number;
  hotelRooms?: number;
  hotelRatePerNight?: number;
  hotelEstimatedPrice?: number;
  hotelBookingUrl?: string;
  totalPackagePrice?: number;
}

const CITY_IMAGES: Record<string, string> = {
  MIL: 'https://images.unsplash.com/photo-1513581166391-887a96ddeafd?q=80&w=700&auto=format&fit=crop',
  ROM: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?q=80&w=700&auto=format&fit=crop',
  PAR: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=700&auto=format&fit=crop',
  LON: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=700&auto=format&fit=crop',
  BER: 'https://images.unsplash.com/photo-1560969184-10fe8719e047?q=80&w=700&auto=format&fit=crop',
  AMS: 'https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?q=80&w=700&auto=format&fit=crop',
  PRG: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?q=80&w=700&auto=format&fit=crop',
  VIE: 'https://images.unsplash.com/photo-1516550893923-42d28e5677af?q=80&w=700&auto=format&fit=crop',
  BUD: 'https://images.unsplash.com/photo-1549877452-9c387954fbc2?q=80&w=700&auto=format&fit=crop',
  OPO: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?q=80&w=700&auto=format&fit=crop',
  LIS: 'https://images.unsplash.com/photo-1585208702680-b47e660418b3?q=80&w=700&auto=format&fit=crop',
  PMI: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?q=80&w=700&auto=format&fit=crop',
  IBZ: 'https://images.unsplash.com/photo-1568953181822-259160a266fb?q=80&w=700&auto=format&fit=crop',
  TFN: 'https://images.unsplash.com/photo-1572455857811-045fb4255b5d?q=80&w=700&auto=format&fit=crop',
  RAK: 'https://images.unsplash.com/photo-1597212618440-806262de4f6b?q=80&w=700&auto=format&fit=crop',
};

const DEFAULT_IMG = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=700&auto=format&fit=crop';

function cityName(code: string): string {
  return getAirportCityName(code);
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function buildPriceFormula(v: VueloResult): string {
  const parts: string[] = [];
  if (v.adults > 0) parts.push(`${v.adults} ${v.adults === 1 ? 'Adulto' : 'Adultos'} x ${v.pricePerPerson}€`);
  if (v.children > 0) {
    parts.push(`${v.children} ${v.children === 1 ? 'Niño' : 'Niños'} x ${v.pricePerPerson}€`);
  }
  if (v.infants > 0) {
    const ip = Math.round(v.pricePerPerson * 0.10);
    parts.push(`${v.infants} ${v.infants === 1 ? 'Bebé' : 'Bebés'} x ${ip}€`);
  }
  return parts.join(' + ');
}

interface Props {
  flight: VueloResult;
  rank?: number;
}

export default function VueloCard({ flight, rank }: Props) {
  const image = CITY_IMAGES[flight.destination] || DEFAULT_IMG;
  const isRoundTrip = !!flight.returnAt;

  return (
    <div className="group relative bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden hover:border-sky-500/40 transition-all duration-300 shadow-xl hover:shadow-sky-900/20 flex flex-col">
      {/* Image */}
      <div className="relative h-36 w-full overflow-hidden bg-slate-950 flex-shrink-0">
        <img
          src={image}
          alt={flight.destinationCity}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

        {/* Rank badge */}
        {rank !== undefined && rank <= 3 && (
          <div className="absolute top-2.5 left-2.5 bg-amber-500/90 backdrop-blur text-slate-900 text-[11px] font-black px-2.5 py-1 rounded-full">
            {rank === 1 ? '🥇 Más barato' : rank === 2 ? '🥈 2º más barato' : '🥉 3º más barato'}
          </div>
        )}

        {/* Price badge — solo precio del vuelo */}
        <div className="absolute bottom-2.5 right-2.5 bg-sky-600/95 backdrop-blur-sm text-white px-3 py-1.5 rounded-xl text-right shadow-lg">
          <div className="text-xl font-black leading-tight">{flight.totalPrice} €</div>
          <div className="text-[10px] font-semibold opacity-90">
            ✈️ desde {flight.pricePerPerson}€/persona
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        {/* Route header */}
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400 mb-1">
            <span>{cityName(flight.origin)}</span>
            <span className="text-sky-500">→</span>
            <span className="text-white font-bold">{cityName(flight.destination)}</span>
            {flight.transfers === 0 && (
              <span className="ml-auto bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 px-2 py-0.5 rounded-full text-[10px] font-bold">
                Directo
              </span>
            )}
            {flight.transfers !== null && flight.transfers > 0 && (
              <span className="ml-auto bg-orange-950/80 text-orange-400 border border-orange-800/50 px-2 py-0.5 rounded-full text-[10px] font-bold">
                {flight.transfers} escala{flight.transfers > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <h3 className="text-lg font-black text-white group-hover:text-sky-400 transition-colors">
            {flight.destinationCity}
            <span className="text-slate-500 text-sm font-normal ml-1">{flight.destinationCountry}</span>
          </h3>

          {/* Dates */}
          <div className="flex items-center space-x-1.5 text-xs text-slate-400 mt-1">
            <span>📅</span>
            <span>{formatDate(flight.departureAt)}</span>
            {isRoundTrip && flight.returnAt && (
              <>
                <span className="text-slate-600">→</span>
                <span>{formatDate(flight.returnAt)}</span>
              </>
            )}
            {!isRoundTrip && <span className="text-orange-400 font-semibold">· Solo Ida</span>}
          </div>
        </div>

        {/* Flight Price formula */}
        <div className="bg-slate-950/70 rounded-xl border border-slate-800 px-3 py-2.5">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>✈️ <strong>{isRoundTrip ? 'Ida y Vuelta' : 'Solo Ida'}:</strong> {buildPriceFormula(flight)}</span>
            <span className="font-extrabold text-white text-sm ml-2">= {flight.totalPrice} €</span>
          </div>
        </div>

        {/* Flight CTA */}
        <a
          href={flight.skyscannerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white font-black rounded-xl text-xs transition-all duration-300 shadow-md hover:shadow-sky-600/25 flex items-center justify-between group/btn"
        >
          <span className="flex items-center space-x-1.5">
            <span>✈️</span>
            <span>Ver vuelo en Skyscanner.es</span>
          </span>
          <span className="bg-sky-700/90 group-hover/btn:bg-sky-600 px-2 py-0.5 rounded-lg text-xs font-black">
            {flight.totalPrice} €
        </a>
        <p className="text-[10px] text-slate-500 italic text-center leading-tight">
          Precios de vuelo recopilados recientemente · Skyscanner confirma el precio final en tiempo real
        </p>

        {/* ═══════════════════════════════════════════════
            SECCIÓN HOTEL — Sin precios estimados.
            Solo info útil + enlace inteligente a Booking.
            ═══════════════════════════════════════════════ */}
        {flight.includeHotel && flight.hotelBookingUrl && (
          <div className="pt-3 border-t border-slate-800/80 space-y-2.5">

            {/* Info card del alojamiento */}
            <div className="bg-slate-950/60 rounded-xl border border-amber-900/30 p-3 space-y-2.5">

              {/* Título + estrellas mínimas */}
              <div className="flex items-center justify-between">
                <span className="text-amber-400 font-bold text-xs flex items-center gap-1.5">
                  🏨 Alojamiento en {flight.destinationCity}
                </span>
                <span className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/25 px-2 py-0.5 rounded-full font-bold flex-shrink-0 ml-2">
                  {'⭐'.repeat(Math.min(flight.hotelStars || 3, 5))} mín.
                </span>
              </div>

              {/* Grid de detalles */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span>📅</span>
                  <span className="font-medium text-slate-300">{formatDate(flight.departureAt)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span>🏁</span>
                  <span className="font-medium text-slate-300">{flight.returnAt ? formatDate(flight.returnAt) : '—'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span>🌙</span>
                  <span>{flight.hotelNights} {(flight.hotelNights ?? 1) === 1 ? 'noche' : 'noches'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span>👥</span>
                  <span>
                    {flight.adults} {flight.adults === 1 ? 'adulto' : 'adultos'}
                    {(flight.children ?? 0) > 0 ? ` + ${flight.children} niño${(flight.children ?? 0) !== 1 ? 's' : ''}` : ''}
                  </span>
                </div>
              </div>

              {/* Nota */}
              <p className="text-[10px] text-slate-500 italic border-t border-slate-800/50 pt-2 leading-relaxed">
                Resultados ordenados de menor a mayor precio · Filtros de tu búsqueda aplicados
              </p>
            </div>

            {/* CTA Booking — sin precio, flecha clara */}
            <a
              href={flight.hotelBookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs transition-all duration-300 shadow-md hover:shadow-emerald-500/30 flex items-center justify-between group/btn"
            >
              <span className="flex items-center space-x-2">
                <span>🏨</span>
                <span>Ver hoteles disponibles en Booking.com</span>
              </span>
              <span className="text-emerald-200 group-hover/btn:text-white transition-colors text-lg font-black">→</span>
            </a>

          </div>
        )}
      </div>
    </div>
  );
}
