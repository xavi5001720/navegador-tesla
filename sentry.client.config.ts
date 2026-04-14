// sentry.client.config.ts
// Configuración de Sentry para el navegador (client-side)
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://ea20335423cab0f9e30ebb48e375beb2@o4511217591386112.ingest.de.sentry.io/4511217615831120',

  // Entorno (se detecta automáticamente en Vercel)
  environment: process.env.NODE_ENV,

  // Captura el 100% de los errores, samples 10% de traces de rendimiento
  tracesSampleRate: 0.1,

  // Capturas sessions de usuario para ver cuántos usuarios afectaron los errores
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,

  // No enviar errores en local (desarrollo)
  enabled: process.env.NODE_ENV === 'production',

  // Ignorar errores de terceros y de red que no podemos controlar
  ignoreErrors: [
    // Errores de red normales (sin conexión, timeout)
    'Network request failed',
    'Failed to fetch',
    'NetworkError',
    'AbortError',
    // Errores de extensiones del navegador
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
  ],

  beforeSend(event) {
    // No enviar si el error es de GPS denegado por el usuario
    if (event.exception?.values?.[0]?.value?.includes('Permission denied')) {
      return null;
    }
    return event;
  },
});
