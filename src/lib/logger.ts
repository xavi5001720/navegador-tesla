// src/lib/logger.ts — Logger centralizado con niveles
// En producción suprime 'info', siempre mantiene 'warn' y 'error'.

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
  },
  error(module: string, msg: string, data?: unknown) {
    console.error(formatMsg('error', module, msg, data));
    // Aquí se podría añadir integración con Sentry en el futuro:
    // Sentry.captureException(data instanceof Error ? data : new Error(msg));
  },
};
