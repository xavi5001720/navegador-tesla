import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const revalidate = 0;
export const maxDuration = 60; // Hasta 60s en Vercel
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase credentials' }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { count } = await supabase.from('gas_stations').select('*', { count: 'exact', head: true });
    
    // Get latest updated_at
    const { data: latest } = await supabase
      .from('gas_stations')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1);

    const lastUpdate = latest?.[0]?.updated_at ? new Date(latest[0].updated_at).toISOString() : null;

    return NextResponse.json({
      es: {
        count: count || 0,
        lastUpdate
      },
      total: count || 0
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
