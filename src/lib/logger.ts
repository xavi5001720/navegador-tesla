// src/lib/logger.ts — Logger centralizado con "Modo Xavi" (Telemetría bajo demanda)
import * as Sentry from '@sentry/nextjs';

const IS_PROD = process.env.NODE_ENV === 'production';

// Función para comprobar si el modo debug está activo vía URL (?xavi=...)
const isXaviMode = () => {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.has('xavi') || params.get('debug') === 'true';
};

// MARCA DE AGUA (Solo si estamos en Modo Xavi)
if (isXaviMode()) {
  console.log('%c🚀 NAVEGAPRO XAVI-MODE ACTIVE', 'background: #1e40af; color: white; padding: 10px; font-weight: bold; border-radius: 8px; font-size: 14px;');
}

export const logger = {
  info(module: string, message: string, ...args: unknown[]) {
    if (!isXaviMode()) return;
    console.log(`%c[${new Date().toLocaleTimeString()}][INFO][${module}] ${message}`, 'color: #3b82f6; font-weight: bold', ...args);
  },

  warn(module: string, message: string, ...args: unknown[]) {
    if (isXaviMode()) {
      console.warn(`[${new Date().toLocaleTimeString()}][WARN][${module}] ${message}`, ...args);
    }
    if (IS_PROD) {
      Sentry.addBreadcrumb({
        category: module,
        message: message,
        level: 'warning',
      });
    }
  },

  error(module: string, message: string, ...args: unknown[]) {
    if (isXaviMode()) {
      console.error(`[${new Date().toLocaleTimeString()}][ERROR][${module}] ${message}`, ...args);
    }
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
    if (isXaviMode()) console.group(label);
  },

  groupCollapsed(label: string) {
    if (isXaviMode()) console.groupCollapsed(label);
  },

  groupEnd() {
    if (isXaviMode()) console.groupEnd();
  },

  time(label: string) {
    if (isXaviMode()) console.time(label);
  },

  timeEnd(label: string) {
    if (isXaviMode()) console.timeEnd(label);
  },

  table(data: any) {
    if (isXaviMode()) console.table(data);
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
