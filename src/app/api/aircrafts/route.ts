import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

let cachedAircrafts: any[] = [];
let lastFetchTime = 0;

const CACHE_DURATION = 30 * 1000; // 30 segundos

// Bounding box de la Península Ibérica / España
const SPAIN_BBOX = {
  lamin: 35.0,
  lomin: -10.0,
  lamax: 44.0,
  lomax: 5.0
};

async function fetchOpenSkyData() {
  const url = `https://opensky-network.org/api/states/all?lamin=${SPAIN_BBOX.lamin}&lomin=${SPAIN_BBOX.lomin}&lamax=${SPAIN_BBOX.lamax}&lomax=${SPAIN_BBOX.lomax}`;
  
  try {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) {
        if (res.status === 429) {
            console.warn('[API] OpenSky Rate Limited');
            return { error: 'Rate limited' };
        }
        throw new Error(`Status ${res.status}`);
    }
    return await res.json();
  } catch (e) {
    console.error('[API] Fetch failed:', e);
    return null;
  }
}

export async function GET(request: Request) {
  const now = Date.now();

  // Servir caché si existe y es reciente
  if (now - lastFetchTime < CACHE_DURATION && cachedAircrafts.length > 0) {
    return NextResponse.json({ aircrafts: cachedAircrafts, source: 'cache' });
  }

  const data = await fetchOpenSkyData();
  
  if (data?.error === 'Rate limited') {
     return NextResponse.json({ error: 'Rate limited', aircrafts: cachedAircrafts, source: 'cache_fallback' });
  }

  if (data?.states) {
    cachedAircrafts = data.states.map((s: any) => ({
      icao24: s[0],
      callsign: s[1]?.trim() || 'N/A',
      origin_country: s[2],
      longitude: s[5],
      latitude: s[6],
      altitude: s[7] || s[13] || 0,
      velocity: s[9] || 0,
      track: s[10] || 0,
      timestamp: s[3]
    }));
    lastFetchTime = now;
    console.log(`[API] Success: ${cachedAircrafts.length} aircraft found.`);
  } else {
    console.error('[API] Failed to fetch fresh data, returning cache if available.');
  }

  return NextResponse.json({ 
    aircrafts: cachedAircrafts, 
    source: data ? 'fresh' : 'cache_fallback' 
  });
}
