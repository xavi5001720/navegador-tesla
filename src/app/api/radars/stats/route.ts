import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const revalidate = 0; // Sin caché — datos siempre en tiempo real

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
    let frS = { count: 0, lastUpdate: 0 };
    let frN = { count: 0, lastUpdate: 0 };

    allData.forEach((r: any) => {
      if (!r.geom) return;

      let lon: number | null = null;
      let lat: number | null = null;

      // Intentamos parsear WKT (por si viene como texto)
      if (typeof r.geom === 'string' && r.geom.startsWith('POINT')) {
        const match = r.geom.match(/POINT\(([^ ]+) ([^)]+)\)/);
        if (match) {
          lon = parseFloat(match[1]);
          lat = parseFloat(match[2]);
        }
      } 
      // Parsear formato hexadecimal EWKB por defecto de Supabase (e.g. 0101000020E6100000...)
      else if (typeof r.geom === 'string' && r.geom.startsWith('0101')) {
        try {
          const buffer = Buffer.from(r.geom, 'hex');
          // En EWKB Point: 1 byte endianness, 4 bytes type, 4 bytes SRID = 9 bytes offset
          lon = buffer.readDoubleLE(9);
          lat = buffer.readDoubleLE(17);
        } catch (e) {
          lon = null;
        }
      }

      if (lon !== null && lat !== null) {
        const updatedTime = new Date(r.updated_at).getTime();

        // España: bbox de la query Overpass (lat 27-44, lon -19 a 5)
        if (lat >= 27 && lat <= 44 && lon >= -19 && lon <= 5) {
          es.count++;
          if (updatedTime > es.lastUpdate) es.lastUpdate = updatedTime;
        // Francia Sur: bbox de la query Overpass (lat 41-46, lon -5 a 10)
        // Nota: hay solapamiento con España en 41-44 pero en la práctica
        // los puntos en esa banda lon>5 son Francia
        } else if (lat >= 41 && lat <= 46 && lon > 5 && lon <= 10) {
          frS.count++;
          if (updatedTime > frS.lastUpdate) frS.lastUpdate = updatedTime;
        } else if (lat > 46 && lat <= 51 && lon >= -5 && lon <= 10) {
          frN.count++;
          if (updatedTime > frN.lastUpdate) frN.lastUpdate = updatedTime;
        }
      }
    });

    return NextResponse.json({
      es: { count: es.count, lastUpdate: es.lastUpdate > 0 ? new Date(es.lastUpdate).toISOString() : null },
      fr_south: { count: frS.count, lastUpdate: frS.lastUpdate > 0 ? new Date(frS.lastUpdate).toISOString() : null },
      fr_north: { count: frN.count, lastUpdate: frN.lastUpdate > 0 ? new Date(frN.lastUpdate).toISOString() : null },
      total: allData.length
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
