// sentry.server.config.ts
// Configuración de Sentry para el servidor Next.js (API routes, SSR)
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://ea20335423cab0f9e30ebb48e375beb2@o4511217591386112.ingest.de.sentry.io/4511217615831120',

  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,

  // Solo activo en producción
  enabled: process.env.NODE_ENV === 'production',
});
