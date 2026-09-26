import { NextRequest, NextResponse } from 'next/server';

const TOKEN = process.env.TRAVELPAYOUTS_TOKEN || '596d62e5f9f6d2f1574865feeb424c75';
const MARKER = process.env.TRAVELPAYOUTS_MARKER || '778425';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DESTINATIONS_FALLBACK = [
  { code: 'MIL', city: 'Milán', country: 'Italia', priceBase: 29 },
  { code: 'OPO', city: 'Oporto', country: 'Portugal', priceBase: 22 },
  { code: 'LIS', city: 'Lisboa', country: 'Portugal', priceBase: 27 },
  { code: 'PAR', city: 'París', country: 'Francia', priceBase: 35 },
  { code: 'ROM', city: 'Roma', country: 'Italia', priceBase: 38 },
  { code: 'BER', city: 'Berlín', country: 'Alemania', priceBase: 45 },
  { code: 'AMS', city: 'Ámsterdam', country: 'Países Bajos', priceBase: 52 },
  { code: 'PRG', city: 'Praga', country: 'Rep. Checa', priceBase: 48 },
  { code: 'VIE', city: 'Viena', country: 'Austria', priceBase: 55 },
  { code: 'BUD', city: 'Budapest', country: 'Hungría', priceBase: 42 },
  { code: 'LON', city: 'Londres', country: 'Reino Unido', priceBase: 59 },
  { code: 'PMI', city: 'Mallorca', country: 'España', priceBase: 32 },
  { code: 'TFN', city: 'Tenerife', country: 'España', priceBase: 65 },
  { code: 'RAK', city: 'Marrakech', country: 'Marruecos', priceBase: 45 },
];

