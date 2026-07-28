import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { path: pagePath, referrer, userAgent } = body;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uoejbgifzstyugjsnwkc.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase credentials missing' }, { status: 500 });
    }

    const payload = {
      bbox_key: `${pagePath || '/'}|||${referrer || 'Directo'}|||${userAgent || 'Desconocido'}`,
      ulat: userAgent && /mobile|android|iphone|ipad/i.test(userAgent) ? 1 : 0,
      ulon: referrer && (referrer.includes('t.me') || referrer.includes('telegram')) ? 1 : 0
    };

    const res = await fetch(`${supabaseUrl}/rest/v1/opensky_requests`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: errText }, { status: res.status });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
