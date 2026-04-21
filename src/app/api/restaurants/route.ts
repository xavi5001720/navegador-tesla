import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');
  const radius = searchParams.get('radius');

  if (!lat || !lon || !radius) {
    return NextResponse.json({ error: 'Faltan parámetros (lat, lon, radius)' }, { status: 400 });
  }

  // Obtenemos el API Key de las variables de entorno para que no se exponga en el cliente
  const apiKey = process.env.FOURSQUARE_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'Configuración de Foursquare incompleta en el servidor' }, { status: 500 });
  }

  try {
    // Categoría 13065 = Restaurantes en general según la taxonomía de FSQ v3
    // Limitamos los fields para ahorrar cuota y no pedimos fotos (photos) según lo acordado
    const url = `https://api.foursquare.com/v3/places/search?ll=${lat},${lon}&radius=${radius}&categories=13065&limit=50&fields=fsq_id,name,geocodes,rating,categories`;

    const res = await fetch(url, {
      headers: {
        'Authorization': apiKey,
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      throw new Error(`Foursquare API respondió con estado: ${res.status}`);
    }

    const data = await res.json();
    
    // Mapeamos al formato estandarizado que espera nuestro frontend
    const restaurants = data.results.map((r: any) => ({
      id: r.fsq_id, // Usamos fsq_id como ID principal
      name: r.name,
      lat: r.geocodes?.main?.latitude,
      lon: r.geocodes?.main?.longitude,
      cuisine: r.categories && r.categories.length > 0 ? r.categories[0].name : 'Variada',
      rating_foursquare: r.rating || null // El rating de Foursquare es de 0.0 a 10.0
    })).filter((r: any) => r.lat && r.lon); // Filtramos los que no tengan geocodes válidos

    return NextResponse.json({ elements: restaurants });

  } catch (error) {
    console.error('[Foursquare API Proxy Error]:', error);
    return NextResponse.json({ error: 'Error interno conectando con Foursquare' }, { status: 500 });
  }
}
