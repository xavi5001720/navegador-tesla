import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const revalidate = 0; // Sin caché — datos siempre en tiempo real
export const maxDuration = 60; // Hasta 60s en Vercel
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase credentials' }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    let allData: any[] = [];
    let hasMore = true;
    let start = 0;
    while (hasMore) {
      const { data, error } = await supabase.from('radars').select('geom, updated_at').range(start, start + 999);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allData.push(...data);
      if (data.length < 1000) hasMore = false;
      start += 1000;
      if (start >= 20000) break; // Límite de seguridad
    }

    let es = { count: 0, lastUpdate: 0 };
    let fr = { count: 0, lastUpdate: 0 };

    allData.forEach((r: any) => {
      if (!r.geom) return;

      let lon: number | null = null;
      let lat: number | null = null;

      // 1. Si es formato antiguo de texto (POINT)
      if (typeof r.geom === 'string' && r.geom.startsWith('POINT')) {
        const match = r.geom.match(/POINT\(([^ ]+) ([^)]+)\)/);
        if (match) {
          lon = parseFloat(match[1]);
          lat = parseFloat(match[2]);
        }
      } 
      // 2. Si es formato antiguo binario EWKB
      else if (typeof r.geom === 'string' && r.geom.startsWith('0101')) {
        try {
          const buffer = Buffer.from(r.geom, 'hex');
          lon = buffer.readDoubleLE(9);
          lat = buffer.readDoubleLE(17);
        } catch (e) {
          lon = null;
        }
      }
      // 3. NUEVO: Si Supabase ya lo devuelve serializado como GeoJSON (PostGIS geo format)
      else if (r.geom.type === 'Point' && Array.isArray(r.geom.coordinates)) {
        lon = r.geom.coordinates[0];
        lat = r.geom.coordinates[1];
      }

      if (lon !== null && lat !== null) {
        const updatedTime = new Date(r.updated_at).getTime();

        // ESPAÑA: lat 27 a 44, lon -19 a 5
        if (lat >= 27 && lat <= 44 && lon >= -19 && lon <= 5) {
          es.count++;
          if (updatedTime > es.lastUpdate) es.lastUpdate = updatedTime;
        } 
        // FRANCIA: lat 41 a 52, lon -5 a 10 (con lon > 5 entre lat 41-44 para no pisar Cataluña)
        else if (
          (lat >= 41 && lat <= 44 && lon > 5 && lon <= 10) || 
          (lat > 44 && lat <= 52 && lon >= -5 && lon <= 10)
        ) {
          fr.count++;
          if (updatedTime > fr.lastUpdate) fr.lastUpdate = updatedTime;
        }
      }
    });

    return NextResponse.json({
      es: { count: es.count, lastUpdate: es.lastUpdate > 0 ? new Date(es.lastUpdate).toISOString() : null },
      fr: { count: fr.count, lastUpdate: fr.lastUpdate > 0 ? new Date(fr.lastUpdate).toISOString() : null },
      total: allData.length
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
