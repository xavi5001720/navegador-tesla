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
    // 1. Obtener conteo total y última actualización global (rápido)
    const { count: totalCount } = await supabase.from('radars').select('*', { count: 'exact', head: true });
    
    // 2. Obtener última actualización en España (aproximado por bounding box)
    const { data: latestEs } = await supabase
      .from('radars')
      .select('updated_at')
      .filter('lat', 'gte', 27)
      .filter('lat', 'lte', 44)
      .filter('lon', 'gte', -19)
      .filter('lon', 'lte', 5)
      .order('updated_at', { ascending: false })
      .limit(1);

    // 3. Obtener conteo España
    const { count: countEs } = await supabase
      .from('radars')
      .select('*', { count: 'exact', head: true })
      .filter('lat', 'gte', 27)
      .filter('lat', 'lte', 44)
      .filter('lon', 'gte', -19)
      .filter('lon', 'lte', 5);

    // 4. Última actualización Francia (aproximado)
    const { data: latestFr } = await supabase
      .from('radars')
      .select('updated_at')
      .filter('lat', 'gt', 44)
      .filter('lat', 'lte', 52)
      .filter('lon', 'gte', -5)
      .filter('lon', 'lte', 10)
      .order('updated_at', { ascending: false })
      .limit(1);
    
    // 5. Conteo Francia
    const { count: countFr } = await supabase
      .from('radars')
      .select('*', { count: 'exact', head: true })
      .filter('lat', 'gt', 44)
      .filter('lat', 'lte', 52)
      .filter('lon', 'gte', -5)
      .filter('lon', 'lte', 10);

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
