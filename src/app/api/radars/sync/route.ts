import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const BATCH_SIZE = 500;

async function fetchRadarsFromOverpass(query: string): Promise<any[]> {
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`
  });
  if (!response.ok) throw new Error('Overpass error: ' + response.statusText);
  const data = await response.json();
  return data.elements || [];
}

async function upsertRadars(supabase: any, elements: any[]): Promise<number> {
  const mappedRadars = elements.map((el: any) => ({
    id: el.id,
    geom: `POINT(${el.lon} ${el.lat})`,
    radar_type: (el.tags?.highway === 'speed_camera' || el.tags?.enforcement === 'speed') ? 'fixed' : 'unknown',
    speed_limit: el.tags?.maxspeed ? parseInt(el.tags.maxspeed) : null,
    updated_at: new Date().toISOString(),
  }));

  let count = 0;
  for (let i = 0; i < mappedRadars.length; i += BATCH_SIZE) {
    const batch = mappedRadars.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('radars').upsert(batch, { onConflict: 'id' });
    if (error) throw error;
    count += batch.length;
  }
  return count;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  const country = searchParams.get('country') || 'all'; // ?country=es | fr | all

  const cronHeader = request.headers.get('Authorization');
  const isVercelCron = cronHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isUserSecret = process.env.SYNC_SECRET && secret === process.env.SYNC_SECRET;

  if (!isVercelCron && !isUserSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const results: Record<string, number> = {};

  try {
    // ── España ──────────────────────────────────────────────────────────────
    if (country === 'all' || country === 'es') {
      console.log('[RadarSync] Sincronizando España...');
      const queryES = `
        [out:json][timeout:90];
        (
          node["highway"="speed_camera"](27,-19,44,5);
          node["enforcement"="speed"](27,-19,44,5);
        );
        out body;
      `;
      const elementsES = await fetchRadarsFromOverpass(queryES);
      console.log(`[RadarSync] España: ${elementsES.length} elementos.`);
      results.españa = await upsertRadars(supabase, elementsES);
    }

    // ── Francia ──────────────────────────────────────────────────────────────
    if (country === 'all' || country === 'fr') {
      console.log('[RadarSync] Sincronizando Francia...');
      const queryFR = `
        [out:json][timeout:90];
        (
          node["highway"="speed_camera"](41,-5,51,10);
          node["enforcement"="speed"](41,-5,51,10);
        );
        out body;
      `;
      const elementsFR = await fetchRadarsFromOverpass(queryFR);
      console.log(`[RadarSync] Francia: ${elementsFR.length} elementos.`);
      results.francia = await upsertRadars(supabase, elementsFR);
    }

    const total = Object.values(results).reduce((a, b) => a + b, 0);
    console.log(`[RadarSync] Completado: ${JSON.stringify(results)} | Total: ${total}`);

    return NextResponse.json({
      success: true,
      results,
      total,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[RadarSync] Fallo:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
