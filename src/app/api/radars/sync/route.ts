import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  // Soporta tanto el parámetro ?secret como el header automático de Vercel Cron
  const cronHeader = request.headers.get('Authorization');
  const isVercelCron = cronHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isUserSecret = process.env.SYNC_SECRET && secret === process.env.SYNC_SECRET;

  if (!isVercelCron && !isUserSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[RadarSync] Iniciando sincronización de España...');
    
    // Consulta optimizada con Bounding Box (Caja de coordenadas) que es mucho más rápida que buscar por "Área"
    const overpassQuery = `
      [out:json][timeout:90];
      (
        node["highway"="speed_camera"](27,-19,44,5);
        node["enforcement"="speed"](27,-19,44,5);
      );
      out body;
    `;

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(overpassQuery)}`
    });

    if (!response.ok) throw new Error('Overpass error: ' + response.statusText);

    const data = await response.json();
    const elements = data.elements || [];

    console.log(`[RadarSync] Recibidos ${elements.length} elementos de Overpass.`);

    if (elements.length === 0) {
      return NextResponse.json({ message: 'No radars found' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Mapeamos los datos al formato de la tabla
    const mappedRadars = elements.map((el: any) => ({
      id: el.id,
      geom: `POINT(${el.lon} ${el.lat})`,
      radar_type: (el.tags.highway === 'speed_camera' || el.tags.enforcement === 'speed') ? 'fixed' : 'unknown',
      speed_limit: el.tags.maxspeed ? parseInt(el.tags.maxspeed) : null,
      updated_at: new Date().toISOString(),
    }));

    // Ejecutamos el upsert en lotes para evitar problemas de timeout/memoria si son muchos (España tiene ~2500 radares)
    const BATCH_SIZE = 500;
    let successCount = 0;

    for (let i = 0; i < mappedRadars.length; i += BATCH_SIZE) {
      const batch = mappedRadars.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('radars')
        .upsert(batch, { onConflict: 'id' });

      if (error) {
        console.error(`[RadarSync] Error en batch ${i}:`, error);
        throw error;
      }
      successCount += batch.length;
    }

    console.log(`[RadarSync] Sincronización completada: ${successCount} radares insertados/actualizados.`);

    return NextResponse.json({ 
      success: true, 
      count: successCount,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[RadarSync] Fallo:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
