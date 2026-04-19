// src/utils/sound.ts

export type VoiceType = 'hombre' | 'mujer' | 'robot';

const VOLUME = 1.0;

let audioUnlocked = false;
let beepPlayer: HTMLAudioElement | null = null;
const audioCtx: AudioContext | null = null;

// ── Unlock audio ─────────────────────────────────────────────────────────────
export const unlockTeslaAudio = () => {
  if (typeof window === 'undefined' || audioUnlocked) return;
  try {
    if (!beepPlayer) {
      beepPlayer = new Audio();
      beepPlayer.preload = 'auto';
    }
    // Silent WAV (previo MP3 estaba roto y causaba errores de metadatos)
    const silentAudio = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
    beepPlayer.src = silentAudio;
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
    
    // Reproduce el MP3 (v=3 fuerza a saltar la caché persistente del navegador)
    const url = `/api/tts?text=${encodeURIComponent(msg)}&lang=${lang}&v=3`;
    const audio = new Audio(url);
    audio.volume = VOLUME;
    audio.play().catch(e => console.warn('[Sound] Voice blocked:', e));
  } catch (err) {
    console.error('[Sound] playVoice error:', err);
  }
};

// ── Public API ────────────────────────────────────────────────────────────────
export const playRadarAlert = (
  voiceType: VoiceType, 
  type: 'safe_first' | 'safe_second' | 'danger' | 'info', 
  radarType: 'fixed' | 'mobile_zone' | 'camera' | 'section' = 'fixed',
  audioMode: 'voice' | 'beep' = 'voice'
) => {
  if (typeof window === 'undefined') return;
  try {
    // Modo Pitido (Beep Mode)
    if (audioMode === 'beep') {
      if (type === 'danger') playBeep('alarm_clock_beeping');
      else if (type === 'info') playBeep('beep_short'); // Tono simple para zonas
      else {
        // Doble pitido simple para fija/tramo correctos
        playBeep('beep_short');
        setTimeout(() => playBeep('beep_short'), 400);
      }
      return; 
    }

    // Modo Voz Defecto
    playBeep(type === 'danger' ? 'alarm_clock_beeping' : 'beep_short');

    let msg = '';
    let radarStr = 'radar';
    if (radarType === 'section') radarStr = 'radar de tramo';
    else if (radarType === 'camera') radarStr = 'cámara de vigilancia';
    else if (radarType === 'mobile_zone') radarStr = 'zona de radar móvil';

    if (type === 'danger')        msg = `Peligro. Exceso de velocidad en ${radarStr} próximo. Reduzca la velocidad.`;
    else if (type === 'safe_first') {
      if (radarType === 'mobile_zone') msg = 'Atención, entrando en zona probable de radar móvil.';
      else msg = `Atención, ${radarStr} próximo. Velocidad correcta.`;
    }
    else if (type === 'safe_second')  msg = `${radarStr} muy cercano. Velocidad correcta.`;
    else if (type === 'info') msg = `Atención, ${radarStr}.`;

    if (msg) playVoice(msg, voiceType);
  } catch (err) {
    console.error('[Sound] playRadarAlert error:', err);
  }
};

export const playTestSound = (voiceType: VoiceType, audioMode: 'voice' | 'beep' = 'voice') => {
  if (typeof window === 'undefined') return;
  try {
    if (audioMode === 'beep') {
      playBeep('beep_short');
      setTimeout(() => playBeep('beep_short'), 400);
      setTimeout(() => playBeep('alarm_clock_beeping'), 800);
      return;
    }
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

export const playWaypointAlert = (voiceType: VoiceType, stopNumber: number, distanceM: number) => {
  if (typeof window === 'undefined') return;
  try {
    playBeep('beep_short');
    const dist = distanceM < 200 ? 'muy cercana' : `a ${Math.round(distanceM)} metros`;
    const msg = `Parada ${stopNumber} ${dist}. Prepárese para detenerse.`;
    playVoice(msg, voiceType);
  } catch (err) {
    console.error('[Sound] playWaypointAlert error:', err);
  }
};

export const playTrafficJamAlert = (voiceType: VoiceType, distanceKm: number) => {
  if (typeof window === 'undefined') return;
  try {
    playBeep('alarm_clock_beeping');
    const distStr = distanceKm < 1 ? 'menos de un kilómetro' : `${Math.round(distanceKm)} kilómetros`;
    const msg = `¡Precaución! Tráfico detenido a ${distStr}. Por favor, reduzca su velocidad. Atasco detectado.`;
    playVoice(msg, voiceType);
  } catch (err) {
    console.error('[Sound] playTrafficJamAlert error:', err);
  }
};

export const playWeatherAlert = (voiceType: VoiceType, condition: string) => {
  if (typeof window === 'undefined') return;
  try {
    playBeep('beep_short');
    let conditionStr = 'precipitaciones';
    if (condition === 'Rain') conditionStr = 'lluvia fuerte';
    if (condition === 'Snow') conditionStr = 'nieve';
    if (condition === 'Thunderstorm') conditionStr = 'tormenta eléctrica';
    
    const msg = `Atención. El radar meteorológico detecta ${conditionStr} en su ruta más adelante. Extreme las precauciones.`;
    playVoice(msg, voiceType);
  } catch (err) {
    console.error('[Sound] playWeatherAlert error:', err);
  }
};
