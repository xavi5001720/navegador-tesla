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
  const mappedRadars: any[] = [];
  const mappedZones: any[] = [];

  elements.forEach((el: any) => {
    // Definir tipo de radar según etiquetas OSM
    let rType = 'fixed';
    if (el.tags?.['camera:type'] === 'average_speed') rType = 'section';
    else if (el.tags?.['camera:type'] === 'red_light' || el.tags?.enforcement === 'traffic_signals') rType = 'camera';
    else if (el.tags?.['camera:type'] === 'mobile' || el.tags?.enforcement === 'mobile') rType = 'mobile_zone';

    // Parsear dirección
    let direction = null;
    if (el.tags?.direction && !isNaN(parseFloat(el.tags.direction))) {
      direction = parseFloat(el.tags.direction);
    }

    if (rType === 'mobile_zone') {
      mappedZones.push({
        id: el.id,
        geom: `POINT(${el.lon} ${el.lat})`,
        radius: 400,
        confidence: 0.8,
        updated_at: new Date().toISOString()
      });
    } else {
      mappedRadars.push({
        id: el.id,
        geom: `POINT(${el.lon} ${el.lat})`,
        lat: el.lat,
        lon: el.lon,
        radar_type: rType,
        speed_limit: el.tags?.maxspeed ? parseInt(el.tags.maxspeed) : null,
        direction: direction,
        road: el.tags?.['addr:street'] || null, // mejor aproximación en nodos
        updated_at: new Date().toISOString(),
      });
    }
  });

  let count = 0;
  for (let i = 0; i < mappedRadars.length; i += BATCH_SIZE) {
    const batch = mappedRadars.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('radars').upsert(batch, { onConflict: 'id' });
    if (error) {
      console.error("[RadarSync] Error upserting radars:", error);
      throw error;
    }
    count += batch.length;
  }

  // Insertar zonas móviles generadas por OSM (si las hay)
  for (let i = 0; i < mappedZones.length; i += BATCH_SIZE) {
    const batch = mappedZones.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('radar_zones').upsert(batch, { onConflict: 'id' });
    if (error) console.error("[RadarSync] Error upserting radar zones:", error);
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
    // ── España Sur-Oeste ── (lat 27-39, lon -19 a -3)
    if (country === 'all' || country === 'es' || country === 'es_south_west') {
      console.log('[RadarSync] Sincronizando España Sur-Oeste...');
      const query = `[out:json][timeout:90];(node["highway"="speed_camera"](27.0,-19.0,39.0,-3.0);node["enforcement"="speed"](27.0,-19.0,39.0,-3.0););out body;`;
      const elements = await fetchRadarsFromOverpass(query);
      results.es_south_west = await upsertRadars(supabase, elements);
    }

    // ── España Sur-Este ── (lat 27-39, lon -3 a 5)
    if (country === 'all' || country === 'es' || country === 'es_south_east') {
      console.log('[RadarSync] Sincronizando España Sur-Este...');
      const query = `[out:json][timeout:90];(node["highway"="speed_camera"](27.0,-3.0,39.0,5.0);node["enforcement"="speed"](27.0,-3.0,39.0,5.0););out body;`;
      const elements = await fetchRadarsFromOverpass(query);
      results.es_south_east = await upsertRadars(supabase, elements);
    }

    // ── España Norte-Oeste ── (lat 39-44, lon -10 a -3)
    if (country === 'all' || country === 'es' || country === 'es_north_west') {
      console.log('[RadarSync] Sincronizando España Norte-Oeste...');
      const query = `[out:json][timeout:90];(node["highway"="speed_camera"](39.0,-10.0,44.0,-3.0);node["enforcement"="speed"](39.0,-10.0,44.0,-3.0););out body;`;
      const elements = await fetchRadarsFromOverpass(query);
      results.es_north_west = await upsertRadars(supabase, elements);
    }

    // ── España Norte-Este ── (lat 39-44, lon -3 a 5)
    if (country === 'all' || country === 'es' || country === 'es_north_east') {
      console.log('[RadarSync] Sincronizando España Norte-Este...');
      const query = `[out:json][timeout:90];(node["highway"="speed_camera"](39.0,-3.0,44.0,5.0);node["enforcement"="speed"](39.0,-3.0,44.0,5.0););out body;`;
      const elements = await fetchRadarsFromOverpass(query);
      results.es_north_east = await upsertRadars(supabase, elements);
    }

    // ── Francia Sur ── (lat 41-45, lon -5-10) -> crons: 03:00 AM
    // ── FRANCIA: División en 6 cuadrantes para evitar Timeouts ──
    const frZones = [
      { name: 'fr_south_west', bbox: '41.0,-5.0,45.0,2.5' },
      { name: 'fr_south_east', bbox: '41.0,2.5,45.0,10.0' },
      { name: 'fr_mid_west',   bbox: '45.0,-5.0,48.5,2.5' },
      { name: 'fr_mid_east',   bbox: '45.0,2.5,48.5,10.0' },
      { name: 'fr_north_west', bbox: '48.5,-5.0,52.0,2.5' },
      { name: 'fr_north_east', bbox: '48.5,2.5,52.0,10.0' }
    ];

    for (const zone of frZones) {
      // Mapeo de compatibilidad: fr_south incluye sw/se, fr_mid incluye mw/me, fr_north incluye nw/ne
      const isLegacyMatch = 
        (country === 'fr_south' && zone.name.startsWith('fr_south')) ||
        (country === 'fr_mid' && zone.name.startsWith('fr_mid')) ||
        (country === 'fr_north' && zone.name.startsWith('fr_north'));

      if (country === 'all' || country === 'fr' || country === zone.name || isLegacyMatch) {
        console.log(`[RadarSync] Sincronizando ${zone.name}...`);
        const query = `[out:json][timeout:90];(node["highway"="speed_camera"](${zone.bbox});node["enforcement"="speed"](${zone.bbox}););out body;`;
        try {
          const elements = await fetchRadarsFromOverpass(query);
          console.log(`[RadarSync] ${zone.name}: ${elements.length} elementos.`);
          const count = await upsertRadars(supabase, elements);
          results[zone.name] = count;
        } catch (e: any) {
          console.error(`[RadarSync] Fallo en ${zone.name}:`, e.message);
          results[zone.name] = 0;
        }
      }
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
