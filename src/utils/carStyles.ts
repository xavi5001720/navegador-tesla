export const carColorFilters: Record<string, string> = {
  'Blanco': 'brightness(1.5) contrast(1.1) grayscale(0.2)',
  'Negro': 'brightness(0.3) contrast(1.5) grayscale(1)',
  'Gris': 'grayscale(1) brightness(0.9) contrast(1.1)',
  'Azul': 'sepia(1) saturate(15) hue-rotate(180deg) brightness(0.6) contrast(1.3)',
  'Rojo': 'sepia(1) saturate(15) hue-rotate(330deg) brightness(0.6) contrast(1.3)',
};

export const getCarFilter = (color?: string) => {
  return carColorFilters[color || 'Blanco'] || carColorFilters['Blanco'];
};
