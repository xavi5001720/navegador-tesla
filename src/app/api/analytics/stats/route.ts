import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uoejbgifzstyugjsnwkc.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase credentials missing' }, { status: 500 });
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/opensky_requests?select=*&order=created_at.desc&limit=10000`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      cache: 'no-store'
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: res.status });
    }

    const rows: any[] = await res.json();
    const today = new Date().toISOString().split('T')[0];

    let todayVisits = 0;
    const visitsByPage: Record<string, number> = {};
    const trafficSources: Record<string, number> = {};
    const devices: Record<string, number> = {};

    for (const r of rows) {
      const rowDate = (r.created_at || '').split('T')[0];
      if (rowDate === today) todayVisits++;

      const parts = (r.bbox_key || '').split('|||');
      const pagePath = parts[0] || '/';
      const ref = parts[1] || 'Directo';
      const ua = parts[2] || '';

      visitsByPage[pagePath] = (visitsByPage[pagePath] || 0) + 1;

      let src = 'Directo / Google';
      if (ref.includes('t.me') || ref.includes('telegram') || r.ulon === 1) {
        src = 'Telegram 📱';
      } else if (ref !== 'Directo') {
        src = ref;
      }
      trafficSources[src] = (trafficSources[src] || 0) + 1;

      const isMobile = r.ulat === 1 || /mobile|android|iphone|ipad/i.test(ua);
      const dev = isMobile ? 'Móvil 📱' : 'Ordenador 💻';
      devices[dev] = (devices[dev] || 0) + 1;
    }

    return NextResponse.json({
      totalVisits: rows.length,
      todayVisits,
      todayDate: today,
      visitsByPage,
      trafficSources,
      devices
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
