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

  const safeDest = dest.replace(/"/g, '&quot;');
  const safeJsonDest = JSON.stringify(dest);

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="referrer" content="origin">
  <meta http-equiv="refresh" content="1;url=${safeDest}">
  <title>Redirigiendo...</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; text-align: center; }
    .loader { border: 3px solid #1e293b; border-top: 3px solid #38bdf8; border-radius: 50%; width: 32px; height: 32px; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div>
    <div class="loader"></div>
    <p>Redirigiendo al producto...</p>
    <p><small>Si no eres redirigido automáticamente, <a href="${safeDest}" style="color: #38bdf8;">haz clic aquí</a>.</small></p>
  </div>
  <script>
    window.location.href = ${safeJsonDest};
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