const CITY_MAP: Record<string, { city: string; country: string }> = {
  MAD: { city: 'Madrid', country: 'España' },
  BCN: { city: 'Barcelona', country: 'España' },
  VLC: { city: 'Valencia', country: 'España' },
  AGP: { city: 'Málaga', country: 'España' },
  SVQ: { city: 'Sevilla', country: 'España' },
  BIO: { city: 'Bilbao', country: 'España' },
  ALC: { city: 'Alicante', country: 'España' },
  SCQ: { city: 'Santiago de Compostela', country: 'España' },
  PMI: { city: 'Palma de Mallorca', country: 'España' },
  IBZ: { city: 'Ibiza', country: 'España' },
  MAH: { city: 'Menorca', country: 'España' },
  TFN: { city: 'Tenerife Norte', country: 'España' },
  TFS: { city: 'Tenerife Sur', country: 'España' },
  LPA: { city: 'Gran Canaria', country: 'España' },
  ACE: { city: 'Lanzarote', country: 'España' },
  FUE: { city: 'Fuerteventura', country: 'España' },
  SPC: { city: 'La Palma', country: 'España' },
  SDR: { city: 'Santander', country: 'España' },
  VGO: { city: 'Vigo', country: 'España' },
  OVD: { city: 'Asturias', country: 'España' },
  ZAZ: { city: 'Zaragoza', country: 'España' },
  GRX: { city: 'Granada', country: 'España' },
  MJV: { city: 'Murcia', country: 'España' },
  XRY: { city: 'Jerez de la Frontera', country: 'España' },
  REU: { city: 'Reus', country: 'España' },
  GRO: { city: 'Girona', country: 'España' },
  LIS: { city: 'Lisboa', country: 'Portugal' },
  OPO: { city: 'Oporto', country: 'Portugal' },
  FAO: { city: 'Faro (Algarve)', country: 'Portugal' },
  FNC: { city: 'Funchal (Madeira)', country: 'Portugal' },
  PAR: { city: 'París', country: 'Francia' },
  CDG: { city: 'París', country: 'Francia' },
  ORY: { city: 'París (Orly)', country: 'Francia' },
  NCE: { city: 'Niza', country: 'Francia' },
  LYS: { city: 'Lyon', country: 'Francia' },
  MRS: { city: 'Marsella', country: 'Francia' },
  BOD: { city: 'Burdeos', country: 'Francia' },
  TLS: { city: 'Toulouse', country: 'Francia' },
  NTE: { city: 'Nantes', country: 'Francia' },
  MPL: { city: 'Montpellier', country: 'Francia' },
  BIQ: { city: 'Biarritz', country: 'Francia' },
  MIL: { city: 'Milán', country: 'Italia' },
  MXP: { city: 'Milán', country: 'Italia' },
  LIN: { city: 'Milán', country: 'Italia' },
  BGY: { city: 'Milán (Bérgamo)', country: 'Italia' },
  ROM: { city: 'Roma', country: 'Italia' },
  FCO: { city: 'Roma', country: 'Italia' },
  NAP: { city: 'Nápoles', country: 'Italia' },
  VCE: { city: 'Venecia', country: 'Italia' },
  FLR: { city: 'Florencia', country: 'Italia' },
  BLQ: { city: 'Bolonia', country: 'Italia' },
  TRN: { city: 'Turín', country: 'Italia' },
  BRI: { city: 'Bari', country: 'Italia' },
  PMO: { city: 'Palermo', country: 'Italia' },
  CTA: { city: 'Catania', country: 'Italia' },
  OLB: { city: 'Olbia (Cerdeña)', country: 'Italia' },
  CAG: { city: 'Cagliari (Cerdeña)', country: 'Italia' },
  LON: { city: 'Londres', country: 'Reino Unido' },
  LHR: { city: 'Londres (Heathrow)', country: 'Reino Unido' },
  LGW: { city: 'Londres (Gatwick)', country: 'Reino Unido' },
  STN: { city: 'Londres (Stansted)', country: 'Reino Unido' },
  LTN: { city: 'Londres (Luton)', country: 'Reino Unido' },
  EDI: { city: 'Edimburgo', country: 'Reino Unido' },
  MAN: { city: 'Mánchester', country: 'Reino Unido' },
  BRS: { city: 'Bristol', country: 'Reino Unido' },
  BHX: { city: 'Birmingham', country: 'Reino Unido' },
  GLA: { city: 'Glasgow', country: 'Reino Unido' },
  DUB: { city: 'Dublín', country: 'Irlanda' },
  BFS: { city: 'Belfast', country: 'Reino Unido' },
  BER: { city: 'Berlín', country: 'Alemania' },
  MUC: { city: 'Múnich', country: 'Alemania' },
  FRA: { city: 'Fráncfort', country: 'Alemania' },
  DUS: { city: 'Düsseldorf', country: 'Alemania' },
  HAM: { city: 'Hamburgo', country: 'Alemania' },
  CGN: { city: 'Colonia', country: 'Alemania' },
  STR: { city: 'Stuttgart', country: 'Alemania' },
  NUE: { city: 'Núremberg', country: 'Alemania' },
  AMS: { city: 'Ámsterdam', country: 'Países Bajos' },
  EIN: { city: 'Eindhoven', country: 'Países Bajos' },
  BRU: { city: 'Bruselas', country: 'Bélgica' },
  CRL: { city: 'Bruselas Charleroi', country: 'Bélgica' },
  VIE: { city: 'Viena', country: 'Austria' },
  SZG: { city: 'Salzburgo', country: 'Austria' },
  INN: { city: 'Innsbruck', country: 'Austria' },
  ZRH: { city: 'Zúrich', country: 'Suiza' },
  GVA: { city: 'Ginebra', country: 'Suiza' },
  BSL: { city: 'Basilea', country: 'Suiza' },
  PRG: { city: 'Praga', country: 'Rep. Checa' },
  BUD: { city: 'Budapest', country: 'Hungría' },
  WAW: { city: 'Varsovia', country: 'Polonia' },
  KRK: { city: 'Cracovia', country: 'Polonia' },
  WRO: { city: 'Wroclaw', country: 'Polonia' },
  GDN: { city: 'Gdansk', country: 'Polonia' },
  OSL: { city: 'Oslo', country: 'Noruega' },
  BGO: { city: 'Bergen', country: 'Noruega' },
  STO: { city: 'Estocolmo', country: 'Suecia' },
  ARN: { city: 'Estocolmo', country: 'Suecia' },
  GOT: { city: 'Gotemburgo', country: 'Suecia' },
  CPH: { city: 'Copenhague', country: 'Dinamarca' },
  HEL: { city: 'Helsinki', country: 'Finlandia' },
  REK: { city: 'Reikiavik', country: 'Islandia' },
  RIX: { city: 'Riga', country: 'Letonia' },
  TLL: { city: 'Tallin', country: 'Estonia' },
  VNO: { city: 'Vilna', country: 'Lituania' },
  ATH: { city: 'Atenas', country: 'Grecia' },
  SKG: { city: 'Salónica', country: 'Grecia' },
  HER: { city: 'Heraclión (Creta)', country: 'Grecia' },
  CHQ: { city: 'Chania (Creta)', country: 'Grecia' },
  RHO: { city: 'Rodas', country: 'Grecia' },
  JTR: { city: 'Santorini', country: 'Grecia' },
  JMK: { city: 'Mikonos', country: 'Grecia' },
  CFU: { city: 'Corfú', country: 'Grecia' },
  KGS: { city: 'Kos', country: 'Grecia' },
  ZTH: { city: 'Zakynthos (Zante)', country: 'Grecia' },
  LCA: { city: 'Larnaca', country: 'Chipre' },
  PFO: { city: 'Pafos', country: 'Chipre' },
  IST: { city: 'Estambul', country: 'Turquía' },
  SAW: { city: 'Estambul (Sabiha)', country: 'Turquía' },
  AYT: { city: 'Antalya', country: 'Turquía' },
  DLM: { city: 'Dalaman', country: 'Turquía' },
  BJV: { city: 'Bodrum', country: 'Turquía' },
  ADB: { city: 'Izmir', country: 'Turquía' },
  ZAG: { city: 'Zagreb', country: 'Croacia' },
  SPU: { city: 'Split', country: 'Croacia' },
  DBV: { city: 'Dubrovnik', country: 'Croacia' },
  ZAD: { city: 'Zadar', country: 'Croacia' },
  BEG: { city: 'Belgrado', country: 'Serbia' },
  TIA: { city: 'Tirana', country: 'Albania' },
  SOF: { city: 'Sofía', country: 'Bulgaria' },
  VAR: { city: 'Varna', country: 'Bulgaria' },
  OTP: { city: 'Bucarest', country: 'Rumania' },
  CLJ: { city: 'Cluj-Napoca', country: 'Rumania' },
  SJJ: { city: 'Sarajevo', country: 'Bosnia' },
  RAK: { city: 'Marrakech', country: 'Marruecos' },
  CMN: { city: 'Casablanca', country: 'Marruecos' },
  TNG: { city: 'Tánger', country: 'Marruecos' },
  FEZ: { city: 'Fez', country: 'Marruecos' },
  AGA: { city: 'Agadir', country: 'Marruecos' },
  TUN: { city: 'Túnez', country: 'Túnez' },
  ALG: { city: 'Argel', country: 'Argelia' },
  CAI: { city: 'El Cairo', country: 'Egipto' },
  HRG: { city: 'Hurghada', country: 'Egipto' },
  SSH: { city: 'Sharm el-Sheikh', country: 'Egipto' },
  MLA: { city: 'Malta', country: 'Malta' },
  JFK: { city: 'Nueva York', country: 'EE.UU.' },
  EWR: { city: 'Nueva York (Newark)', country: 'EE.UU.' },
  MIA: { city: 'Miami', country: 'EE.UU.' },
  LAX: { city: 'Los Ángeles', country: 'EE.UU.' },
  ORD: { city: 'Chicago', country: 'EE.UU.' },
  BOS: { city: 'Boston', country: 'EE.UU.' },
  CUN: { city: 'Cancún', country: 'México' },
  MEX: { city: 'Ciudad de México', country: 'México' },
  BOG: { city: 'Bogotá', country: 'Colombia' },
  LIM: { city: 'Lima', country: 'Perú' },
  EZE: { city: 'Buenos Aires', country: 'Argentina' },
  GRU: { city: 'São Paulo', country: 'Brasil' },
  GIG: { city: 'Río de Janeiro', country: 'Brasil' },
  HAV: { city: 'La Habana', country: 'Cuba' },
  SDQ: { city: 'Santo Domingo', country: 'Rep. Dominicana' },
  DXB: { city: 'Dubái', country: 'EAU' },
  DOH: { city: 'Doha', country: 'Qatar' },
  AUH: { city: 'Abu Dabi', country: 'EAU' },
  AMM: { city: 'Ammán', country: 'Jordania' },
  TLV: { city: 'Tel Aviv', country: 'Israel' },
  BEY: { city: 'Beirut', country: 'Líbano' },
  BKK: { city: 'Bangkok', country: 'Tailandia' },
  HKT: { city: 'Phuket', country: 'Tailandia' },
  SIN: { city: 'Singapur', country: 'Singapur' },
  KUL: { city: 'Kuala Lumpur', country: 'Malasia' },
  HKG: { city: 'Hong Kong', country: 'Hong Kong' },
  NRT: { city: 'Tokio', country: 'Japón' },
  TYO: { city: 'Tokio', country: 'Japón' },
  DEL: { city: 'Delhi', country: 'India' },
  BOM: { city: 'Mumbai', country: 'India' },
  DPS: { city: 'Bali', country: 'Indonesia' },
};

