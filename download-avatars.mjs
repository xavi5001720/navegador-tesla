import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AVATAR_DIR = path.join(__dirname, 'public', 'vip-avatars');

const USER_AGENT = 'NavegaProApp/1.0 (contact@navegapro.test) Node.js Fetch';

const FAMOUS_PEOPLE = [
  "Brad Pitt", "Lawrence Stroll", "Ian Malouf", "J.R. Ridinger", "Shahid Khan",
  "David Beckham", "Paul Allen", "James Dyson", "Steve Jobs", "Larry Page",
  "Oleg Burlakov", "Michael Schumacher", "Alexey Mordashov", "Elena Ambrosiadou",
  "Jeff Bezos", "Sergey Brin", "Tilman Fertitta", "Michael Jordan", "Tiger Woods",
  "Conor McGregor", "Giorgio Armani", "Bono (musician)", "Eric Clapton", "Sean Combs",
  "Johnny Depp", "Shakira", "Cristiano Ronaldo", "Lewis Hamilton", "Laurene Powell Jobs",
  "Eddie Murphy", "Roman Abramovich", "Andrey Melnichenko", "Alisher Usmanov",
  "David Geffen", "Nancy Walton Laurie", "Barry Diller", "Ernesto Bertarelli",
  "Jim Clark", "Aristotle Onassis", "Lukas Lundin", "Eduard Khudainatov",
  "Mohammed bin Salman", "Mikhail Prokhorov", "Mayra (yacht company)", "Palmer Johnson",
  "Perini Navi", "Elon Musk", "Bernard Arnault", "Bill Gates", "Warren Buffett"
];

// Fallback logic for some specific names
const NAME_MAPPING = {
  "Bono (u2)": "Bono",
  "Sean 'Diddy' Combs": "Sean_Combs",
  "Sean Combs": "Sean_Combs",
  "Nancy Walton": "Nancy_Walton_Laurie",
  "Aristóteles Onassis": "Aristotle_Onassis",
  "Mohammed bin Salman": "Mohammed_bin_Salman"
};

function normalizeFileName(name) {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

async function fetchWikiImage(name) {
  const wikiTitle = NAME_MAPPING[name] || name.replace(/ /g, '_');
  const apiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`;

  try {
    const response = await fetch(apiUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) return null;
    
    const data = await response.json();
    return data.thumbnail ? data.thumbnail.source : null;
  } catch (err) {
    return null;
  }
}

async function downloadImage(url, filename) {
  const dest = path.join(AVATAR_DIR, filename);
  try {
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) return false;
    
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(dest, buffer);
    console.log(`✅ ${filename} (${buffer.length} bytes)`);
    return true;
  } catch (err) {
    return false;
  }
}

async function run() {
  console.log('🚀 Automated VIP Avatar Sync starting...');
  if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });

  let count = 0;
  for (const name of FAMOUS_PEOPLE) {
    const imageUrl = await fetchWikiImage(name);
    if (imageUrl) {
      const filename = `${normalizeFileName(name)}.jpg`;
      const success = await downloadImage(imageUrl, filename);
      if (success) count++;
    } else {
      console.log(`⚠️ No image found for: ${name}`);
    }
    // Small delay to be respectful
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`✨ Finished! ${count} avatars synchronized locally.`);
}

run();
