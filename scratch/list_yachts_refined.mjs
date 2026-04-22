import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listYachts() {
  const { data, error } = await supabase
    .from('luxury_yacht_list')
    .select('name, owner, mmsi')
    .order('name');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Total registros encontrados: ${data.length}`);
  
  const uniqueYachts = [];
  const seen = new Set();
  
  data.forEach(y => {
    const key = `${y.name}-${y.owner}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueYachts.push(y);
    }
  });

  console.log('--- LISTADO DE PROPIETARIOS DE YATES ---');
  uniqueYachts.forEach((y, i) => {
    console.log(`${i + 1}. ${y.name} [MMSI: ${y.mmsi}] - Propietario: ${y.owner}`);
  });
  console.log('--- FIN DEL LISTADO ---');
}

listYachts();
