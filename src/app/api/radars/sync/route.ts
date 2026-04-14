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
    // ── España Sur ── (lat 27-39, lon -19-5) -> crons: 01:00 AM
    if (country === 'all' || country === 'es' || country === 'es_south') {
      console.log('[RadarSync] Sincronizando España Sur...');
      const queryESS = `
        [out:json][timeout:90];
        (
          node["highway"="speed_camera"](27.0,-19.0,39.0,5.0);
          node["enforcement"="speed"](27.0,-19.0,39.0,5.0);
        );
        out body;
      `;
      const elementsESS = await fetchRadarsFromOverpass(queryESS);
      console.log(`[RadarSync] España Sur: ${elementsESS.length} elementos.`);
      results.españa_sur = await upsertRadars(supabase, elementsESS);
    }

    // ── España Norte ── (lat 39-44, lon -10-5) -> crons: 02:00 AM
    if (country === 'all' || country === 'es' || country === 'es_north') {
      console.log('[RadarSync] Sincronizando España Norte...');
      const queryESN = `
        [out:json][timeout:90];
        (
          node["highway"="speed_camera"](39.0,-10.0,44.0,5.0);
          node["enforcement"="speed"](39.0,-10.0,44.0,5.0);
        );
        out body;
      `;
      const elementsESN = await fetchRadarsFromOverpass(queryESN);
      console.log(`[RadarSync] España Norte: ${elementsESN.length} elementos.`);
      results.españa_norte = await upsertRadars(supabase, elementsESN);
    }

    // ── Francia Sur ── (lat 41-45, lon -5-10) -> crons: 03:00 AM
    if (country === 'all' || country === 'fr' || country === 'fr_south') {
      console.log('[RadarSync] Sincronizando Francia Sur...');
      const queryFRS = `
        [out:json][timeout:90];
        (
          node["highway"="speed_camera"](41.0,-5.0,45.0,10.0);
          node["enforcement"="speed"](41.0,-5.0,45.0,10.0);
        );
        out body;
      `;
      const elementsFRS = await fetchRadarsFromOverpass(queryFRS);
      console.log(`[RadarSync] Francia Sur: ${elementsFRS.length} elementos.`);
      results.francia_sur = await upsertRadars(supabase, elementsFRS);
    }

    // ── Francia Centro ── (lat 45-48, lon -5-10) -> crons: 04:00 AM
    if (country === 'all' || country === 'fr' || country === 'fr_mid') {
      console.log('[RadarSync] Sincronizando Francia Centro...');
      const queryFRM = `
        [out:json][timeout:90];
        (
          node["highway"="speed_camera"](45.0,-5.0,48.0,10.0);
          node["enforcement"="speed"](45.0,-5.0,48.0,10.0);
        );
        out body;
      `;
      const elementsFRM = await fetchRadarsFromOverpass(queryFRM);
      console.log(`[RadarSync] Francia Centro: ${elementsFRM.length} elementos.`);
      results.francia_centro = await upsertRadars(supabase, elementsFRM);
    }

    // ── Francia Norte ── (lat 48-52, lon -5-10) -> crons: 05:00 AM
    if (country === 'all' || country === 'fr' || country === 'fr_north') {
      console.log('[RadarSync] Sincronizando Francia Norte...');
      const queryFRN = `
        [out:json][timeout:90];
        (
          node["highway"="speed_camera"](48.0,-5.0,52.0,10.0);
          node["enforcement"="speed"](48.0,-5.0,52.0,10.0);
        );
        out body;
      `;
      const elementsFRN = await fetchRadarsFromOverpass(queryFRN);
      console.log(`[RadarSync] Francia Norte: ${elementsFRN.length} elementos.`);
      results.francia_norte = await upsertRadars(supabase, elementsFRN);
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
