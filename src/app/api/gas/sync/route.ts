import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const BATCH_SIZE = 500;

export const maxDuration = 60; // Permitir hasta 60s en Vercel
export const dynamic = 'force-dynamic';
const MINISTRY_URL = 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/';

function parsePrice(val: string | undefined): number | null {
  if (!val || val.trim() === '') return null;
  const num = parseFloat(val.replace(',', '.'));
  return isNaN(num) ? null : num;
}

function parseCoord(val: string | undefined): number | null {
  if (!val || val.trim() === '') return null;
  const num = parseFloat(val.replace(',', '.'));
  return isNaN(num) ? null : num;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  const cronHeader = request.headers.get('Authorization');
  const isVercelCron = cronHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isUserSecret = process.env.SYNC_SECRET && secret === process.env.SYNC_SECRET;

  if (!isVercelCron && !isUserSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase credentials' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('[GasSync] Descargando gasolineras del Ministerio...');
    const res = await fetch(MINISTRY_URL, {
      headers: { 'Accept': 'application/json' },
      // Timeout de 60s para la descarga completa (~15MB)
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error(`Ministry API error: ${res.status}`);

    const data = await res.json();
    const stations = data.ListaEESSPrecio;
    if (!Array.isArray(stations)) throw new Error('Respuesta inesperada de la API del Ministerio');

    console.log(`[GasSync] ${stations.length} gasolineras descargadas. Insertando en Supabase...`);

    const now = new Date().toISOString();
    let totalInserted = 0;

    for (let i = 0; i < stations.length; i += BATCH_SIZE) {
      const batch = stations.slice(i, i + BATCH_SIZE);

      const mapped = batch
        .map((s: any) => {
          const lat = parseCoord(s['Latitud']);
          const lon = parseCoord(s['Longitud (WGS84)']);
          if (!lat || !lon) return null;

          return {
            id: parseInt(s['IDEESS']),
            lat,
            lon,
            geom: `POINT(${lon} ${lat})`,
            name: s['Rótulo']?.trim() || 'Sin nombre',
            address: s['Dirección']?.trim() || '',
            city: s['Localidad']?.trim() || '',
            province: s['Provincia']?.trim() || '',
            schedule: s['Horario']?.trim() || '',
            price_g95: parsePrice(s['Precio Gasolina 95 E5']),
            price_g98: parsePrice(s['Precio Gasolina 98 E5']),
            price_diesel: parsePrice(s['Precio Gasoleo A']),
            price_glp: parsePrice(s['Precio Gases licuados del petróleo']),
            updated_at: now,
          };
        })
        .filter(Boolean);

      if (mapped.length === 0) continue;

      const { error } = await supabase
        .from('gas_stations')
        .upsert(mapped, { onConflict: 'id' });

      if (error) throw error;
      totalInserted += mapped.length;
    }

    console.log(`[GasSync] Completado: ${totalInserted} gasolineras insertadas/actualizadas.`);
    return NextResponse.json({ success: true, total: totalInserted, timestamp: now });

  } catch (error: any) {
    console.error('[GasSync] Fallo:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
