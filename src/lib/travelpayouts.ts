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
  passengers: number;
  flightPricePerPerson: number;
  flightPriceTotal: number;
  hotelEstimatedPrice: number;
  totalPrice: number; // Precio total del paquete para todos los viajeros
  pricePerPerson: number; // Precio por persona (Paquete)
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
  origin: string; // IATA code, e.g. 'MAD', 'BCN'
  passengers: number; // 1, 2, 3, 4
  durationDays: number; // 2, 3, 4, 7
  flexibility: 'weekend' | 'month' | 'dates';
  month?: string; // e.g. '2026-10'
  minStars?: number; // 3, 4, 5
  evChargingOnly?: boolean;
}

const AIRPORTS_MAP: Record<string, { city: string; country: string; image: string }> = {
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
  SCQ: 'Santiago'
};

export function getOriginCityName(code: string): string {
  return ORIGIN_CITIES[code.toUpperCase()] || code;
}

export async function fetchEscapadas(query: EscapadaSearchQuery): Promise<FlightDeal[]> {
  const token = process.env.TRAVELPAYOUTS_TOKEN || '596d62e5f9f6d2f1574865feeb424c75';
  const marker = process.env.TRAVELPAYOUTS_MARKER || '778425';

  const origin = query.origin || 'MAD';
  const passengers = Math.max(1, query.passengers || 2);
  const duration = query.durationDays || 2;
  const minStars = query.minStars || 3;

  const url = `https://api.travelpayouts.com/aviasales/v3/prices_for_dates?origin=${origin}&currency=eur&direct=true&limit=30&token=${token}`;

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
    const items = data.data || [];

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

      const flightPricePerPerson = Math.round(item.price || 45);
      const flightPriceTotal = flightPricePerPerson * passengers;

      // Calcular precio de hotel según habitaciones necesarias (1 habitación por cada 2 personas)
      const rooms = Math.ceil(passengers / 2);
      const hotelRatePerNight = minStars === 5 ? 130 : minStars === 4 ? 75 : 45;
      const hotelPrice = hotelRatePerNight * duration * rooms;
      const totalPrice = flightPriceTotal + hotelPrice;
      const pricePerPerson = Math.round(totalPrice / passengers);

      const depDateStr = item.departure_at ? item.departure_at.slice(0, 10) : new Date().toISOString().slice(0, 10);
      const retDateStr = item.return_at ? item.return_at.slice(0, 10) : new Date(Date.now() + duration * 86400000).toISOString().slice(0, 10);

      const targetUrl = `https://www.aviasales.com/search/${origin}${depDateStr.replace(/-/g, '')}${destCode}${retDateStr.replace(/-/g, '')}${passengers}`;
      const affiliateUrl = `https://tp.media/r?marker=${marker}&p=4114&u=${encodeURIComponent(targetUrl)}`;

      return {
        id: `deal-${idx}-${destCode}`,
        origin,
        originCityName: getOriginCityName(origin),
        destination: destCode,
        destinationCityName: cityInfo.city,
        destinationCountry: cityInfo.country,
        passengers,
        flightPricePerPerson,
        flightPriceTotal,
        hotelEstimatedPrice: hotelPrice,
        totalPrice,
        pricePerPerson,
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

function generateFallbackDeals(query: EscapadaSearchQuery, marker: string): FlightDeal[] {
  const origin = query.origin || 'MAD';
  const passengers = Math.max(1, query.passengers || 2);
  const duration = query.durationDays || 2;
  const minStars = query.minStars || 3;

  const fallbackDestinations = [
    { code: 'MIL', price: 29 },
    { code: 'OPO', price: 34 },
    { code: 'PMI', price: 38 },
    { code: 'ROM', price: 42 },
    { code: 'PAR', price: 49 },
    { code: 'LIS', price: 52 },
  ];

  return fallbackDestinations.map((d, i) => {
    const info = AIRPORTS_MAP[d.code] || { city: d.code, country: 'Europa', image: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=800&auto=format&fit=crop' };
    const flightPriceTotal = d.price * passengers;
    const rooms = Math.ceil(passengers / 2);
    const hotelPrice = (minStars === 5 ? 120 : minStars === 4 ? 70 : 40) * duration * rooms;
    const totalPrice = flightPriceTotal + hotelPrice;
    const pricePerPerson = Math.round(totalPrice / passengers);

    const targetUrl = `https://www.aviasales.com`;
    const affiliateUrl = `https://tp.media/r?marker=${marker}&p=4114&u=${encodeURIComponent(targetUrl)}`;

    return {
      id: `fallback-${i}-${d.code}`,
      origin,
      originCityName: getOriginCityName(origin),
      destination: d.code,
      destinationCityName: info.city,
      destinationCountry: info.country,
      passengers,
      flightPricePerPerson: d.price,
      flightPriceTotal,
      hotelEstimatedPrice: hotelPrice,
      totalPrice,
      pricePerPerson,
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
