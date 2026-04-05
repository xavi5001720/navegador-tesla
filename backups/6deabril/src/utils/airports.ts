export interface Airport {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export const SPANISH_AIRPORTS: Airport[] = [
  // Cataluña
  { id: 'LEBL', name: 'Aeropuerto Josep Tarradellas Barcelona-El Prat', lat: 41.2974, lon: 2.0833 },
  { id: 'LELL', name: 'Aeropuerto de Sabadell', lat: 41.5209, lon: 2.1051 },
  { id: 'LEGE', name: 'Aeropuerto de Girona-Costa Brava', lat: 41.9010, lon: 2.7606 },
  { id: 'LERS', name: 'Aeropuerto de Reus', lat: 41.1474, lon: 1.1672 },
  { id: 'LEBL_TER', name: 'Terminal El Prat', lat: 41.2889, lon: 2.0722 },

  // Madrid
  { id: 'LEMD', name: 'Aeropuerto Adolfo Suárez Madrid-Barajas', lat: 40.4839, lon: -3.5680 },
  { id: 'LECU', name: 'Aeropuerto de Madrid-Cuatro Vientos', lat: 40.3706, lon: -3.7850 },
  { id: 'LETO', name: 'Aeropuerto de Madrid-Torrejón', lat: 40.4967, lon: -3.4450 },

  // Baleares
  { id: 'LEPA', name: 'Aeropuerto de Palma de Mallorca', lat: 39.5517, lon: 2.7388 },
  { id: 'LEIB', name: 'Aeropuerto de Ibiza', lat: 38.8728, lon: 1.3731 },
  { id: 'LEMH', name: 'Aeropuerto de Menorca', lat: 39.8625, lon: 4.2186 },

  // Comunidad Valenciana & Murcia
  { id: 'LEVC', name: 'Aeropuerto de Valencia', lat: 39.4893, lon: -0.4816 },
  { id: 'LEAL', name: 'Aeropuerto de Alicante-Elche', lat: 38.2822, lon: -0.5582 },
  { id: 'LEMI', name: 'Aeropuerto Internacional Región de Murcia', lat: 37.8030, lon: -1.1315 },
  { id: 'LELC', name: 'Aeropuerto de Murcia-San Javier', lat: 37.7749, lon: -0.8123 },

  // Andalucía
  { id: 'LEMG', name: 'Aeropuerto de Málaga-Costa del Sol', lat: 36.6749, lon: -4.4991 },
  { id: 'LEZL', name: 'Aeropuerto de Sevilla', lat: 37.4180, lon: -5.8931 },
  { id: 'LEJR', name: 'Aeropuerto de Jerez', lat: 36.7446, lon: -6.0601 },
  { id: 'LEAM', name: 'Aeropuerto de Almería', lat: 36.8439, lon: -2.3700 },
  { id: 'LEGR', name: 'Aeropuerto Federico García Lorca Granada-Jaén', lat: 37.1887, lon: -3.7773 },
  { id: 'LECO_A', name: 'Aeropuerto de Córdoba', lat: 37.8420, lon: -4.8488 },

  // Norte (Galicia, Asturias, Cantabria, País Vasco, Navarra, La Rioja)
  { id: 'LECO', name: 'Aeropuerto de A Coruña', lat: 43.3020, lon: -8.3772 },
  { id: 'LEST', name: 'Aeropuerto de Santiago-Rosalía de Castro', lat: 42.8963, lon: -8.4151 },
  { id: 'LEVX', name: 'Aeropuerto de Vigo', lat: 42.2318, lon: -8.6267 },
  { id: 'LEAS', name: 'Aeropuerto de Asturias', lat: 43.5635, lon: -6.0346 },
  { id: 'LEXJ', name: 'Aeropuerto de Santander-Seve Ballesteros', lat: 43.4271, lon: -3.8196 },
  { id: 'LEBB', name: 'Aeropuerto de Bilbao', lat: 43.3011, lon: -2.9106 },
  { id: 'LESO', name: 'Aeropuerto de San Sebastián', lat: 43.3565, lon: -1.7906 },
  { id: 'LEVT', name: 'Aeropuerto de Vitoria', lat: 42.8828, lon: -2.7244 },
  { id: 'LEPP', name: 'Aeropuerto de Pamplona', lat: 42.7700, lon: -1.6463 },
  { id: 'LERJ', name: 'Aeropuerto de Logroño-Agoncillo', lat: 42.4608, lon: -2.3204 },

  // Castilla y León & Castilla-La Mancha & Aragón & Extremadura
  { id: 'LEVD', name: 'Aeropuerto de Valladolid', lat: 41.7061, lon: -4.8519 },
  { id: 'LESA', name: 'Aeropuerto de Salamanca', lat: 40.9525, lon: -5.5019 },
  { id: 'LEBG', name: 'Aeropuerto de Burgos', lat: 42.3576, lon: -3.6200 },
  { id: 'LELN', name: 'Aeropuerto de León', lat: 42.5890, lon: -5.6555 },
  { id: 'LEZG', name: 'Aeropuerto de Zaragoza', lat: 41.6662, lon: -1.0415 },
  { id: 'LEHS', name: 'Aeropuerto de Huesca-Pirineos', lat: 42.0808, lon: -0.3236 },
  { id: 'LEBZ', name: 'Aeropuerto de Badajoz', lat: 38.8912, lon: -6.8213 },
  { id: 'LERL', name: 'Aeropuerto de Ciudad Real', lat: 38.8569, lon: -3.9700 },

  // Canarias
  { id: 'GCLP', name: 'Aeropuerto de Gran Canaria', lat: 27.9319, lon: -15.3865 },
  { id: 'GCTS', name: 'Aeropuerto de Tenerife Sur', lat: 28.0444, lon: -16.5725 },
  { id: 'GCXO', name: 'Aeropuerto de Tenerife Norte-Ciudad de La Laguna', lat: 28.4826, lon: -16.3415 },
  { id: 'GCFV', name: 'Aeropuerto de Fuerteventura', lat: 28.4527, lon: -13.8638 },
  { id: 'GCRR', name: 'Aeropuerto César Manrique-Lanzarote', lat: 28.9454, lon: -13.6052 },
  { id: 'GCLA', name: 'Aeropuerto de La Palma', lat: 28.6264, lon: -17.7556 },
  { id: 'GCEL', name: 'Aeropuerto de El Hierro', lat: 27.8147, lon: -17.8872 },
  { id: 'GCGM', name: 'Aeropuerto de La Gomera', lat: 28.0296, lon: -17.2146 },

  // Ceuta y Melilla
  { id: 'GEML', name: 'Aeropuerto de Melilla', lat: 35.2798, lon: -2.9562 },
  { id: 'GECE', name: 'Helipuerto de Ceuta', lat: 35.8920, lon: -5.3080 }
];

export const AIRPORT_LANDING_RADIUS_M = 5000; // 5 km radio
