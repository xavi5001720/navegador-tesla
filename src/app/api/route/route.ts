import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const key = process.env.TOMTOM_API_KEY || process.env.NEXT_PUBLIC_TOMTOM_API_KEY || 'DvoGdJnTAqVFKyqem1NBUv77xJ0CLcny';

  if (!key) {
    return NextResponse.json({ error: 'TomTom API Key not configured' }, { status: 500 });
  }

  const coords = searchParams.get('coords');
  if (!coords) {
    return NextResponse.json({ error: 'Missing coords parameter' }, { status: 400 });
  }

  // Clonamos el resto de parámetros
  const ttParams = new URLSearchParams(searchParams);
  ttParams.delete('coords'); // No lo enviamos a TomTom
  ttParams.set('key', key);

  const url = `https://api.tomtom.com/routing/1/calculateRoute/${coords}/json?${ttParams.toString()}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return NextResponse.json({ error: 'TomTom API Error', details: errData }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API Proxy] Error fetching route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
