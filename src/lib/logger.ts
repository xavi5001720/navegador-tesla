// src/lib/logger.ts — Logger centralizado con niveles + integración Sentry
// En producción suprime 'info', siempre mantiene 'warn' y 'error'.
// Los errores se envían automáticamente a Sentry en producción.

import * as Sentry from '@sentry/nextjs';

type LogLevel = 'info' | 'warn' | 'error';

const IS_PROD = process.env.NODE_ENV === 'production';

function formatMsg(level: LogLevel, module: string, msg: string, data?: unknown): string {
  const ts = new Date().toISOString().substring(11, 23); // HH:mm:ss.mmm
  return `[${ts}][${level.toUpperCase()}][${module}] ${msg}${data !== undefined ? ' ' + JSON.stringify(data) : ''}`;
}

export const logger = {
  info(module: string, msg: string, data?: unknown) {
    if (!IS_PROD) console.log(formatMsg('info', module, msg, data));
  },

  warn(module: string, msg: string, data?: unknown) {
    console.warn(formatMsg('warn', module, msg, data));
    // Warnings también van a Sentry como breadcrumbs (pistas del contexto)
    if (IS_PROD) {
      Sentry.addBreadcrumb({
        category: module,
        message: msg,
        level: 'warning',
        data: data ? { detail: String(data) } : undefined,
      });
    }
  },

  error(module: string, msg: string, data?: unknown) {
    console.error(formatMsg('error', module, msg, data));
    // Errores se envían a Sentry en producción
    if (IS_PROD) {
      const error = data instanceof Error ? data : new Error(`[${module}] ${msg}`);
      Sentry.captureException(error, {
        tags: { module },
        extra: {
          message: msg,
          data: data instanceof Error ? undefined : data,
        },
      });
    }
  },

  // Establece contexto del usuario actual para que los errores aparezcan
  // vinculados al usuario en el panel de Sentry
  setUser(id: string, email?: string) {
    Sentry.setUser({ id, email });
  },

  clearUser() {
    Sentry.setUser(null);
  },
};
