// /go — Redirect intermediario para preservar comisiones de referidos
// Uso: /go?url=https://s.click.aliexpress.com/e/_xxx
//
// El tráfico de Telegram pasa PRIMERO por viajandoentesla.es
// y desde aquí se redirige al affiliate link. Esto garantiza
// que las cookies de sesión del programa de referidos se establezcan
// correctamente (las apps de Telegram rompen el tracking directo).

import { NextRequest, NextResponse } from 'next/server';

// Dominios permitidos como destino (lista blanca de seguridad)
const ALLOWED_DOMAINS = [
  'aliexpress.com',
  's.click.aliexpress.com',
  'ali.ski',
  'amazon.es',
  'amazon.com',
  'amzn.to',
  'temu.com',
  'shein.com',
];

export async function GET(request: NextRequest) {
  const dest = request.nextUrl.searchParams.get('url');

  // Validar que hay destino y está en la lista blanca
  if (!dest || !ALLOWED_DOMAINS.some((d) => dest.includes(d))) {
    return NextResponse.redirect(new URL('/', request.url), { status: 302 });
  }

  // Redirect 302 (temporal, no cacheable) → el affiliate link real
  return NextResponse.redirect(dest, { status: 302 });
}
