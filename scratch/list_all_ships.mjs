import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const TESLA_SHIPS = [
  { name: 'Tesla Vessel A', owner: 'Tesla Logistics' },
  { name: 'Tesla Vessel B', owner: 'Tesla Logistics' },
  { name: 'Tesla Vessel C', owner: 'Tesla Logistics' },
  { name: 'Tesla Vessel D', owner: 'Tesla Logistics' },
  { name: 'Tesla Vessel E', owner: 'Tesla Logistics' },
  { name: 'Tesla Vessel F', owner: 'Tesla Logistics' },
  { name: 'Tesla Vessel G', owner: 'Tesla Logistics' }
];

async function listAllShips() {
  const { data: luxuryYachts, error } = await supabase
    .from('luxury_yacht_list')
    .select('name, owner')
    .order('name');

  if (error) {
    console.error('Error:', error);
    return;
  }

  // Combine and deduplicate luxury yachts (some might be repeats in DB due to sync logic)
  const uniqueLuxury = [];
  const seen = new Set();
  luxuryYachts.forEach(y => {
    const key = `${y.name}-${y.owner}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueLuxury.push(y);
    }
  });

  const allShips = [...uniqueLuxury, ...TESLA_SHIPS];

  console.log(`--- FLOTA COMPLETA MONITORIZADA (Total: ${allShips.length} barcos) ---`);
  allShips.forEach((s, i) => {
    console.log(`${i + 1}. ${s.name} - Propietario: ${s.owner}`);
  });
  console.log('--- FIN DEL LISTADO ---');
}

listAllShips();
