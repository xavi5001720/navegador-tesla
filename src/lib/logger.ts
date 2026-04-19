// src/lib/logger.ts — Logger centralizado con Telemetría Avanzada e integración Sentry
import * as Sentry from '@sentry/nextjs';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const IS_PROD = process.env.NODE_ENV === 'production';
// Flag para activar la telemetría avanzada (grupos, tablas, tiempos)
const DEBUG_MODE = !IS_PROD; 

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
    if (IS_PROD) {
      const error = data instanceof Error ? data : new Error(`[${module}] ${msg}`);
      Sentry.captureException(error, {
        tags: { module },
        extra: { message: msg, data: data instanceof Error ? undefined : data },
      });
    }
  },

  // --- MÉTODOS DE TELEMETRÍA (Solo activos en DEBUG_MODE) ---

  group(label: string, collapsed = true) {
    if (DEBUG_MODE) {
      if (collapsed) console.groupCollapsed(label);
      else console.group(label);
    }
  },

  groupEnd() {
    if (DEBUG_MODE) console.groupEnd();
  },

  time(label: string) {
    if (DEBUG_MODE) console.time(label);
  },

  timeEnd(label: string) {
    if (DEBUG_MODE) console.timeEnd(label);
  },

  table(data: unknown) {
    if (DEBUG_MODE) console.table(data);
  },

  setUser(id: string, email?: string) {
    Sentry.setUser({ id, email });
  },

  clearUser() {
    Sentry.setUser(null);
  },
};
