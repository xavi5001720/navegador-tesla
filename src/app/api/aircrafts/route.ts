import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

let cachedAircrafts: any[] = [];
let lastFetchTime = 0;
let accessToken: string | null = null;
let tokenExpiry = 0;

const CACHE_DURATION = 30 * 1000; // 30 segundos (más frecuente para debug)

const SPAIN_BBOX = {
  lamin: 27.0,
  lomin: -19.0,
  lamax: 44.5,
  lomax: 5.0
};

const CREDENTIALS = {
  clientId: "xavitesla-api-client",
  clientSecret: "fkroLGLvJYxBpQJZCmufMVyIFuu8PrWh"
};

async function getAccessToken() {
  const now = Date.now();
  if (accessToken && now < tokenExpiry) return accessToken;

  try {
    const response = await fetch('https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: CREDENTIALS.clientId,
        client_secret: CREDENTIALS.clientSecret
      })
    });
    if (!response.ok) return null;
    const data = await response.json();
    accessToken = data.access_token;
    tokenExpiry = now + (data.expires_in - 60) * 1000;
    return accessToken;
  } catch (e) {
    return null;
  }
}

async function fetchOpenSkyData() {
  const url = `https://opensky-network.org/api/states/all?lamin=${SPAIN_BBOX.lamin}&lomin=${SPAIN_BBOX.lomin}&lamax=${SPAIN_BBOX.lamax}&lomax=${SPAIN_BBOX.lomax}`;
  const token = await getAccessToken();
  
  const attemptFetch = async (useToken: boolean) => {
    const headers: any = {};
    if (useToken && token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, { headers, next: { revalidate: 0 } });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    return res.json();
  };

  try {
    // Intento 1: Con token (si existe)
    return await attemptFetch(true);
  } catch (e) {
    console.warn('[API] Auth fetch failed, trying anonymous...');
    // Intento 2: Anónimo
    try {
      return await attemptFetch(false);
    } catch (e2) {
      console.error('[API] Both fetch attempts failed');
      return null;
    }
  }
}

export async function GET(request: Request) {
  const now = Date.now();

  // Si tenemos caché reciente, la servimos
  if (now - lastFetchTime < CACHE_DURATION && cachedAircrafts.length > 0) {
    return NextResponse.json({ aircrafts: cachedAircrafts, source: 'cache' });
  }

  const data = await fetchOpenSkyData();
  
  if (data && data.states) {
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
