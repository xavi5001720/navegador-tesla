import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENSKY_BASE = 'https://opensky-network.org/api';
const TOKEN_URL    = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
const SNAP_SIZE = 0.5; // grados
const CACHE_TTL_MS = 10_000;

const ACCOUNTS = [
  { id: 'luliloqui-api-client', secret: 'YEXtTfBwCd5w2Kxhvp57W4C0s6f4Pb5n' },
  { id: 'pepinperez-api-client', secret: 'K922tGbRbq0DsrudGDVKQOJv3tYtnO6A' },
  { id: 'saracruzhortelana-api-client', secret: 'o7FsNtYuca4K6xSHBCb3x4zKo3yiwBS1' }
];

const COMMERCIAL_RE = /^(EAX|IBE|RYR|VLG|EZY|AFR|DLH|KLM|BAW)/i;
const AIRPORTS = [
  [40.4936, -3.5668], [41.2971, 2.0785], [37.4274, -5.8931],
  [36.6749, -4.4990], [39.5526, 2.7388], [28.4527, -13.8655],
  [27.9319, -15.3866], [28.0445, -16.5725], [28.4827, -16.3415],
  [38.8722, 1.3731],  [43.3011, -8.3777], [43.3565, -5.8603],
  [43.3010, -1.7921], [43.3011, -3.8257], [39.4926, -0.4815],
  [38.1814, -1.0014], [38.2816, -0.5582], [36.7878, -2.3696],
];
const AIRPORT_RADIUS_M = 5_000;

function snapDown(v: number): number { return Math.floor(v / SNAP_SIZE) * SNAP_SIZE; }
function snapUp  (v: number): number { return Math.ceil (v / SNAP_SIZE) * SNAP_SIZE; }

function snapBbox(lamin: number, lomin: number, lamax: number, lomax: number) {
  const sLamin = snapDown(lamin);
  const sLomin = snapDown(lomin);
  const sLamax = snapUp(lamax);
  const sLomax = snapUp(lomax);
  const key   = `${sLamin.toFixed(1)}_${sLomin.toFixed(1)}_${sLamax.toFixed(1)}_${sLomax.toFixed(1)}`;
  const sqDeg = (sLamax - sLamin) * (sLomax - sLomin);
  return { lamin: sLamin, lomin: sLomin, lamax: sLamax, lomax: sLomax, key, sqDeg };
}

