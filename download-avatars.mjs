import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config({ path: '.env.local' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AVATAR_DIR = path.join(__dirname, 'public', 'vip-avatars');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function downloadImage(url, filename) {
  const dest = path.join(AVATAR_DIR, filename);
  
  // Skip if already exists
  if (fs.existsSync(dest)) return true;

  try {
    // Human-like delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site'
      }
    });
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(dest, buffer);
    console.log(`✅ Downloaded: ${filename}`);
    return true;
  } catch (err) {
    console.error(`❌ Error downloading ${url}:`, err.message);
    return false;
  }
}

function normalizeName(name) {
  return name.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9]/g, '-') // Replace non-alphanumeric with -
    .replace(/-+/g, '-') // Replace multiple - with single -
    .replace(/^-|-$/g, ''); // Trim -
}

async function run() {
  console.log('🚀 Starting VIP Avatar Download...');
  
  if (!fs.existsSync(AVATAR_DIR)) {
    fs.mkdirSync(AVATAR_DIR, { recursive: true });
  }

  const { data: yachts, error } = await supabase
    .from('luxury_yacht_list')
    .select('owner, owner_photo_url');

  if (error) {
    console.error('Error fetching yachts:', error);
    return;
  }

  const updates = [];

  for (const yacht of yachts) {
    if (!yacht.owner_photo_url || yacht.owner_photo_url.startsWith('/')) continue;

    const filename = `${normalizeName(yacht.owner)}.jpg`;
    const success = await downloadImage(yacht.owner_photo_url, filename);
    
    // Always map to local path in DB so user can drag & drop later
    updates.push({
      owner: yacht.owner,
      owner_photo_url: `/vip-avatars/${filename}`
    });
  }

  console.log(`\n🔄 Updating ${updates.length} records in database with local paths...`);
  
  for (const update of updates) {
    const { error: upError } = await supabase
      .from('luxury_yacht_list')
      .update({ owner_photo_url: update.owner_photo_url })
      .eq('owner', update.owner);
    
    if (upError) console.error(`Error updating ${update.owner}:`, upError);
  }

  console.log('✨ All done!');
}

run();
