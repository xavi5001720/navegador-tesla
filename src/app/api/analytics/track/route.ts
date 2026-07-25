import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function getLivePath() {
  const primaryDir = '/home/xavi/proyectos-antigravity/1-referidos/inventarios';
  if (fs.existsSync(primaryDir)) {
    return path.join(primaryDir, 'site_visits.json');
  }
  const fallbackDir = path.join(process.cwd(), 'public', 'data');
  if (!fs.existsSync(fallbackDir)) {
    fs.mkdirSync(fallbackDir, { recursive: true });
  }
  return path.join(fallbackDir, 'site_visits.json');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { path: pagePath, referrer, userAgent } = body;

    const visitsFile = getLivePath();
    let visits: any[] = [];

    if (fs.existsSync(visitsFile)) {
      try {
        const raw = fs.readFileSync(visitsFile, 'utf-8');
        visits = JSON.parse(raw);
      } catch (e) {
        visits = [];
      }
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const newEntry = {
      timestamp: now.toISOString(),
      date: today,
      path: pagePath || '/',
      referrer: referrer || 'Directo',
      userAgent: userAgent || 'Desconocido'
    };

    visits.push(newEntry);
    // Keep last 20,000 entries
    if (visits.length > 20000) {
      visits = visits.slice(-20000);
    }

    const dir = path.dirname(visitsFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(visitsFile, JSON.stringify(visits, null, 2), 'utf-8');

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
