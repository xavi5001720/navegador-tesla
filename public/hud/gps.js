/**
 * GPSModule — Gestión del GPS del dispositivo
 *
 * Funciones:
 *  - watchPosition con alta precisión
 *  - Velocidad en km/h (desde GPS o calculada por posición)
 *  - Heading desde GPS o calculado entre posiciones consecutivas
 *  - Suavizado de velocidad y dirección (EMA)
 */
class GPSModule {
  constructor() {
    this.watchId       = null;
    this.lastPos       = null;   // { lat, lon, timestamp }
    this.smoothSpeed   = 0;      // km/h suavizado
    this.smoothHeading = 0;      // grados suavizados
    this.accuracy      = null;   // metros
    this.status        = 'idle'; // idle | requesting | active | error

    // Factores de suavizado EMA (0=sin cambio, 1=sin suavizado)
    this.ALPHA_SPEED   = 0.35;
    this.ALPHA_HEADING = 0.25;

    // Velocidad mínima para actualizar heading (evita ruido a baja velocidad)
    this.MIN_SPEED_FOR_HEADING = 4; // km/h

    // Callbacks
    this.onUpdate = null;
    this.onError  = null;
    this.onStatus = null;
  }

  // ── API PÚBLICA ───────────────────────────────────────────────────────

  start(onUpdate, onError, onStatus) {
    this.onUpdate = onUpdate;
    this.onError  = onError;
    this.onStatus = onStatus;

    if (!navigator.geolocation) {
      this._emitError('GPS no disponible en este dispositivo o navegador.');
      return;
    }

    this._setStatus('requesting');

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this._handlePosition(pos),
      (err) => this._handleGpsError(err),
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 500
      }
    );
  }

  stop() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this._setStatus('idle');
  }

  // ── HANDLERS INTERNOS ─────────────────────────────────────────────────

  _handlePosition(position) {
    this._setStatus('active');
    const c = position.coords;
    const now = position.timestamp;

    // ── Velocidad ──────────────────────────────────────────────────────
    let rawSpeedKmh = 0;

    if (c.speed !== null && c.speed >= 0) {
      // El GPS reporta velocidad directamente (m/s → km/h)
      rawSpeedKmh = c.speed * 3.6;
    } else if (this.lastPos) {
      // Calcular desde distancia / tiempo
      const dist  = geoDistance(this.lastPos.lat, this.lastPos.lon, c.latitude, c.longitude);
      const dtSec = (now - this.lastPos.timestamp) / 1000;
      if (dtSec > 0.1) {
        rawSpeedKmh = (dist / dtSec) * 3.6;
      }
    }

    // Clamp: GPS puede dar picos absurdos brevemente
    rawSpeedKmh = Math.min(rawSpeedKmh, 300);

    // Suavizado EMA
    this.smoothSpeed = this.ALPHA_SPEED * rawSpeedKmh + (1 - this.ALPHA_SPEED) * this.smoothSpeed;

    // ── Heading ────────────────────────────────────────────────────────
    let rawHeading = c.heading; // puede ser null

    if ((rawHeading === null || rawHeading === undefined || isNaN(rawHeading)) && this.lastPos) {
      // Calcular desde delta de posición
      if (rawSpeedKmh >= this.MIN_SPEED_FOR_HEADING) {
        rawHeading = geoBearing(this.lastPos.lat, this.lastPos.lon, c.latitude, c.longitude);
      }
    }

    if (rawHeading !== null && rawHeading !== undefined && !isNaN(rawHeading)) {
      this.smoothHeading = smoothCircular(this.smoothHeading, rawHeading, this.ALPHA_HEADING);
    }

    this.accuracy = c.accuracy;

    // ── Guardar posición ───────────────────────────────────────────────
    this.lastPos = {
      lat: c.latitude,
      lon: c.longitude,
      timestamp: now
    };

    // ── Emitir actualización ───────────────────────────────────────────
    if (this.onUpdate) {
      this.onUpdate({
        lat:      c.latitude,
        lon:      c.longitude,
        speed:    Math.max(0, Math.round(this.smoothSpeed)),
        rawSpeed: rawSpeedKmh,
        heading:  Math.round(this.smoothHeading),
        accuracy: this.accuracy,
        timestamp: now
      });
    }
  }

  _handleGpsError(error) {
    const messages = {
      1: 'Permiso de ubicación denegado. Actívalo en los ajustes del navegador.',
      2: 'GPS no disponible. Asegúrate de tener señal.',
      3: 'Tiempo de espera del GPS agotado. Muévete a una zona con mejor señal.'
    };
    this._emitError(messages[error.code] || `Error GPS (código ${error.code})`);
  }

  _emitError(msg) {
    this._setStatus('error');
    if (this.onError) this.onError(msg);
  }

  _setStatus(status) {
    this.status = status;
    if (this.onStatus) this.onStatus(status);
  }
}

// ═══════════════════════════════════════════════════════════════
// FUNCIONES GEOGRÁFICAS GLOBALES
// (usadas también por radares.js)
// ═══════════════════════════════════════════════════════════════

/**
 * Distancia Haversine entre dos puntos en metros
 */
function geoDistance(lat1, lon1, lat2, lon2) {
  const R  = 6371000; // radio Tierra en metros
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a = Math.sin(Δφ / 2) ** 2
            + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Rumbo (bearing) inicial entre dos puntos (0-360°, 0=Norte)
 */
function geoBearing(lat1, lon1, lat2, lon2) {
  const dLon = toRad(lon2 - lon1);
  const φ1   = toRad(lat1), φ2 = toRad(lat2);
  const y    = Math.sin(dLon) * Math.cos(φ2);
  const x    = Math.cos(φ1) * Math.sin(φ2)
               - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Suavizado circular para ángulos (evita saltos 359° → 1°) */
function smoothCircular(current, target, alpha) {
  let diff = target - current;
  if (diff >  180) diff -= 360;
  if (diff < -180) diff += 360;
  return (current + alpha * diff + 360) % 360;
}

/** Diferencia angular más corta entre dos ángulos (-180 a 180) */
function angleDiff(a, b) {
  let d = b - a;
  while (d >  180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

/** Dirección cardinal (N, NE, E, etc.) */
function headingToCardinal(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

const toRad = (d) => d * Math.PI / 180;
const toDeg = (r) => r * 180 / Math.PI;
