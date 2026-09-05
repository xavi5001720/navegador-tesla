/**
 * AudioEngine — Genera avisos acústicos mediante Web Audio API
 * Sin ficheros de audio externos. Todo sintetizado en tiempo real.
 */
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.volume = 0.7;

    // Anti-spam: tiempo mínimo entre alertas del mismo nivel
    this.lastAlertTime = { 1: 0, 2: 0, 3: 0 };
    this.COOLDOWN_MS = { 1: 8000, 2: 6000, 3: 4000 };
  }

  // ── Context lazy init (necesario por política autoplay del navegador) ──
  _getCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // ── Genera un pitido individual ──────────────────────────────────────
  _beep(frequency, duration, startTime, shape = 'sine') {
    const ctx = this._getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = shape;
    osc.frequency.setValueAtTime(frequency, startTime);

    // Envelope: fade in rápido, fade out suave
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(this.volume, startTime + 0.015);
    gain.gain.setValueAtTime(this.volume, startTime + duration * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  // ── Tono de advertencia suave (fondo durante proximidad) ─────────────
  _warmingTone(startTime) {
    const ctx = this._getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(660, startTime);
    osc.frequency.linearRampToValueAtTime(440, startTime + 0.3);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(this.volume * 0.4, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

    osc.start(startTime);
    osc.stop(startTime + 0.35);
  }

  // ── API PÚBLICA ───────────────────────────────────────────────────────

  /**
   * Reproduce alerta según nivel:
   *   1 → 1 beep  (500m) — Aviso inicial
   *   2 → 2 beeps (300m) — Cerca
   *   3 → 3 beeps (150m) — Urgente
   */
  playAlert(level) {
    if (this.muted) return false;

    const now = Date.now();
    const cooldown = this.COOLDOWN_MS[level] || 5000;
    if (now - (this.lastAlertTime[level] || 0) < cooldown) return false;

    this.lastAlertTime[level] = now;

    const ctx = this._getCtx();
    const t0 = ctx.currentTime + 0.05; // pequeño delay para evitar glitches

    switch (level) {
      case 1:
        // Un beep grave suave — aviso temprano
        this._warmingTone(t0);
        this._beep(880, 0.35, t0 + 0.35);
        break;

      case 2:
        // Dos beeps medios — ya nos acercamos
        this._beep(1100, 0.22, t0);
        this._beep(1100, 0.22, t0 + 0.32);
        break;

      case 3:
        // Tres beeps agudos rápidos — urgente
        this._beep(1400, 0.18, t0, 'square');
        this._beep(1400, 0.18, t0 + 0.25, 'square');
        this._beep(1600, 0.22, t0 + 0.50, 'square');
        break;
    }

    return true;
  }

  /** Reproduce un sonido de confirmación (al activar GPS, etc.) */
  playConfirm() {
    if (this.muted) return;
    const ctx = this._getCtx();
    const t = ctx.currentTime + 0.05;
    this._beep(440, 0.1, t);
    this._beep(660, 0.1, t + 0.12);
    this._beep(880, 0.2, t + 0.24);
  }

  /** Reproduce un sonido de error */
  playError() {
    if (this.muted) return;
    const ctx = this._getCtx();
    const t = ctx.currentTime + 0.05;
    this._beep(300, 0.4, t);
    this._beep(200, 0.5, t + 0.45);
  }

  /** Activa/desactiva silencio */
  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  /** Resetea cooldowns (al detectar un radar nuevo) */
  resetCooldowns() {
    this.lastAlertTime = { 1: 0, 2: 0, 3: 0 };
  }

  /** Fuerza inicialización del contexto (debe llamarse desde un gesto del usuario) */
  unlock() {
    const ctx = this._getCtx();
    // Reproducir silencio para "desbloquear" el contexto de audio
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  }
}
