import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const revalidate = 3600; // Cachear por 1 hora

export async function GET() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data, error } = await supabase.from('radars').select('geom, updated_at');
    
    if (error) throw error;

    let es = { count: 0, lastUpdate: 0 };
    let frS = { count: 0, lastUpdate: 0 };
    let frN = { count: 0, lastUpdate: 0 };

    data.forEach((r: any) => {
      const match = r.geom.match(/POINT\(([^ ]+) ([^)]+)\)/);
      if (match) {
        const lon = parseFloat(match[1]);
        const lat = parseFloat(match[2]);
        const updatedTime = new Date(r.updated_at).getTime();

        if (lat >= 27 && lat <= 44 && lon >= -19 && lon <= 5) {
          es.count++;
          if (updatedTime > es.lastUpdate) es.lastUpdate = updatedTime;
        } else if (lat > 44 && lat <= 46 && lon >= -5 && lon <= 10) {
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
      total: data.length
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
