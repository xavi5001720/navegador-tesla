import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function getLivePath() {
  const primary = '/home/xavi/proyectos-antigravity/1-referidos/inventarios/site_visits.json';
  if (fs.existsSync(primary)) return primary;
  return path.join(process.cwd(), 'public', 'data', 'site_visits.json');
}

export async function GET() {
  try {
    const visitsFile = getLivePath();
    if (!fs.existsSync(visitsFile)) {
      return NextResponse.json({
        totalVisits: 0,
        todayVisits: 0,
        todayDate: new Date().toISOString().split('T')[0],
        visitsByPage: {},
        trafficSources: {},
        devices: {}
      });
    }

    const raw = fs.readFileSync(visitsFile, 'utf-8');
    const visits: any[] = JSON.parse(raw);

    const today = new Date().toISOString().split('T')[0];
    let todayVisits = 0;
    const visitsByPage: Record<string, number> = {};
    const trafficSources: Record<string, number> = {};
    const devices: Record<string, number> = {};

    for (const v of visits) {
      if (v.date === today) todayVisits++;
      
      // Page breakdown
      const p = v.path || '/';
      visitsByPage[p] = (visitsByPage[p] || 0) + 1;

      // Source breakdown
      let src = 'Directo / Google';
      if (v.referrer && (v.referrer.includes('t.me') || v.referrer.includes('telegram'))) {
        src = 'Telegram 📱';
      } else if (v.referrer && v.referrer !== 'Directo') {
        src = v.referrer;
      }
      trafficSources[src] = (trafficSources[src] || 0) + 1;

      // Device breakdown
      const isMobile = /mobile|android|iphone|ipad/i.test(v.userAgent || '');
      const dev = isMobile ? 'Móvil 📱' : 'Ordenador 💻';
      devices[dev] = (devices[dev] || 0) + 1;
    }

    return NextResponse.json({
      totalVisits: visits.length,
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
