import 'dotenv/config';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function testEdgeFunction() {
  const pos = [40.4168, -3.7038]; // Madrid
  console.log(`Checking Edge Function for Madrid [40.4, -3.7]`);
  
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/pegasus`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
        'apikey': ANON_KEY
      },
      body: JSON.stringify({
        lamin: pos[0] - 0.44,
        lomin: pos[1] - 0.44,
        lamax: pos[0] + 0.44,
        lomax: pos[1] + 0.44,
        ulat: pos[0],
        ulon: pos[1]
      })
    });

    if (!res.ok) {
      console.error(`Edge Function Error: ${res.status} ${await res.text()}`);
      return;
    }

    const data = await res.json();
    console.log(`\n--- RESULT ---`);
    console.log(`States count: ${data.states.length}`);
    console.log(`Total RAW in cache: ${data.totalRaw}`);
    console.log(`Bbox Key used: ${data.snappedBbox?.key}`);
    console.log(`Cached At: ${new Date(data.cachedAt).toLocaleString()}`);
    
    const suspects = data.states.filter(s => s.isSuspect);
    console.log(`Suspects count (detected by backend): ${suspects.length}`);
    
    if (suspects.length > 0) {
      console.log(`First suspect callsign: ${suspects[0].callsign}`);
    } else if (data.states.length > 0) {
      console.log(`No suspects found among ${data.states.length} planes.`);
      console.log(`Sample plane: ${data.states[0].callsign}, Alt: ${data.states[0].altitude}, Vel: ${data.states[0].velocity}`);
    } else {
      console.log('No aircraft returned at all.');
    }
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}

testEdgeFunction();
