import { NextResponse } from 'next/server';

let cachedAircrafts: any[] = [];
let lastFetchTime = 0;
let accessToken: string | null = null;
let tokenExpiry = 0;

const CACHE_DURATION = 300 * 1000; // 5 minutos para los aviones

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
  if (accessToken && now < tokenExpiry) {
    return accessToken;
  }

  try {
    const response = await fetch('https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: CREDENTIALS.clientId,
        client_secret: CREDENTIALS.clientSecret
      })
    });

    if (!response.ok) throw new Error('Token fetch failed');
    const data = await response.json();
    
    accessToken = data.access_token;
    tokenExpiry = now + (data.expires_in - 60) * 1000; // Un minuto de margen
    return accessToken;
  } catch (error) {
    console.error('Error getting OpenSky token:', error);
    return null;
  }
}

export async function GET() {
  const now = Date.now();

  if (now - lastFetchTime < CACHE_DURATION && cachedAircrafts.length > 0) {
    return NextResponse.json({ aircrafts: cachedAircrafts, source: 'cache' });
  }

  try {
    const token = await getAccessToken();
    const url = `https://opensky-network.org/api/states/all?lamin=${SPAIN_BBOX.lamin}&lomin=${SPAIN_BBOX.lomin}&lamax=${SPAIN_BBOX.lamax}&lomax=${SPAIN_BBOX.lomax}`;
    
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 429) {
        return NextResponse.json({ 
          aircrafts: cachedAircrafts, 
          error: 'Rate limited', 
          source: 'cache_fallback' 
        }, { status: 200 });
      }
      throw new Error(`OpenSky Error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.states) {
      cachedAircrafts = data.states.map((s: any) => ({
        icao24: s[0],
        callsign: s[1]?.trim() || 'N/A',
        origin_country: s[2],
        longitude: s[5],
        latitude: s[6],
        altitude: s[7] || s[13],
        velocity: s[9],
        track: s[10] || 0,
        timestamp: s[3]
      }));
      lastFetchTime = now;
    }

    return NextResponse.json({ aircrafts: cachedAircrafts, source: 'fresh' });
  } catch (error) {
    console.error('Error fetching aircrafts:', error);
    return NextResponse.json({ 
      aircrafts: cachedAircrafts, 
      error: 'Fetch failed', 
      source: 'cache_fallback' 
    }, { status: 200 });
  }
}
