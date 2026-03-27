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

// ── Voice via Google TTS proxy + Web Audio pitch shift ───────────────────────
const playVoice = async (msg: string, voiceType: VoiceType) => {
  if (typeof window === 'undefined') return;

  try {
    // Mujer: reproduce el MP3 de Google TTS directamente sin transformación
    if (voiceType === 'mujer') {
      const audio = new Audio(`/api/tts?text=${encodeURIComponent(msg)}`);
      audio.volume = VOLUME;
      audio.play().catch(e => console.warn('[Sound] Voice blocked:', e));
      return;
    }

    // Hombre / Robot: descargamos el audio y lo reproducimos con pitch modificado vía Web Audio API
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    const response = await fetch(`/api/tts?text=${encodeURIComponent(msg)}`);
    if (!response.ok) throw new Error(`TTS fetch failed: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;

    // playbackRate < 1 → más grave y lento; simula una voz masculina/robot
    if (voiceType === 'hombre') {
      source.playbackRate.value = 0.78; // grave natural, -3 semitonos aprox.
    } else {
      // robot: muy grave + distorsión con WaveShaper
      source.playbackRate.value = 0.60;

      const waveshaper = audioCtx.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = (i * 2) / 256 - 1;
        // Soft clipping suave → da textura metálica sin saturar
        curve[i] = (Math.PI + 80) * x / (Math.PI + 80 * Math.abs(x));
      }
      waveshaper.curve = curve;
      waveshaper.oversample = '4x';
      source.connect(waveshaper);

      const gainNode = audioCtx.createGain();
      gainNode.gain.value = VOLUME;
      waveshaper.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      source.start(0);
      return;
    }

    const gainNode = audioCtx.createGain();
    gainNode.gain.value = VOLUME;
    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    source.start(0);
  } catch (err) {
    console.warn('[Sound] playVoice error, fallback to HTML5 Audio:', err);
    // Fallback: reproduce sin modificar
    const audio = new Audio(`/api/tts?text=${encodeURIComponent(msg)}`);
    audio.volume = VOLUME;
    audio.play().catch(() => {});
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