function haversine(p1: [number, number], p2: [number, number]): number {
  const R    = 6_371_000;
  const dLat = (p2[0] - p1[0]) * Math.PI / 180;
  const dLon = (p2[1] - p1[1]) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2 + Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isNearAirport(lat: number, lon: number): boolean {
  return AIRPORTS.some(ap => haversine([lat, lon], [ap[0], ap[1]]) < AIRPORT_RADIUS_M);
}

function enrichState(s: any, userLat?: number, userLon?: number) {
  const callsign    = (s[1] || '').trim();
  const isCommercial = COMMERCIAL_RE.test(callsign);
  const altitude    = s[7] ?? s[13] ?? 0;
  const velocity    = s[9] ?? 0;
  const lat         = s[6], lon = s[5];
  const icao24      = s[0] || '';

  const hasWatchCallsign = /DGT|PESG|SAER|POLIC|GUARDIA|GC|POL/i.test(callsign);
  const isDGT            = icao24.startsWith('34');
  const isLow            = altitude < 1000;
  const isSlow           = velocity < 60;
  const nearAirport      = isNearAirport(lat, lon);
  const onGround         = s[8] === true;

  if (onGround) return null;

  const isSuspect = !isCommercial && (hasWatchCallsign || isDGT || ((isLow && isSlow) && !nearAirport));

  return {
    icao24,
    callsign       : callsign || 'N/A',
    origin_country : s[2] || '',
    lon, lat,
    altitude,
    velocity,
    track          : s[10] ?? 0,
    on_ground      : onGround,
    isSuspect,
    distanceToUser : (userLat != null && userLon != null) ? haversine([userLat, userLon], [lat, lon]) : null,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { lamin, lomin, lamax, lomax, ulat, ulon } = await req.json();

    if ([lamin, lomin, lamax, lomax].some((v: any) => v === undefined || isNaN(v))) {
      return new Response(JSON.stringify({ error: 'Missing lamin, lomin, lamax, lomax' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const bbox = snapBbox(lamin, lomin, lamax, lomax);
    const now = Date.now();

    const { data: existing } = await supabase
      .from('opensky_cache')
      .select('states, rate_limited, account_index, ts')
      .eq('bbox_key', bbox.key)
      .single();

    let result = { states: [], rateLimited: true, accountIndex: -1, ts: Date.now() };

    if (existing && existing.ts && (now - existing.ts) < CACHE_TTL_MS) {
      result = {
        states: existing.states ?? [],
        rateLimited: existing.rate_limited ?? false,
        accountIndex: existing.account_index ?? -1,
        ts: existing.ts
      };
    } else {
      let fetched = false;
      const { data: dbTokens } = await supabase
        .from('opensky_tokens')
        .select('account_id, cooldown_until, token, expires_at');

      for (let i = 0; i < ACCOUNTS.length; i++) {
        const account = ACCOUNTS[i];
        const accountState = dbTokens?.find((t: any) => t.account_id === account.id);

        if (accountState?.cooldown_until && accountState.cooldown_until > now) {
          continue;
        }

        let token = accountState?.token;
        if (!token || !accountState?.expires_at || accountState.expires_at < now) {
          const res = await fetch(TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'client_credentials',
              client_id: account.id,
              client_secret: account.secret,
            }),
          });
          if (res.ok) {
            const d = await res.json();
            token = d.access_token;
            await supabase.from('opensky_tokens').upsert({
              account_id: account.id,
              token: token,
              expires_at: now + ((d.expires_in ?? 1800) * 1000) - 300000,
              updated_at: new Date().toISOString()
            });
          }
        }

        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const url = `${OPENSKY_BASE}/states/all?lamin=${bbox.lamin}&lomin=${bbox.lomin}&lamax=${bbox.lamax}&lomax=${bbox.lomax}`;
        const res = await fetch(url, { headers });

        if (!res.ok) {
          let retrySecs = 60;
          if (res.status === 429) {
            retrySecs = parseInt(res.headers.get('X-Rate-Limit-Retry-After-Seconds') ?? '60');
          }
          await supabase.from('opensky_tokens').upsert({
            account_id: account.id,
            cooldown_until: Date.now() + (retrySecs * 1000),
            updated_at: new Date().toISOString()
          });
          continue;
        }

        const data = await res.json();
        result = { states: data?.states ?? [], rateLimited: false, accountIndex: i + 1, ts: Date.now() };
        
        await supabase.from('opensky_cache').upsert({
          bbox_key: bbox.key,
          states: result.states,
          rate_limited: result.rateLimited,
          account_index: result.accountIndex,
          ts: result.ts,
          updated_at: new Date().toISOString()
        });
        
        fetched = true;
        break;
      }
      
      if (!fetched) {
        await supabase.from('opensky_cache').upsert({
          bbox_key: bbox.key,
          states: [],
          rate_limited: true,
          account_index: -1,
          ts: result.ts,
          updated_at: new Date().toISOString()
        });
      }
    }

    const withPos = result.states.filter((s: any) => s[6] != null && s[5] != null);
    const enriched = withPos.map((s: any) => enrichState(s, ulat, ulon)).filter(Boolean);

    return new Response(
      JSON.stringify({
        states: enriched,
        totalRaw: result.states.length,
        rateLimited: result.rateLimited,
        accountIndex: result.accountIndex,
        cachedAt: result.ts,
        snappedBbox: bbox
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
