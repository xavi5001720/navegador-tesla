import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENSKY_BASE = 'https://opensky-network.org/api';
const TOKEN_URL    = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
const SNAP_SIZE    = 0.5;
const CACHE_TTL_MS = 10_000;
const FETCH_TIMEOUT_MS = 12_000; // 12 segundos — si no responde, está bloqueado
const CACHE_STALE_MS = 180_000; // 3 minutos — si el feeder de casa está activo, esto es suficiente

const ACCOUNTS = [
  { id: 'luliloqui-api-client',         secret: 'YEXtTfBwCd5w2Kxhvp57W4C0s6f4Pb5n' },
  { id: 'pepinperez-api-client',         secret: 'K922tGbRbq0DsrudGDVKQOJv3tYtnO6A' },
  { id: 'saracruzhortelana-api-client',  secret: 'o7FsNtYuca4K6xSHBCb3x4zKo3yiwBS1' }
];

const COMMERCIAL_RE = /^(EAX|IBE|RYR|VLG|EZY|AFR|DLH|KLM|BAW)/i;
const AIRPORTS = [
  [40.4936, -3.5668], [41.2971, 2.0785], [37.4274, -5.8931],
  [36.6749, -4.4990], [39.5526, 2.7388], [28.4527, -13.8655],
  [27.9319, -15.3866],[28.0445, -16.5725],[28.4827, -16.3415],
  [38.8722,  1.3731], [43.3011, -8.3777], [43.3565, -5.8603],
  [43.3010, -1.7921], [43.3011, -3.8257], [39.4926, -0.4815],
  [38.1814, -1.0014], [38.2816, -0.5582], [36.7878, -2.3696],
];
const AIRPORT_RADIUS_M = 5_000;

// ── Helper: fetch con timeout ─────────────────────────────────────────────────
async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = FETCH_TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function snapDown(v: number): number { return Math.floor(v / SNAP_SIZE) * SNAP_SIZE; }
function snapUp  (v: number): number { return Math.ceil (v / SNAP_SIZE) * SNAP_SIZE; }

function snapBbox(lamin: number, lomin: number, lamax: number, lomax: number) {
  const sLamin = snapDown(lamin);
  const sLomin = snapDown(lomin);
  const sLamax = snapUp(lamax);
  const sLomax = snapUp(lomax);
  const key = `${sLamin.toFixed(1)}_${sLomin.toFixed(1)}_${sLamax.toFixed(1)}_${sLomax.toFixed(1)}`;
  return { lamin: sLamin, lomin: sLomin, lamax: sLamax, lomax: sLomax, key };
}

