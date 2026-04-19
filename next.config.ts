// next.config.ts
import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: '/opensky/:path*',
        destination: 'https://opensky-network.org/:path*',
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // DSN de Sentry (también puede ir en NEXT_PUBLIC_SENTRY_DSN para mayor seguridad)
  org: 'o4511217591386112',
  project: 'javascript-nextjs',

  // Subir source maps a Sentry para ver los errores con nombres de variables reales
  // (no minificados) en el panel de Sentry
  silent: true, // No spam en los logs del build de Vercel
  widenClientFileUpload: true,

  // Elimina los source maps del bundle tras subirlos a Sentry (seguridad)
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Desactiva el logger de Sentry en el navegador (menos ruido en consola)
  disableLogger: true,

  // Tunneling: evita que bloqueadores de ads bloquen los reports de Sentry
  tunnelRoute: '/monitoring',

  // Compatibilidad con Next.js App Router
  autoInstrumentServerFunctions: true,
});
