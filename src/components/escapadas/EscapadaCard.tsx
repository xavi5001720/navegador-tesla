'use client';

import React from 'react';
import { FlightDeal } from '@/lib/travelpayouts';

interface EscapadaCardProps {
  deal: FlightDeal;
}

export const EscapadaCard: React.FC<EscapadaCardProps> = ({ deal }) => {
  const formatTravelersSummary = () => {
    const parts = [];
    if (deal.adults) parts.push(`${deal.adults} ${deal.adults === 1 ? 'Adulto' : 'Adultos'}`);
    if (deal.children) parts.push(`${deal.children} ${deal.children === 1 ? 'Niño' : 'Niños'}`);
    if (deal.infants) parts.push(`${deal.infants} ${deal.infants === 1 ? 'Bebé' : 'Bebés'}`);
    return parts.join(', ');
  };

  const hotelRatePerNight = Math.round(deal.hotelEstimatedPrice / deal.nights);

  return (
    <div className="group relative bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden hover:border-red-500/50 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-red-900/10 flex flex-col justify-between">
      {/* Imagen de Destino */}
      <div className="relative h-48 w-full overflow-hidden bg-slate-950">
        <img
          src={deal.imageUrl}
          alt={deal.destinationCityName}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
        
        {/* Badge Destino */}
        <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-white border border-slate-700">
          📍 {deal.destinationCityName}, {deal.destinationCountry}
        </div>

        {/* Badge EV Charger (si aplica) */}
        {deal.hasEvChargerHotel && (
          <div className="absolute top-3 right-3 bg-emerald-950/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-emerald-400 border border-emerald-700/50 flex items-center space-x-1">
            <span>⚡ Hotel Carga EV</span>
          </div>
        )}

        {/* Precio Destacado Total + Desglose Multiplicación */}
        <div className="absolute bottom-3 right-3 bg-red-600/95 backdrop-blur-md text-white px-3 py-1.5 rounded-xl font-extrabold text-right shadow-lg">
          <div className="text-lg font-black leading-tight">
            {deal.totalPrice} € <span className="text-xs font-normal opacity-90">total</span>
          </div>
          <div className="text-[11px] font-medium opacity-90">
            {deal.adults} {deal.adults === 1 ? 'Adulto' : 'Adultos'} x {deal.pricePerAdult}€ = {deal.totalPrice}€
          </div>
        </div>
      </div>

      {/* Contenido Desglose */}
      <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-xl font-bold text-white group-hover:text-red-400 transition-colors">
            {deal.isByCar ? `Hotel en ${deal.destinationCityName}` : `Escapada a ${deal.destinationCityName}`} ({deal.nights} noches)
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {deal.isByCar ? (
              <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                <span>🚗 Viaje en coche (Sin billetes de avión)</span>
              </span>
            ) : (
              <span>
                Salida desde <span className="text-slate-200 font-semibold">{deal.originCityName}</span> • {deal.departureDate} al {deal.returnDate}
              </span>
            )}
          </p>

          {/* Desglose Explicito en Cajas */}
          <div className="mt-4 space-y-2 text-xs text-slate-300">
            {/* Detalle Vuelo con Operación Matemática */}
            {!deal.isByCar && (
              <div className="p-2.5 bg-slate-800/60 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="flex items-center space-x-2 text-slate-300">
                  <span>✈️ <strong>Vuelos:</strong> {deal.adults} {deal.adults === 1 ? 'Adulto' : 'Adultos'} x {deal.flightPricePerPerson}€</span>
                </span>
                <span className="font-extrabold text-white">
                  = {deal.flightPriceTotal} €
                </span>
              </div>
            )}

            {/* Detalle Hotel con Operación Matemática */}
            <div className="p-2.5 bg-slate-800/60 rounded-xl border border-slate-800 flex items-center justify-between">
              <span className="flex items-center space-x-2 text-slate-300">
                <span>🏨 <strong>Hotel {deal.hotelStars}★:</strong> {deal.nights} {deal.nights === 1 ? 'noche' : 'noches'} x {hotelRatePerNight}€</span>
              </span>
              <span className="font-extrabold text-white">
                = {deal.hotelEstimatedPrice} €
              </span>
            </div>
          </div>
        </div>

        {/* 2 Botones de Reserva Monetizados Separados (Vuelo y Hotel) */}
        <div className="space-y-2 mt-4 pt-2 border-t border-slate-800/60">
          {!deal.isByCar ? (
            <>
              {/* Botón 1: Skyscanner.es */}
              <a
                href={deal.flightAffiliateUrl || deal.affiliateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-center text-xs transition-all duration-300 shadow-md hover:shadow-sky-600/20 flex items-center justify-between group/btn"
              >
                <span className="flex items-center space-x-1.5">
                  <span>✈️</span>
                  <span>Ver Vuelos en Skyscanner.es</span>
                </span>
                <span className="bg-sky-700/80 group-hover/btn:bg-sky-600 px-2 py-0.5 rounded text-[11px] font-extrabold">
                  {deal.flightPriceTotal} €
                </span>
              </a>

              {/* Botón 2: Booking.com */}
              <a
                href={deal.hotelAffiliateUrl || deal.affiliateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-center text-xs transition-all duration-300 shadow-md hover:shadow-blue-600/20 flex items-center justify-between group/btn"
              >
                <span className="flex items-center space-x-1.5">
                  <span>🏨</span>
                  <span>Ver Hotel en Booking.com</span>
                </span>
                <span className="bg-blue-700/80 group-hover/btn:bg-blue-600 px-2 py-0.5 rounded text-[11px] font-extrabold">
                  {deal.hotelEstimatedPrice} €
                </span>
              </a>
            </>
          ) : (
            /* Botón Coche - Booking.com */
            <a
              href={deal.hotelAffiliateUrl || deal.affiliateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-center text-xs transition-all duration-300 shadow-md hover:shadow-blue-600/20 flex items-center justify-between group/btn"
            >
              <span className="flex items-center space-x-1.5">
                <span>🏨</span>
                <span>Ver Hotel en Booking.com</span>
              </span>
              <span className="bg-blue-700/80 group-hover/btn:bg-blue-600 px-2 py-0.5 rounded text-[11px] font-extrabold">
                {deal.totalPrice} €
              </span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

