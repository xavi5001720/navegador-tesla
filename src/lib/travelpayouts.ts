/**
 * Librería cliente para integrarse con la API de Travelpayouts / Aviasales.
 * Permite buscar ofertas de vuelos y generar enlaces con el marker de afiliado.
 */

export interface FlightDeal {
  id: string;
  origin: string;
  originCityName: string;
  destination: string;
  destinationCityName: string;
  destinationCountry: string;
  adults: number;
  children: number;
  infants: number;
  totalPassengers: number;
  isByCar: boolean;
  flightPricePerPerson: number;
  flightPriceTotal: number;
  hotelEstimatedPrice: number;
  totalPrice: number; // Precio total del paquete para todos los viajeros
  pricePerAdult: number; // Precio estimado por adulto
  departureDate: string;
  returnDate: string;
  nights: number;
  hotelStars: number;
  imageUrl: string;
  affiliateUrl: string;
  airline?: string;
  transfers?: number;
  hasEvChargerHotel?: boolean;
}

export interface EscapadaSearchQuery {
  origin: string; // IATA code, e.g. 'MAD', 'BCN', or 'BY_CAR'
  destination?: string; // IATA code, e.g. 'MIL', 'ANY'
  adults: number; // 1 to 6
  children: number; // 0 to 4
  infants: number; // 0 to 2
  durationDays: number; // 2, 3, 4, 7
  flexibility: 'weekend' | 'month' | 'dates';
  month?: string; // e.g. '2026-10'
  minStars?: number; // 3, 4, 5
  evChargingOnly?: boolean;
}

