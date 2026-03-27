// src/utils/sound.ts

export type VoiceType = 'hombre' | 'mujer' | 'robot';

const VOLUME = 1.0;

let audioUnlocked = false;
let beepPlayer: HTMLAudioElement | null = null;

// ── Unlock audio context on first interaction ───────────────────────────────
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

    // Also warm up SpeechSynthesis
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }

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

// ── Voice via Web Speech API ─────────────────────────────────────────────────
const pickVoice = (voiceType: VoiceType): SpeechSynthesisVoice | null => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const esVoices = voices.filter(v => v.lang.startsWith('es'));

  if (voiceType === 'mujer') {
    // Preferimos voces con nombre femenino (Google es-ES, Microsoft Laura…)
    return (
      esVoices.find(v => /laura|elena|carmen|sabina|female|mujer/i.test(v.name)) ??
      esVoices[0] ??
      null
    );
  }
  if (voiceType === 'hombre') {
    // Preferimos voces masculinas
    return (
      esVoices.find(v => /diego|jorge|pablo|miguel|male|hombre/i.test(v.name)) ??
      esVoices[1] ??
      esVoices[0] ??
      null
    );
  }
  // robot: cualquier voz, luego aplicamos pitch/rate extremos
  return esVoices[0] ?? null;
};

const playVoice = (msg: string, voiceType: VoiceType) => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utter = new SpeechSynthesisUtterance(msg);
  utter.lang = 'es-ES';
  utter.volume = VOLUME;

  if (voiceType === 'robot') {
    utter.pitch = 0.1;   // muy grave / mecánico
    utter.rate  = 0.85;
  } else if (voiceType === 'hombre') {
    utter.pitch = 0.75;
    utter.rate  = 1.0;
  } else {
    // mujer
    utter.pitch = 1.4;
    utter.rate  = 1.05;
  }

  // Try to assign a matching voice; if none available the browser uses default
  const voice = pickVoice(voiceType);
  if (voice) utter.voice = voice;

  window.speechSynthesis.speak(utter);
};

// ── Public API ────────────────────────────────────────────────────────────────
export const playRadarAlert = (voiceType: VoiceType, type: 'safe_first' | 'safe_second' | 'danger') => {
  if (typeof window === 'undefined') return;
  try {
    playBeep(type === 'danger' ? 'alarm_clock_beeping' : 'beep_short');

    let msg = '';
    if (type === 'danger')       msg = 'Peligro. Exceso de velocidad en radar próximo. Reduzca la velocidad.';
    else if (type === 'safe_first')  msg = 'Atención, radar próximo. Velocidad correcta.';
    else if (type === 'safe_second') msg = 'Radar muy cercano. Velocidad correcta.';

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
