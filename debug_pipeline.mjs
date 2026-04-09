// debug_pipeline.mjs — Inspección completa del pipeline de aviones

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

function haversine(p1, p2) {
  const R = 6_371_000;
  const dLat = (p2[0] - p1[0]) * Math.PI / 180;
  const dLon = (p2[1] - p1[1]) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(p1[0]*Math.PI/180)*Math.cos(p2[0]*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function isNearAirport(lat, lon) {
  return AIRPORTS.some(ap => haversine([lat, lon], [ap[0], ap[1]]) < AIRPORT_RADIUS_M);
}

// Simulamos la posición de Xavi (Barcelona aproximado, ajustar si es diferente)
const USER_LAT = 41.38;
const USER_LON = 2.17;

async function main() {
  console.log('\n══════════════════════════════════════════════');
  console.log('🔍 PASO 1: Leer caché en Supabase');
  console.log('══════════════════════════════════════════════');

  const res = await fetch(
    SUPABASE_URL + '/rest/v1/opensky_cache?select=bbox_key,ts,states&bbox_key=eq.40.0_0.0_44.0_4.0',
    { headers: { 'apikey': ANON_KEY, 'Authorization': 'Bearer ' + ANON_KEY } }
  );
  const rows = await res.json();
  if (!rows.length) { console.log('❌ SIN DATOS en opensky_cache!'); return; }

  const row = rows[0];
  const ageMs = Date.now() - row.ts;
  const states = row.states || [];
  console.log(`✅ bbox_key: ${row.bbox_key}`);
  console.log(`✅ Edad caché: ${Math.round(ageMs/1000)}s`);
  console.log(`✅ Nº de aviones en caché: ${states.length}`);

  console.log('\n══════════════════════════════════════════════');
  console.log('🔍 PASO 2: Aplicar lógica enrichState (simula Edge Function)');
  console.log('══════════════════════════════════════════════');

  let onGround = 0, noPos = 0;
  const enriched = [];

  for (const s of states) {
    const lat = s[6], lon = s[5];
    const onGnd = s[8] === true;
    if (lat == null || lon == null) { noPos++; continue; }
    if (onGnd) { onGround++; continue; }

    const callsign = (s[1] || '').trim();
    const isCommercial = COMMERCIAL_RE.test(callsign);
    const altitude = s[7] ?? s[13] ?? 0;
    const velocity = s[9] ?? 0;
    const icao24 = s[0] || '';

    const hasWatchCallsign = /DGT|PESG|SAER|POLIC|GUARDIA|GC|POL/i.test(callsign);
    const isDGT = icao24.startsWith('34');
    const isLow = altitude < 1000;
    const isSlow = velocity < 60;
    const nearApt = isNearAirport(lat, lon);
    const aircraft_isSuspect = !isCommercial && (hasWatchCallsign || isDGT || ((isLow && isSlow) && !nearApt));
    const distanceToUser = haversine([USER_LAT, USER_LON], [lat, lon]);

    enriched.push({
      icao24, callsign: callsign || 'N/A',
      lat, lon, altitude, velocity,
      track: s[10] ?? 0,
      isSuspect: aircraft_isSuspect,
      distanceToUser,
      isCommercial, isLow, isSlow, nearApt
    });
  }

  console.log(`Filtrados en tierra: ${onGround}`);
  console.log(`Sin posición: ${noPos}`);
  console.log(`Enriquecidos (en vuelo): ${enriched.length}`);

  console.log('\n══════════════════════════════════════════════');
  console.log('🔍 PASO 3: Filtro local de usePegasus (isSuspect, altitude, velocity)');
  console.log('══════════════════════════════════════════════');

  const suspects = enriched.filter(a => a.isSuspect);
  console.log(`isSuspect = true: ${suspects.length}`);

  const afterAltFilter = suspects.filter(a => a.altitude >= 100 && a.altitude <= 2_000);
  console.log(`isSuspect + 100m<alt<2000m: ${afterAltFilter.length}`);

  const afterVelFilter = afterAltFilter.filter(a => a.velocity <= 83.33);
  console.log(`isSuspect + alt OK + vel<300km/h: ${afterVelFilter.length}`);

  console.log('\n══════════════════════════════════════════════');
  console.log('📊 RESULTADO FINAL (lo que llegaría al mapa):');
  console.log('══════════════════════════════════════════════');
  console.log(JSON.stringify(afterVelFilter, null, 2));

  console.log('\n══════════════════════════════════════════════');
  console.log('📊 MUESTRA DE AVIONES "NO SOSPECHOSOS" (los que se descartan):');
  console.log('══════════════════════════════════════════════');
  const notSuspect = enriched.filter(a => !a.isSuspect).slice(0, 5);
  console.log(JSON.stringify(notSuspect.map(a => ({
    icao24: a.icao24, callsign: a.callsign, alt: Math.round(a.altitude), 
    vel: Math.round(a.velocity), isCommercial: a.isCommercial, 
    isLow: a.isLow, isSlow: a.isSlow, nearApt: a.nearApt,
    dist: Math.round(a.distanceToUser/1000) + 'km'
  })), null, 2));
}

main().catch(console.error);
