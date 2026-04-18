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
    // 1. Conteo total
    const { count: totalCount, error: totalError } = await supabase
      .from('radars')
      .select('*', { count: 'exact', head: true });

    if (totalError) throw totalError;

    // 2. Estadísticas España (Península + Canarias)
    const { count: countEs } = await supabase
      .from('radars')
      .select('*', { count: 'exact', head: true })
      .or('and(lat.gte.34,lat.lte.44,lon.gte.-10,lon.lte.5),and(lat.gte.27,lat.lte.30,lon.gte.-19,lon.lte.-13)');

    const { data: latestEs } = await supabase
      .from('radars')
      .select('updated_at')
      .or('and(lat.gte.34,lat.lte.44,lon.gte.-10,lon.lte.5),and(lat.gte.27,lat.lte.30,lon.gte.-19,lon.lte.-13)')
      .order('updated_at', { ascending: false })
      .limit(1);

    // 3. Estadísticas Francia
    const { count: countFr } = await supabase
      .from('radars')
      .select('*', { count: 'exact', head: true })
      .filter('lat', 'gt', 44)
      .filter('lat', 'lte', 52)
      .filter('lon', 'gte', -5)
      .filter('lon', 'lte', 10);

    const { data: latestFr } = await supabase
      .from('radars')
      .select('updated_at')
      .filter('lat', 'gt', 44)
      .filter('lat', 'lte', 52)
      .filter('lon', 'gte', -5)
      .filter('lon', 'lte', 10)
      .order('updated_at', { ascending: false })
      .limit(1);

    return NextResponse.json({
      es: { 
        count: countEs || 0, 
        lastUpdate: latestEs?.[0]?.updated_at || null 
      },
      fr: { 
        count: countFr || 0, 
        lastUpdate: latestFr?.[0]?.updated_at || null 
      },
      total: totalCount || 0
    });
  } catch (error: any) {
    console.error('[RadarStats] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
