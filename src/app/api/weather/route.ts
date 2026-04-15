import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const key = process.env.OPENWEATHER_API_KEY || process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;

  if (!key) {
    return NextResponse.json({ error: 'Weather API Key not configured' }, { status: 500 });
  }

  const owmParams = new URLSearchParams(searchParams);
  owmParams.set('appid', key);

  try {
    const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?${owmParams.toString()}`);

    if (!response.ok) {
      return NextResponse.json({ error: 'Weather API Error' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API Proxy] Error fetching weather:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
