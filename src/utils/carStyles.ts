export const carColorFilters: Record<string, string> = {
  'Blanco': 'brightness(1.5) contrast(1.1)',
  'Negro': 'brightness(0.3) contrast(1.2) drop-shadow(0 0 2px rgba(255,255,255,0.2))',
  'Gris': 'grayscale(1) brightness(0.9) contrast(1.1)',
  'Azul': 'hue-rotate(200deg) saturate(2.5) brightness(0.8) contrast(1.2)',
  'Rojo': 'hue-rotate(345deg) saturate(3) brightness(0.8) contrast(1.2)',
};

export const getCarFilter = (color?: string) => {
  return carColorFilters[color || 'Blanco'] || carColorFilters['Blanco'];
};
