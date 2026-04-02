export interface Airport {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export const SPANISH_AIRPORTS: Airport[] = [
  { id: 'LEBL', name: 'Aeropuerto Josep Tarradellas Barcelona-El Prat', lat: 41.2974, lon: 2.0833 },
  { id: 'LELL', name: 'Aeropuerto de Sabadell', lat: 41.5209, lon: 2.1051 },
  { id: 'LEGE', name: 'Aeropuerto de Girona-Costa Brava', lat: 41.9010, lon: 2.7606 },
  { id: 'LERS', name: 'Aeropuerto de Reus', lat: 41.1474, lon: 1.1672 },
  { id: 'LEMD', name: 'Aeropuerto Adolfo Suárez Madrid-Barajas', lat: 40.4839, lon: -3.5680 },
  { id: 'LEPA', name: 'Aeropuerto de Palma de Mallorca', lat: 39.5517, lon: 2.7388 },
  { id: 'LEVC', name: 'Aeropuerto de Valencia', lat: 39.4893, lon: -0.4816 },
  { id: 'LEAL', name: 'Aeropuerto de Alicante-Elche', lat: 38.2822, lon: -0.5582 },
  { id: 'LEMG', name: 'Aeropuerto de Málaga-Costa del Sol', lat: 36.6749, lon: -4.4991 },
  { id: 'LEBL_TER', name: 'Terminal El Prat', lat: 41.2889, lon: 2.0722 }
];

export const AIRPORT_LANDING_RADIUS_M = 5000; // 5 km radio
