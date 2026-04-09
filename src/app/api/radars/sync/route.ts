import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const BATCH_SIZE = 500;

export const maxDuration = 300; // Aumentar al máximo en Vercel Pro (o 60s en Hobby)
export const dynamic = 'force-dynamic';

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
    // ── España ── (cron 3:00 AM)
    // ── España Norte ── (bbox: lat 40-44, lon -10-5)
    if (country === 'all' || country === 'es' || country === 'es_north') {
      console.log('[RadarSync] Sincronizando España Norte...');
      const queryESN = `
        [out:json][timeout:90];
        (
          node["highway"="speed_camera"](40.0,-10.0,44.0,5.0);
          node["enforcement"="speed"](40.0,-10.0,44.0,5.0);
        );
        out body;
      `;
      const elementsESN = await fetchRadarsFromOverpass(queryESN);
      console.log(`[RadarSync] España Norte: ${elementsESN.length} elementos.`);
      results.españa_norte = await upsertRadars(supabase, elementsESN);
    }

    // ── España Sur ── (bbox: lat 35-40, lon -10-5)
    if (country === 'all' || country === 'es' || country === 'es_south') {
      console.log('[RadarSync] Sincronizando España Sur...');
      const queryESS = `
        [out:json][timeout:90];
        (
          node["highway"="speed_camera"](35.0,-10.0,40.0,5.0);
          node["enforcement"="speed"](35.0,-10.0,40.0,5.0);
        );
        out body;
      `;
      const elementsESS = await fetchRadarsFromOverpass(queryESS);
      console.log(`[RadarSync] España Sur: ${elementsESS.length} elementos.`);
      results.españa_sur = await upsertRadars(supabase, elementsESS);
    }

    // ── Francia Norte ── (cron 4:00 AM) bbox: lat 46-51, lon -5-10
    if (country === 'all' || country === 'fr' || country === 'fr_north') {
      console.log('[RadarSync] Sincronizando Francia Norte...');
      const queryFRN = `
        [out:json][timeout:90];
        (
          node["highway"="speed_camera"](46,-5,51,10);
          node["enforcement"="speed"](46,-5,51,10);
        );
        out body;
      `;
      const elementsFRN = await fetchRadarsFromOverpass(queryFRN);
      console.log(`[RadarSync] Francia Norte: ${elementsFRN.length} elementos.`);
      results.francia_norte = await upsertRadars(supabase, elementsFRN);
    }

    // ── Francia Sur ── (cron 5:00 AM) bbox: lat 41-46, lon -5-10
    if (country === 'all' || country === 'fr' || country === 'fr_south') {
      console.log('[RadarSync] Sincronizando Francia Sur...');
      const queryFRS = `
        [out:json][timeout:90];
        (
          node["highway"="speed_camera"](41,-5,46,10);
          node["enforcement"="speed"](41,-5,46,10);
        );
        out body;
      `;
      const elementsFRS = await fetchRadarsFromOverpass(queryFRS);
      console.log(`[RadarSync] Francia Sur: ${elementsFRS.length} elementos.`);
      results.francia_sur = await upsertRadars(supabase, elementsFRS);
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
