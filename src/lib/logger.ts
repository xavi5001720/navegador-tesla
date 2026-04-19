// src/lib/logger.ts — Logger centralizado con Telemetría Avanzada
import * as Sentry from '@sentry/nextjs';

const IS_PROD = process.env.NODE_ENV === 'production';

// MARCA DE AGUA PARA VERIFICAR DESPLIEGUE
console.log('%c🚀 NAVEGAPRO TELEMETRY V3.0 - ONLINE', 'background: #1e40af; color: white; padding: 10px; font-weight: bold; border-radius: 8px; font-size: 14px;');

export const logger = {
  info(module: string, message: string, ...args: unknown[]) {
    console.log(`%c[${new Date().toLocaleTimeString()}][INFO][${module}] ${message}`, 'color: #3b82f6; font-weight: bold', ...args);
  },

  warn(module: string, message: string, ...args: unknown[]) {
    console.warn(`[${new Date().toLocaleTimeString()}][WARN][${module}] ${message}`, ...args);
    if (IS_PROD) {
      Sentry.addBreadcrumb({
        category: module,
        message: message,
        level: 'warning',
      });
    }
  },

  error(module: string, message: string, ...args: unknown[]) {
    console.error(`[${new Date().toLocaleTimeString()}][ERROR][${module}] ${message}`, ...args);
    if (IS_PROD) {
      const error = new Error(`[${module}] ${message}`);
      Sentry.captureException(error, {
        tags: { module },
        extra: { message, args },
      });
    }
  },

  // --- MÉTODOS DE TELEMETRÍA ---

  group(label: string) {
    console.group(label);
  },

  groupCollapsed(label: string) {
    console.groupCollapsed(label);
  },

  groupEnd() {
    console.groupEnd();
  },

  time(label: string) {
    console.time(label);
  },

  timeEnd(label: string) {
    console.timeEnd(label);
  },

  table(data: any) {
    console.table(data);
  },

  setUser(id: string, email?: string) {
    if (IS_PROD) {
      Sentry.setUser({ id, email });
    }
  },

  clearUser() {
    if (IS_PROD) {
      Sentry.setUser(null);
    }
  }
};
