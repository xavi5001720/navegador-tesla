// src/utils/sound.ts

export type VoiceType = 'hombre' | 'mujer' | 'robot';

const VOLUME = 1.0;

let audioUnlocked = false;
let beepPlayer: HTMLAudioElement | null = null;
let audioCtx: AudioContext | null = null;

// ── Unlock audio ─────────────────────────────────────────────────────────────
export const unlockTeslaAudio = () => {
  if (typeof window === 'undefined' || audioUnlocked) return;
  try {
    if (!beepPlayer) {
      beepPlayer = new Audio();
      beepPlayer.preload = 'auto';
    }
    const silentMp3 =
      'data:audio/mp3;base64,//OExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';
    beepPlayer.src = silentMp3;
    beepPlayer.play().then(() => beepPlayer?.pause()).catch(() => {});
    audioUnlocked = true;
    console.log('[Sound] Audio unlocked');
  } catch (err) {
    console.error('[Sound] Unlock error:', err);
  }
};

// ── Beep ─────────────────────────────────────────────────────────────────────
const playBeep = (type: 'beep_short' | 'alarm_clock_beeping') => {
  if (!beepPlayer) return;
  const url =
    type === 'beep_short'
      ? 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg'
      : 'https://actions.google.com/sounds/v1/alarms/alarm_clock_beeping.ogg';
  beepPlayer.src = url;
  beepPlayer.volume = VOLUME;
  beepPlayer.play().catch(e => console.warn('[Sound] Beep blocked:', e));
};

// ── Voice via Google TTS proxy with Locale selection ───────────────────────
const playVoice = async (msg: string, voiceType: VoiceType) => {
  if (typeof window === 'undefined') return;

  try {
    let lang = 'es'; // Mujer (es-ES) por defecto
    if (voiceType === 'hombre') lang = 'es-US'; // Hombre hispanoamericano
    if (voiceType === 'robot') lang = 'es-MX';  // Voz femenina diferente (latina alternativa)
    
    // Reproduce el MP3 (v=2 fuerza a saltar la caché persistente del navegador)
    const url = `/api/tts?text=${encodeURIComponent(msg)}&lang=${lang}&v=2`;
    const audio = new Audio(url);
    audio.volume = VOLUME;
    audio.play().catch(e => console.warn('[Sound] Voice blocked:', e));
  } catch (err) {
    console.error('[Sound] playVoice error:', err);
  }
};

// ── Public API ────────────────────────────────────────────────────────────────
export const playRadarAlert = (voiceType: VoiceType, type: 'safe_first' | 'safe_second' | 'danger') => {
  if (typeof window === 'undefined') return;
  try {
    playBeep(type === 'danger' ? 'alarm_clock_beeping' : 'beep_short');

    let msg = '';
    if (type === 'danger')        msg = 'Peligro. Exceso de velocidad en radar próximo. Reduzca la velocidad.';
    else if (type === 'safe_first')   msg = 'Atención, radar próximo. Velocidad correcta.';
    else if (type === 'safe_second')  msg = 'Radar muy cercano. Velocidad correcta.';

    if (msg) playVoice(msg, voiceType);
  } catch (err) {
    console.error('[Sound] playRadarAlert error:', err);
  }
};

export const playTestSound = (voiceType: VoiceType) => {
  if (typeof window === 'undefined') return;
  try {
    playBeep('beep_short');
    playVoice('Prueba de sonido completada. Sistema de alertas activo.', voiceType);
  } catch (err) {
    console.error('[Sound] playTestSound error:', err);
  }
};

export const playPegasusAlert = (voiceType: VoiceType, callsign: string, altitude: number, speed_kmh: number) => {
  if (typeof window === 'undefined') return;
  try {
    playBeep('alarm_clock_beeping');
    const nameStr = callsign && callsign !== 'N/A' ? `llamada ${callsign}` : 'una aeronave';
    const msg = `Alerta Pegasus. ${nameStr} detectada a ${Math.round(altitude)} metros de altura. Velocidad ${Math.round(speed_kmh)} kilómetros por hora. Posible vigilancia.`;
    playVoice(msg, voiceType);
  } catch (err) {
    console.error('[Sound] playPegasusAlert error:', err);
  }
};
