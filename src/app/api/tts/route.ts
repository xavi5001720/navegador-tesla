import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const text = searchParams.get('text');
  const lang = searchParams.get('lang') || 'es';

  if (!text) {
    return NextResponse.json({ error: 'Text parameter is required' }, { status: 400 });
  }

  try {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${lang}&q=${encodeURIComponent(text)}`;
    
    // Fetch desde el servidor para evitar bloqueos por CORS o Referer del navegador
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    });

    if (!response.ok) {
      throw new Error(`Google TTS responded with status ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });

  } catch (error) {
    console.error('Error proxying TTS:', error);
    return NextResponse.json({ error: 'Failed to fetch TTS' }, { status: 500 });
  }
}
