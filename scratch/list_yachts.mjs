import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase env variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listYachts() {
  const { data, error } = await supabase
    .from('luxury_yacht_list')
    .select('name, owner')
    .order('name');

  if (error) {
    console.error('Error fetching yachts:', error);
    return;
  }

  if (data) {
    console.log('--- LISTADO DE PROPIETARIOS DE YATES ---');
    data.forEach((y, i) => {
      console.log(`${i + 1}. ${y.name} - Propietario: ${y.owner}`);
    });
    console.log('--- FIN DEL LISTADO ---');
  }
}

listYachts();
