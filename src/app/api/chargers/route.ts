import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const key = process.env.OPENCHARGE_API_KEY || process.env.NEXT_PUBLIC_OPENCHARGE_API_KEY;

  if (!key) {
    return NextResponse.json({ error: 'API Key not configured' }, { status: 500 });
  }

  // Clonamos todos los parámetros recibidos del cliente
  const ocmParams = new URLSearchParams(searchParams);
  ocmParams.set('key', key);

  try {
    const response = await fetch(`https://api.openchargemap.io/v3/poi?${ocmParams.toString()}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'NavegaPRO-Proxy'
      }
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'OCM API Error' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API Proxy] Error fetching chargers:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
