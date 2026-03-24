import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SPAIN_BBOX = { lamin: 35.0, lomin: -10.0, lamax: 44.0, lomax: 5.0 };
const URL = `https://opensky-network.org/api/states/all?lamin=${SPAIN_BBOX.lamin}&lomin=${SPAIN_BBOX.lomin}&lamax=${SPAIN_BBOX.lamax}&lomax=${SPAIN_BBOX.lomax}`;

const credentialsMap: Record<number, { clientId: string, clientSecret: string }> = {
  2: { clientId: 'pepinperez-api-client', clientSecret: 'K922tGbRbq0DsrudGDVKQOJv3tYtnO6A' },
  3: { clientId: 'saracruzhortelana-api-client', clientSecret: 'o7FsNtYuca4K6xSHBCb3x4zKo3yiwBS1' }
};

let globalAccountIndex = 2; // Empezamos en Account 2: las IPs de Vercel están bloqueadas en anónima
let cachedAircrafts: any[] = [];
let lastFetchTime = 0;
const CACHE_DURATION = 57 * 1000; // 57s: casi el intervalo del cliente (60s), evita re-fetches dobles

async function getAccessToken(index: number) {
  const creds = credentialsMap[index];
  if (!creds) return null;
  
  try {
    const tRes = await fetch('https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      }),
      cache: 'no-store'
    });
    if (tRes.ok) {
      const data = await tRes.json();
      return data.access_token;
    }
  } catch (err) {
    console.error('Token fetch error:', err);
  }
  return null;
}

export async function GET() {
  const now = Date.now();
  if (now - lastFetchTime < CACHE_DURATION && cachedAircrafts.length > 0) {
    return NextResponse.json({ states: cachedAircrafts, account: globalAccountIndex, source: 'cache' });
  }

  let attemptCount = 0;
  
  while (globalAccountIndex <= 3 && attemptCount < 3) {
    attemptCount++;
    const token = await getAccessToken(globalAccountIndex);
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch(URL, { headers, cache: 'no-store' });
      
      if (res.status === 429) {
        console.warn(`[API] Account ${globalAccountIndex} rate limited (429).`);
        if (globalAccountIndex < 3) {
          globalAccountIndex++;
          continue;
        } else {
          // Todas agotadas, reset a cuenta 2 para próximas peticiones
          globalAccountIndex = 2;
          return NextResponse.json({ error: 'Rate limited', account: 3, states: cachedAircrafts }, { status: 429 });
        }
      }

      if (!res.ok) throw new Error(`Status ${res.status}`);

      const data = await res.json();
      if (data && data.states) {
        cachedAircrafts = data.states;
        lastFetchTime = now;
        return NextResponse.json({ states: cachedAircrafts, account: globalAccountIndex, source: 'fresh' });
      } else {
        // Obtenemos OK pero no hay states
        return NextResponse.json({ states: [], account: globalAccountIndex });
      }
    } catch (e) {
      console.error('API Fetch error:', e);
      break; // Si es error de red que no es 429, cortamos
    }
  }

  return NextResponse.json({ error: 'Failed', account: globalAccountIndex, states: cachedAircrafts }, { status: 500 });
}