function buildSkyscannerUrl(
  origin: string,
  dest: string,
  depDate: string,
  retDate: string | null,
  adults: number,
  children: number = 0,
  infants: number = 0
): string {
  const dep = depDate.replace(/-/g, '').slice(2);
  const base = `https://www.skyscanner.es/transport/vuelos/${origin.toLowerCase()}/${dest.toLowerCase()}/${dep}`;
  const params = new URLSearchParams({ adultsv2: String(adults) });
  if (children > 0) {
    // Skyscanner expects childrenv2 with child ages separated by | (e.g. 5|5 for 2 children)
    params.append('childrenv2', Array(children).fill('5').join('|'));
  }
  if (infants > 0) {
    params.append('infantsv2', String(infants));
  }
  if (retDate) {
    const ret = retDate.replace(/-/g, '').slice(2);
    return `${base}/${ret}/?${params.toString()}`;
  }
  return `${base}/?${params.toString()}`;
}

function calcTotal(pricePerPerson: number, adults: number, children: number, infants: number): number {
  return Math.round(pricePerPerson * adults + pricePerPerson * 0.75 * children + pricePerPerson * 0.10 * infants);
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const origin = (searchParams.get('origin') || 'MAD').toUpperCase();
  const destination = (searchParams.get('destination') || 'ANY').toUpperCase();
  const departureAt = searchParams.get('departureAt') || '';
  const departureEndAt = searchParams.get('departureEndAt') || departureAt;
  const returnAt = searchParams.get('returnAt') || null;
  const adults = Math.max(1, parseInt(searchParams.get('adults') || '2', 10));
  const children = Math.max(0, parseInt(searchParams.get('children') || '0', 10));
  const infants = Math.max(0, parseInt(searchParams.get('infants') || '0', 10));
  const isOneWay = searchParams.get('oneWay') === 'true';
  const durationMin = Math.max(1, parseInt(searchParams.get('durationMin') || '1', 10));
  const durationMax = Math.max(durationMin, parseInt(searchParams.get('durationMax') || '30', 10));
  const midDays = Math.round((durationMin + durationMax) / 2);

  const effectiveReturnAt = isOneWay ? null : returnAt;

  // Build API URL — Aviasales works per-month; use departure month of the start date
  const anyDest = !destination || destination === 'ANY';

  let apiUrl = `https://api.travelpayouts.com/aviasales/v3/prices_for_dates?origin=${origin}&currency=eur&limit=200&direct=false&token=${TOKEN}`;
  if (!anyDest) apiUrl += `&destination=${destination}`;

  // Only restrict departure_at to a single month if travel window is within the same month (e.g. 2026-10-03 to 2026-10-04)
  // If window spans multiple months or up to a full year, omit departure_at to fetch deals across all 12 months
  const isSingleMonth = departureAt && departureEndAt && departureAt.slice(0, 7) === departureEndAt.slice(0, 7);
  if (isSingleMonth) {
    apiUrl += `&departure_at=${departureAt.slice(0, 7)}`;
  }


  try {
    const res = await fetch(apiUrl, {
      headers: { 'Accept-Encoding': 'gzip' },
      // @ts-ignore
      next: { revalidate: 1800 },
    });

    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const data = await res.json();
    const rawItems: any[] = data.data || [];
    const items = rawItems.filter((item) => !item.origin || item.origin.toUpperCase() === origin);
    const hasDepConstraint = Boolean(departureAt);

    if (items.length === 0) {
      if (hasDepConstraint) {
        return NextResponse.json(
          { success: true, results: [], source: 'api' },
          { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
        );
      }
      throw new Error('No results');
    }

    const depWindowStart = departureAt ? new Date(`${departureAt}T00:00:00`) : null;
    const depWindowEnd   = departureEndAt
      ? new Date(`${departureEndAt}T23:59:59.999`)
      : departureAt
      ? new Date(`${departureAt}T23:59:59.999`)
      : null;

    // STEP 1: Filter raw items by travel window and trip duration FIRST (before destination grouping)
    const validItems = items.filter((item) => {
      const dep = item.departure_at ? new Date(item.departure_at) : null;
      const ret = item.return_at   ? new Date(item.return_at)    : null;

      // Check departure window
      const inWindow = !dep || !depWindowStart || !depWindowEnd
        ? true
        : dep >= depWindowStart && dep <= depWindowEnd;

      // Check duration range
      const inDuration = isOneWay || !dep || !ret
        ? true
        : (() => {
            const days = Math.round((ret.getTime() - dep.getTime()) / 86400000);
            return days >= durationMin && days <= durationMax;
          })();

      return inWindow && inDuration;
    });

    const candidatePool = hasDepConstraint
      ? validItems
      : (validItems.length > 0 ? validItems : items);

    // STEP 2: Aggregate by destination (take cheapest VALID deal per destination)
    const byDest: Record<string, any> = {};
    for (const item of candidatePool) {
      const dc = item.destination;
      if (!byDest[dc] || item.price < byDest[dc].price) {
        byDest[dc] = item;
      }
    }
    const pool = Object.values(byDest);

    const results = pool
      .map((item) => {
        const destCode = item.destination;
        const cityInfo = CITY_MAP[destCode] || { city: destCode, country: 'Europa' };
        const pricePerPerson = Math.round(item.price || 30);
        const totalPrice = calcTotal(pricePerPerson, adults, children, infants);
        const depDateStr = item.departure_at ? item.departure_at.slice(0, 10) : departureAt || '';

        // Compute return date safely — never let it fall before the actual departure
        const retDateStr = (() => {
          if (isOneWay) return null;

          // Prefer the API's own return_at (most accurate)
          if (item.return_at) {
            const r = item.return_at.slice(0, 10);
            // Sanity check: return must be after departure
            if (!depDateStr || r > depDateStr) return r;
          }

          // Use the pre-calculated effectiveReturnAt only if it's after the actual departure
          if (effectiveReturnAt && depDateStr && effectiveReturnAt > depDateStr) {
            return effectiveReturnAt;
          }

          // Fallback: calculate from actual departure date + midDays
          if (depDateStr) {
            return new Date(new Date(depDateStr).getTime() + midDays * 86400000)
              .toISOString().slice(0, 10);
          }

          return null;
        })();
        const skyscannerUrl = buildSkyscannerUrl(origin, destCode, depDateStr, retDateStr, adults, children, infants);

        return {
          id: `${origin}-${destCode}-${depDateStr}`,
          origin,
          destination: destCode,
          destinationCity: cityInfo.city,
          destinationCountry: cityInfo.country,
          pricePerPerson,
          totalPrice,
          adults,
          children,
          infants,
          departureAt: depDateStr,
          returnAt: retDateStr,
          airline: item.airline || null,
          transfers: item.transfers ?? null,
          skyscannerUrl,
          marker: MARKER,
        };
      })
      .sort((a, b) => a.totalPrice - b.totalPrice)
      .slice(0, 20);

    return NextResponse.json(
      { success: true, results, source: 'api' },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
    );
  } catch {
    // Fallback: generate estimated results
    const destsToShow = anyDest
      ? DESTINATIONS_FALLBACK
      : DESTINATIONS_FALLBACK.filter((d) => d.code === destination).length > 0
      ? DESTINATIONS_FALLBACK.filter((d) => d.code === destination)
      : [{ code: destination, city: CITY_MAP[destination]?.city || destination, country: CITY_MAP[destination]?.country || 'Europa', priceBase: 45 }];

    const results = destsToShow.map((d, i) => {
      const pricePerPerson = d.priceBase + Math.floor(Math.random() * 10);
      const totalPrice = calcTotal(pricePerPerson, adults, children, infants);

      // Compute sensible dates if none provided
      const baseMs = Date.now() + (i + 1) * 7 * 86400000;
      const depDateStr = departureAt || new Date(baseMs).toISOString().slice(0, 10);
      const retDateStr = isOneWay
        ? null
        : effectiveReturnAt && effectiveReturnAt > depDateStr
        ? effectiveReturnAt
        : new Date(new Date(depDateStr).getTime() + midDays * 86400000).toISOString().slice(0, 10);

      const skyscannerUrl = buildSkyscannerUrl(origin, d.code, depDateStr, retDateStr, adults, children, infants);

      return {
        id: `fallback-${origin}-${d.code}-${i}`,
        origin,
        destination: d.code,
        destinationCity: d.city,
        destinationCountry: d.country,
        pricePerPerson,
        totalPrice,
        adults,
        children,
        infants,
        departureAt: depDateStr,
        returnAt: retDateStr,
        airline: null,
        transfers: null,
        skyscannerUrl,
        marker: MARKER,
      };
    });

    return NextResponse.json(
      { success: true, results: results.sort((a, b) => a.totalPrice - b.totalPrice), source: 'fallback' },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
    );
  }
}