export const AIRPORTS_MAP: Record<string, { city: string; country: string; image: string }> = {
  MIL: { city: 'Milán', country: 'Italia', image: 'https://images.unsplash.com/photo-1513581166391-887a96ddeafd?q=80&w=800&auto=format&fit=crop' },
  ROM: { city: 'Roma', country: 'Italia', image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?q=80&w=800&auto=format&fit=crop' },
  PAR: { city: 'París', country: 'Francia', image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=800&auto=format&fit=crop' },
  LON: { city: 'Londres', country: 'Reino Unido', image: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=800&auto=format&fit=crop' },
  OPO: { city: 'Oporto', country: 'Portugal', image: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?q=80&w=800&auto=format&fit=crop' },
  LIS: { city: 'Lisboa', country: 'Portugal', image: 'https://images.unsplash.com/photo-1585208702680-b47e660418b3?q=80&w=800&auto=format&fit=crop' },
  PMI: { city: 'Palma de Mallorca', country: 'España', image: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?q=80&w=800&auto=format&fit=crop' },
  IBZ: { city: 'Ibiza', country: 'España', image: 'https://images.unsplash.com/photo-1568953181822-259160a266fb?q=80&w=800&auto=format&fit=crop' },
  TFN: { city: 'Tenerife', country: 'España', image: 'https://images.unsplash.com/photo-1572455857811-045fb4255b5d?q=80&w=800&auto=format&fit=crop' },
  VIE: { city: 'Viena', country: 'Austria', image: 'https://images.unsplash.com/photo-1516550893923-42d28e5677af?q=80&w=800&auto=format&fit=crop' },
  BUD: { city: 'Budapest', country: 'Hungría', image: 'https://images.unsplash.com/photo-1549877452-9c387954fbc2?q=80&w=800&auto=format&fit=crop' },
  BER: { city: 'Berlín', country: 'Alemania', image: 'https://images.unsplash.com/photo-1560969184-10fe8719e047?q=80&w=800&auto=format&fit=crop' },
  AMS: { city: 'Ámsterdam', country: 'Países Bajos', image: 'https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?q=80&w=800&auto=format&fit=crop' },
  PRG: { city: 'Praga', country: 'República Checa', image: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?q=80&w=800&auto=format&fit=crop' },
  RAK: { city: 'Marrakech', country: 'Marruecos', image: 'https://images.unsplash.com/photo-1597212618440-806262de4f6b?q=80&w=800&auto=format&fit=crop' },
};

const ORIGIN_CITIES: Record<string, string> = {
  MAD: 'Madrid',
  BCN: 'Barcelona',
  VLC: 'Valencia',
  AGP: 'Málaga',
  SVQ: 'Sevilla',
  BIO: 'Bilbao',
  ALC: 'Alicante',
  SCQ: 'Santiago',
  BY_CAR: '🚗 En Coche / Coche Eléctrico (Sin Vuelo)'
};

export function getOriginCityName(code: string): string {
  return ORIGIN_CITIES[code.toUpperCase()] || code;
}

export async function fetchEscapadas(query: EscapadaSearchQuery): Promise<FlightDeal[]> {
  const token = process.env.TRAVELPAYOUTS_TOKEN || '596d62e5f9f6d2f1574865feeb424c75';
  const marker = process.env.TRAVELPAYOUTS_MARKER || '778425';

  const origin = query.origin || 'MAD';
  const isByCar = origin === 'BY_CAR';
  const selectedDest = query.destination && query.destination !== 'ANY' ? query.destination : undefined;

  const adults = Math.max(1, query.adults || 2);
  const children = Math.max(0, query.children || 0);
  const infants = Math.max(0, query.infants || 0);
  const totalPassengers = adults + children + infants;

  const duration = query.durationDays || 2;
  const minStars = query.minStars || 3;

  // Si se selecciona "Iré en Coche", generamos ofertas exclusivas de solo Hotel
  if (isByCar) {
    return generateCarHotelDeals(query, marker);
  }

  let url = `https://api.travelpayouts.com/aviasales/v3/prices_for_dates?origin=${origin}&currency=eur&direct=true&limit=35&token=${token}`;
  if (selectedDest) {
    url += `&destination=${selectedDest}`;
  }

  try {
    const res = await fetch(url, {
      next: { revalidate: 3600 },
      headers: {
        'Accept-Encoding': 'gzip, deflate'
      }
    });

    if (!res.ok) {
      console.error('Travelpayouts API HTTP error:', res.status);
      return generateFallbackDeals(query, marker);
    }

    const data = await res.json();
    let items = data.data || [];

    if (selectedDest) {
      items = items.filter((it: any) => it.destination === selectedDest);
    }

    if (!items || items.length === 0) {
      return generateFallbackDeals(query, marker);
    }

    const deals: FlightDeal[] = items.map((item: any, idx: number) => {
      const destCode = item.destination || 'MIL';
      const cityInfo = AIRPORTS_MAP[destCode] || {
        city: destCode,
        country: 'Europa',
        image: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=800&auto=format&fit=crop'
      };

      const baseFlightPrice = Math.round(item.price || 45);
      const flightPriceTotal = Math.round(baseFlightPrice * adults + baseFlightPrice * 0.75 * children + baseFlightPrice * 0.15 * infants);

      const rooms = Math.ceil((adults + children) / 2);
      const hotelRatePerNight = minStars === 5 ? 135 : minStars === 4 ? 75 : 45;
      const hotelPrice = hotelRatePerNight * duration * rooms;
      const totalPrice = flightPriceTotal + hotelPrice;
      const pricePerAdult = Math.round(totalPrice / adults);

      const depDateStr = item.departure_at ? item.departure_at.slice(0, 10) : new Date().toISOString().slice(0, 10);
      const retDateStr = item.return_at ? item.return_at.slice(0, 10) : new Date(Date.now() + duration * 86400000).toISOString().slice(0, 10);

      const paxString = `${adults}${children > 0 ? `c${children}` : ''}${infants > 0 ? `i${infants}` : ''}`;
      // Enlace directo oficial de Aviasales en español con marker de afiliado
      const affiliateUrl = `https://www.aviasales.es/search/${origin}${depDateStr.replace(/-/g, '')}${destCode}${retDateStr.replace(/-/g, '')}${paxString}?marker=${marker}`;

      return {
        id: `deal-${idx}-${destCode}`,
        origin,
        originCityName: getOriginCityName(origin),
        destination: destCode,
        destinationCityName: cityInfo.city,
        destinationCountry: cityInfo.country,
        adults,
        children,
        infants,
        totalPassengers,
        isByCar: false,
        flightPricePerPerson: baseFlightPrice,
        flightPriceTotal,
        hotelEstimatedPrice: hotelPrice,
        totalPrice,
        pricePerAdult,
        departureDate: depDateStr,
        returnDate: retDateStr,
        nights: duration,
        hotelStars: minStars,
        imageUrl: cityInfo.image,
        affiliateUrl,
        airline: item.airline || 'Vuelo Directo',
        transfers: item.transfers || 0,
        hasEvChargerHotel: idx % 2 === 0
      };
    });

    let filteredDeals = deals;
    if (query.evChargingOnly) {
      filteredDeals = deals.filter(d => d.hasEvChargerHotel);
    }

    filteredDeals.sort((a, b) => a.totalPrice - b.totalPrice);

    return filteredDeals.length > 0 ? filteredDeals : generateFallbackDeals(query, marker);
  } catch (error) {
    console.error('Error fetching Travelpayouts deals:', error);
    return generateFallbackDeals(query, marker);
  }
}

function generateCarHotelDeals(query: EscapadaSearchQuery, marker: string): FlightDeal[] {
  const selectedDest = query.destination && query.destination !== 'ANY' ? query.destination : undefined;
  const adults = Math.max(1, query.adults || 2);
  const children = Math.max(0, query.children || 0);
  const infants = Math.max(0, query.infants || 0);
  const totalPassengers = adults + children + infants;
  const duration = query.durationDays || 2;
  const minStars = query.minStars || 3;

  let destinations = [
    { code: 'OPO', city: 'Oporto', country: 'Portugal' },
    { code: 'LIS', city: 'Lisboa', country: 'Portugal' },
    { code: 'PMI', city: 'Palma de Mallorca', country: 'España' },
    { code: 'MIL', city: 'Milán', country: 'Italia' },
    { code: 'PAR', city: 'París', country: 'Francia' },
    { code: 'ROM', city: 'Roma', country: 'Italia' },
  ];

  if (selectedDest) {
    destinations = destinations.filter(d => d.code === selectedDest);
    if (destinations.length === 0) {
      destinations = [{ code: selectedDest, city: selectedDest, country: 'Europa' }];
    }
  }

  return destinations.map((d, i) => {
    const info = AIRPORTS_MAP[d.code] || { city: d.city, country: d.country, image: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=800&auto=format&fit=crop' };
    const rooms = Math.ceil((adults + children) / 2);
    const hotelRatePerNight = minStars === 5 ? 120 : minStars === 4 ? 70 : 40;
    const hotelPrice = hotelRatePerNight * duration * rooms;
    const totalPrice = hotelPrice; // Vuelo 0€
    const pricePerAdult = Math.round(totalPrice / adults);

    const depDateStr = new Date(Date.now() + (i + 1) * 86400000 * 7).toISOString().slice(0, 10);
    const retDateStr = new Date(Date.now() + ((i + 1) * 7 + duration) * 86400000).toISOString().slice(0, 10);

    const affiliateUrl = `https://hotellook.tp.st/?marker=${marker}`;

    return {
      id: `car-deal-${i}-${d.code}`,
      origin: 'BY_CAR',
      originCityName: '🚗 En Coche / Coche Eléctrico',
      destination: d.code,
      destinationCityName: info.city,
      destinationCountry: info.country,
      adults,
      children,
      infants,
      totalPassengers,
      isByCar: true,
      flightPricePerPerson: 0,
      flightPriceTotal: 0,
      hotelEstimatedPrice: hotelPrice,
      totalPrice,
      pricePerAdult,
      departureDate: depDateStr,
      returnDate: retDateStr,
      nights: duration,
      hotelStars: minStars,
      imageUrl: info.image,
      affiliateUrl,
      airline: 'Sin Vuelo (Viaje en Coche)',
      transfers: 0,
      hasEvChargerHotel: true
    };
  });
}

function generateFallbackDeals(query: EscapadaSearchQuery, marker: string): FlightDeal[] {
  const origin = query.origin || 'MAD';
  const selectedDest = query.destination && query.destination !== 'ANY' ? query.destination : undefined;
  const adults = Math.max(1, query.adults || 2);
  const children = Math.max(0, query.children || 0);
  const infants = Math.max(0, query.infants || 0);
  const totalPassengers = adults + children + infants;
  const duration = query.durationDays || 2;
  const minStars = query.minStars || 3;

  let fallbackDestinations = [
    { code: 'MIL', price: 29 },
    { code: 'OPO', price: 34 },
    { code: 'PMI', price: 38 },
    { code: 'ROM', price: 42 },
    { code: 'PAR', price: 49 },
    { code: 'LIS', price: 52 },
  ];

  if (selectedDest) {
    fallbackDestinations = fallbackDestinations.filter(d => d.code === selectedDest);
    if (fallbackDestinations.length === 0) {
      fallbackDestinations = [{ code: selectedDest, price: 45 }];
    }
  }

  return fallbackDestinations.map((d, i) => {
    const info = AIRPORTS_MAP[d.code] || { city: d.code, country: 'Europa', image: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=800&auto=format&fit=crop' };
    const flightPriceTotal = Math.round(d.price * adults + d.price * 0.75 * children + d.price * 0.15 * infants);
    const rooms = Math.ceil((adults + children) / 2);
    const hotelPrice = (minStars === 5 ? 120 : minStars === 4 ? 70 : 40) * duration * rooms;
    const totalPrice = flightPriceTotal + hotelPrice;
    const pricePerAdult = Math.round(totalPrice / adults);

    const depDateStr = new Date(Date.now() + (i + 1) * 86400000 * 7).toISOString().slice(0, 10);
    const retDateStr = new Date(Date.now() + ((i + 1) * 7 + duration) * 86400000).toISOString().slice(0, 10);
    const paxString = `${adults}${children > 0 ? `c${children}` : ''}${infants > 0 ? `i${infants}` : ''}`;
    const affiliateUrl = `https://www.aviasales.es/search/${origin}${depDateStr.replace(/-/g, '')}${d.code}${retDateStr.replace(/-/g, '')}${paxString}?marker=${marker}`;

    return {
      id: `fallback-${i}-${d.code}`,
      origin,
      originCityName: getOriginCityName(origin),
      destination: d.code,
      destinationCityName: info.city,
      destinationCountry: info.country,
      adults,
      children,
      infants,
      totalPassengers,
      isByCar: false,
      flightPricePerPerson: d.price,
      flightPriceTotal,
      hotelEstimatedPrice: hotelPrice,
      totalPrice,
      pricePerAdult,
      departureDate: new Date(Date.now() + (i + 1) * 86400000 * 7).toISOString().slice(0, 10),
      returnDate: new Date(Date.now() + ((i + 1) * 7 + duration) * 86400000).toISOString().slice(0, 10),
      nights: duration,
      hotelStars: minStars,
      imageUrl: info.image,
      affiliateUrl,
      airline: 'Vuelo Directo',
      transfers: 0,
      hasEvChargerHotel: true
    };
  });
}
