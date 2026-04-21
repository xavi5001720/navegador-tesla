import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');
  const radius = searchParams.get('radius');

  if (!lat || !lon || !radius) {
    return NextResponse.json({ error: 'Faltan parámetros (lat, lon, radius)' }, { status: 400 });
  }

  // Foursquare V2 API credentials from environment variables
  const clientId = process.env.NEXT_PUBLIC_FSQ_CLIENT_ID;
  const clientSecret = process.env.NEXT_PUBLIC_FSQ_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Configuración de Foursquare (Client ID/Secret) incompleta en el servidor' }, { status: 500 });
  }

  try {
    // Categoría de Food/Dining en v2: 4d4b7105d754a06374d81259
    const url = `https://api.foursquare.com/v2/venues/explore?client_id=${clientId}&client_secret=${clientSecret}&v=20260421&ll=${lat},${lon}&categoryId=4d4b7105d754a06374d81259&radius=${radius}&limit=50`;

    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Foursquare API respondió con estado: ${res.status}`);
    }

    const data = await res.json();
    
    // El formato de v2 explore: data.response.groups[0].items[...].venue
    const items = data.response?.groups?.[0]?.items || [];
    
    const restaurants = items.map((item: any) => {
      const r = item.venue;
      return {
        id: r.id, 
        name: r.name,
        lat: r.location?.lat,
        lon: r.location?.lng,
        cuisine: r.categories && r.categories.length > 0 ? r.categories[0].name : 'Variada',
        // Nota: la API v2 /explore no devuelve `rating` sin OAuth de usuario.
        // El sistema usa las reseñas de la comunidad (Supabase) como única fuente de valoración.
        rating_foursquare: null
      };
    }).filter((r: any) => r.lat && r.lon);

    return NextResponse.json({ elements: restaurants });

  } catch (error) {
    console.error('[Foursquare API Proxy Error]:', error);
    return NextResponse.json({ error: 'Error interno conectando con Foursquare' }, { status: 500 });
  }
}
