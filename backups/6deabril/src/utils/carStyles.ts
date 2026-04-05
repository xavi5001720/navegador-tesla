export const carImages: Record<string, string> = {
  'Blanco': '/coche.png',
  'Negro': '/teslanegro.png',
  'Gris': '/teslagris.png',
  'Azul': '/teslaazul.png',
  'Rojo': '/teslarojo.png',
};

export const getCarImage = (color?: string) => {
  return carImages[color || 'Blanco'] || carImages['Blanco'];
};

// Mantenemos la función de filtro pero devolvemos 'none' para que no rompa código existente
// hasta que lo sustituyamos en todos lados.
export const getCarFilter = (color?: string) => {
  return 'none';
};
