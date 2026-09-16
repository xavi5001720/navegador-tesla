'use client';

import React from 'react';
import { FlightDeal } from '@/lib/travelpayouts';

interface EscapadaCardProps {
  deal: FlightDeal;
}

export const EscapadaCard: React.FC<EscapadaCardProps> = ({ deal }) => {
  // Formateador de Fechas Bonito en Español (ej: 24 Oct - 26 Oct 2026)
  const formatDateSpan = (depStr: string, retStr: string) => {
    try {
      const dep = new Date(depStr);
      const ret = new Date(retStr);
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const depFormatted = `${dep.getDate()} ${months[dep.getMonth()]}`;
      const retFormatted = `${ret.getDate()} ${months[ret.getMonth()]}`;
      return `${depFormatted} - ${retFormatted} (${dep.getFullYear()})`;
    } catch {
      return `${depStr} al ${retStr}`;
    }
  };

  // Construcción de la fórmula matemática de Vuelos (ej: "2 Adultos x 50€ + 2 Niños x 20€")
  const renderFlightFormula = () => {
    const parts = [];
    if (deal.adults) {
      parts.push(`${deal.adults} ${deal.adults === 1 ? 'Adulto' : 'Adultos'} x ${deal.flightPricePerPerson}€`);
    }
    if (deal.children) {
      const childPrice = Math.round(deal.flightPricePerPerson * 0.75);
      parts.push(`${deal.children} ${deal.children === 1 ? 'Niño' : 'Niños'} x ${childPrice}€`);
    }
    if (deal.infants) {
      const infantPrice = Math.round(deal.flightPricePerPerson * 0.15);
      parts.push(`${deal.infants} ${deal.infants === 1 ? 'Bebé' : 'Bebés'} x ${infantPrice}€`);
    }
    return parts.join(' + ');
  };

  const hotelRatePerNight = Math.round(deal.hotelEstimatedPrice / deal.nights);

  return (
    <div className="group relative bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden hover:border-red-500/50 transition-all duration-300 shadow-xl flex flex-col justify-between">
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

        {/* Badge EV Charger */}
        {deal.hasEvChargerHotel && (
          <div className="absolute top-3 right-3 bg-emerald-950/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-emerald-400 border border-emerald-700/50">
            ⚡ Hotel Carga EV
          </div>
        )}

        {/* Precio Destacado Total */}
        <div className="absolute bottom-3 right-3 bg-red-600/95 backdrop-blur-md text-white px-3.5 py-1.5 rounded-xl font-extrabold text-right shadow-lg">
          <div className="text-xl font-black leading-tight">
            {deal.totalPrice} € <span className="text-xs font-normal opacity-90">total</span>
          </div>
          <div className="text-[11px] font-semibold opacity-90">
            ({deal.pricePerAdult} € / persona)
          </div>
        </div>
      </div>

      {/* Cuerpo de la Tarjeta */}
      <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-xl font-bold text-white group-hover:text-red-400 transition-colors">
            {deal.isByCar ? `Hotel en ${deal.destinationCityName}` : `Escapada a ${deal.destinationCityName}`} ({deal.nights} {deal.nights === 1 ? 'noche' : 'noches'})
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {deal.isByCar ? (
              <span className="text-emerald-400 font-semibold">
                🚗 Viaje en coche (Sin billetes de avión)
              </span>
            ) : (
              <span>
                Salida desde <span className="text-slate-200 font-semibold">{deal.originCityName}</span> • {formatDateSpan(deal.departureDate, deal.returnDate)}
              </span>
            )}
          </p>

          {/* Caja con la Operación Matemática Explicita (Sin texto duplicado) */}
          <div className="mt-4 p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2.5 text-xs">
            {/* Fila Vuelos */}
            {!deal.isByCar && (
              <div className="flex items-center justify-between text-slate-300">
                <span>
                  ✈️ <strong>Vuelos:</strong> {renderFlightFormula()}
                </span>
                <span className="font-extrabold text-white text-sm ml-2">
                  = {deal.flightPriceTotal} €
                </span>
              </div>
            )}

            {/* Fila Hotel */}
            <div className="flex items-center justify-between text-slate-300">
              <span>
                🏨 <strong>Hotel {deal.hotelStars}★:</strong> {deal.nights} {deal.nights === 1 ? 'noche' : 'noches'} x {hotelRatePerNight}€/noche
              </span>
              <span className="font-extrabold text-white text-sm ml-2">
                = {deal.hotelEstimatedPrice} €
              </span>
            </div>
          </div>
        </div>

        {/* Botones de Reserva directos */}
        <div className="space-y-2.5 mt-2 pt-3 border-t border-slate-800/80">
          {!deal.isByCar ? (
            <>
              {/* Botón Skyscanner */}
              <a
                href={deal.flightAffiliateUrl || deal.affiliateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-center text-xs transition-all duration-300 shadow-md flex items-center justify-between group/btn"
              >
                <span className="flex items-center space-x-1.5">
                  <span>✈️</span>
                  <span>Reservar Vuelo en Skyscanner.es</span>
                </span>
                <span className="bg-sky-700/90 group-hover/btn:bg-sky-600 px-2.5 py-1 rounded-lg text-xs font-black">
                  {deal.flightPriceTotal} €
                </span>
              </a>

              {/* Botón Booking */}
              <a
                href={deal.hotelAffiliateUrl || deal.affiliateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-center text-xs transition-all duration-300 shadow-md flex items-center justify-between group/btn"
              >
                <span className="flex items-center space-x-1.5">
                  <span>🏨</span>
                  <span>Reservar Hotel en Booking.com</span>
                </span>
                <span className="bg-blue-700/90 group-hover/btn:bg-blue-600 px-2.5 py-1 rounded-lg text-xs font-black">
                  {deal.hotelEstimatedPrice} €
                </span>
              </a>
            </>
          ) : (
            /* Botón Coche - Booking */
            <a
              href={deal.hotelAffiliateUrl || deal.affiliateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-center text-xs transition-all duration-300 shadow-md flex items-center justify-between group/btn"
            >
              <span className="flex items-center space-x-1.5">
                <span>🏨</span>
                <span>Reservar Hotel en Booking.com</span>
              </span>
              <span className="bg-blue-700/90 group-hover/btn:bg-blue-600 px-2.5 py-1 rounded-lg text-xs font-black">
                {deal.totalPrice} €
              </span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};