function haversine(p1: [number, number], p2: [number, number]): number {
  const R    = 6_371_000;
  const dLat = (p2[0] - p1[0]) * Math.PI / 180;
  const dLon = (p2[1] - p1[1]) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
    + Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isNearAirport(lat: number, lon: number): boolean {
  return AIRPORTS.some(ap => haversine([lat, lon], [ap[0], ap[1]]) < AIRPORT_RADIUS_M);
}

function enrichState(s: any, userLat?: number, userLon?: number) {
  const callsign     = (s[1] || '').trim();
  const isCommercial = COMMERCIAL_RE.test(callsign);
  const altitude     = s[7] ?? s[13] ?? 0;
  const velocity     = s[9] ?? 0;
  const lat = s[6], lon = s[5];
  const icao24       = s[0] || '';
  const onGround     = s[8] === true;

  if (onGround) return null;

  const hasWatchCallsign = /DGT|PESG|SAER|POLIC|GUARDIA|GC|POL/i.test(callsign);
  const isDGT            = icao24.startsWith('34');
  const isLow            = altitude < 1000;
  const isSlow           = velocity < 60;
  const nearAirport      = isNearAirport(lat, lon);

  const isSuspect = !isCommercial && (hasWatchCallsign || isDGT || ((isLow && isSlow) && !nearAirport));

  return {
    icao24,
    callsign       : callsign || 'N/A',
    origin_country : s[2] || '',
    lon, lat, altitude, velocity,
    track          : s[10] ?? 0,
    isSuspect,
    distanceToUser : (userLat != null && userLon != null)
      ? haversine([userLat, userLon], [lat, lon]) : null,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const body = await req.json();
    const { lamin, lomin, lamax, lomax, ulat, ulon } = body;

    if ([lamin, lomin, lamax, lomax].some((v: any) => v === undefined || isNaN(Number(v)))) {
      return new Response(JSON.stringify({ error: 'Missing bbox params' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const bbox = snapBbox(Number(lamin), Number(lomin), Number(lamax), Number(lomax));
    const now  = Date.now();

    // ── 1. Comprobar caché ───────────────────────────────────────────────────
    const { data: cached } = await supabase
      .from('opensky_cache')
      .select('states, rate_limited, account_index, ts')
      .eq('bbox_key', bbox.key)
      .single();

    let result = { states: [] as any[], rateLimited: true, accountIndex: -1, ts: now };

    // ── 0. Registrar Petición Dinámica (Independientemente de si hay caché) ─────
    // Esto informa al "Feeder" de casa sobre qué Bbox necesita el Tesla.
    try {
      await supabase.from('opensky_requests').upsert({
        bbox_key: bbox.key,
        last_requested_at: now,
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('[pegasus] ⚠️ Error registrando petición:', e);
    }

    if (cached?.ts && (now - cached.ts) < CACHE_STALE_MS) {
      result = {
        states: cached.states ?? [],
        rateLimited: cached.rate_limited ?? false,
        accountIndex: cached.account_index ?? -1,
        ts: cached.ts
      };
      console.log(`[pegasus] 🚀 Sirviendo desde caché (creado hace ${(now - cached.ts)/1000}s)`);
    } else {
      // ── 2. Obtener tokens de BD ────────────────────────────────────────────
      const { data: dbTokens } = await supabase
        .from('opensky_tokens')
        .select('account_id, cooldown_until, token, expires_at');

      let fetched = false;

      for (let i = 0; i < ACCOUNTS.length; i++) {
        const account = ACCOUNTS[i];
        const dbState = dbTokens?.find((t: any) => t.account_id === account.id);

        // Saltamos si está en cooldown
        if (dbState?.cooldown_until && dbState.cooldown_until > now) {
          console.log(`[pegasus] ⏳ Cuenta ${i+1} en cooldown`);
          continue;
        }

        // ── 3. Obtener/renovar token ────────────────────────────────────────
        let token = dbState?.token;
        if (!token || !dbState?.expires_at || dbState.expires_at < now) {
          try {
            const tokenRes = await fetchWithTimeout(TOKEN_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: account.id,
                client_secret: account.secret,
              }),
            }, 10_000);

            if (tokenRes.ok) {
              const d = await tokenRes.json();
              token = d.access_token;
              await supabase.from('opensky_tokens').upsert({
                account_id: account.id, token,
                expires_at: now + ((d.expires_in ?? 1800) * 1000) - 300_000,
                updated_at: new Date().toISOString()
              });
              console.log(`[pegasus] ✅ Token cuenta ${i+1} renovado`);
            }
          } catch (e) {
            console.error(`[pegasus] ❌ Token timeout cuenta ${i+1}:`, e);
            continue;
          }
        }

        // ── 4. Petición a OpenSky con timeout ──────────────────────────────
        const url = `${OPENSKY_BASE}/states/all?lamin=${bbox.lamin}&lomin=${bbox.lomin}&lamax=${bbox.lamax}&lomax=${bbox.lomax}`;
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        try {
          console.log(`[pegasus] → OpenSky cuenta ${i+1}, bbox=${bbox.key}`);
          const res = await fetchWithTimeout(url, { headers }, FETCH_TIMEOUT_MS);

          if (!res.ok) {
            const retrySecs = res.status === 429
              ? parseInt(res.headers.get('X-Rate-Limit-Retry-After-Seconds') ?? '60') : 60;
            console.warn(`[pegasus] ⚠️ HTTP ${res.status} cuenta ${i+1}. Cooldown ${retrySecs}s`);
            await supabase.from('opensky_tokens').upsert({
              account_id: account.id,
              cooldown_until: now + (retrySecs * 1000),
              updated_at: new Date().toISOString()
            });
            continue;
          }

          const data = await res.json();
          result = { states: data?.states ?? [], rateLimited: false, accountIndex: i + 1, ts: Date.now() };

          await supabase.from('opensky_cache').upsert({
            bbox_key: bbox.key,
            states: result.states,
            rate_limited: false,
            account_index: result.accountIndex,
            ts: result.ts,
            updated_at: new Date().toISOString()
          });

          fetched = true;
          console.log(`[pegasus] ✅ ${result.states.length} aeronaves (cuenta ${i+1})`);
          break;

        } catch (e) {
          // Timeout o error de red — marcar cooldown temporal
          console.error(`[pegasus] ⏱️ Timeout OpenSky cuenta ${i+1}:`, e);
          await supabase.from('opensky_tokens').upsert({
            account_id: account.id,
            cooldown_until: now + 60_000,
            updated_at: new Date().toISOString()
          });
          continue;
        }
      }

      if (!fetched) {
        // Guardamos el estado de rate-limited en caché para no spamear
        await supabase.from('opensky_cache').upsert({
          bbox_key: bbox.key, states: [], rate_limited: true,
          account_index: -1, ts: result.ts,
          updated_at: new Date().toISOString()
        });
      }
    }

    const withPos  = result.states.filter((s: any) => s[6] != null && s[5] != null);
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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[pegasus] Error general:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
