// src/utils/sound.ts

export type VoiceType = 'hombre' | 'mujer' | 'robot';

const VOLUME = 1.0;

let audioUnlocked = false;
let beepPlayer: HTMLAudioElement | null = null;
// ── Unlock audio ─────────────────────────────────────────────────────────────
export const unlockTeslaAudio = () => {
  if (typeof window === 'undefined' || audioUnlocked) return;
  try {
    // Inicializar AudioContext en la primera interacción
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }

    if (!beepPlayer) {
      beepPlayer = new Audio();
      beepPlayer.preload = 'auto';
    }
    // Silent WAV (previo MP3 estaba roto y causaba errores de metadatos)
    const silentAudio = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
    beepPlayer.src = silentAudio;
    beepPlayer.play().then(() => beepPlayer?.pause()).catch(() => {});
    audioUnlocked = true;
    console.log('[Sound] Audio and WebAudio Context unlocked');
  } catch (err) {
    console.error('[Sound] Unlock error:', err);
  }
};

// ── Beep ─────────────────────────────────────────────────────────────────────
let audioCtx: AudioContext | null = null;

const getAudioContext = () => {
  if (!audioCtx && typeof window !== 'undefined') {
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
};

const playSyntheticBeep = (type: 'beep_short' | 'alarm_clock_beeping') => {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Reanudar contexto si está suspendido (política de navegadores)
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  if (type === 'beep_short') {
    // Tono simple y corto (880Hz - La5)
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  } else {
    // Tono de alarma más agresivo (Doble tono rápido)
    osc.type = 'square';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.45);
  }
};

let currentVoiceAudio: HTMLAudioElement | null = null;

// ── Voice System (Hybrid: Native for Robot, Proxy for Humans) ────────────────
const playVoice = (msg: string, voiceType: VoiceType) => {
  if (typeof window === 'undefined') return;

  // A. MODO ROBOT: SpeechSynthesis Nativo (Más rápido, menos natural)
  if (voiceType === 'robot') {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(msg);
      utterance.lang = 'es-ES';
      utterance.pitch = 1.5;
      utterance.rate = 1.2;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('[Sound] SpeechSynthesis error:', err);
    }
    return;
  }

  // B. MODO MUJER/HOMBRE: Google TTS Proxy (Alta Calidad)
  try {
    // FIX ANTI-ATASCO: Detener cualquier audio anterior antes de empezar el nuevo
    if (currentVoiceAudio) {
      currentVoiceAudio.pause();
      currentVoiceAudio.currentTime = 0;
    }

    let lang = 'es'; // Mujer (es-ES) por defecto
    if (voiceType === 'hombre') lang = 'es-US';

    const url = `/api/tts?text=${encodeURIComponent(msg)}&lang=${lang}&v=4`;
    currentVoiceAudio = new Audio(url);
    currentVoiceAudio.volume = VOLUME;
    currentVoiceAudio.play().catch(e => console.warn('[Sound] MP3 Voice blocked:', e));
  } catch (err) {
    console.error('[Sound] playVoice (MP3) error:', err);
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
      if (type === 'danger') playSyntheticBeep('alarm_clock_beeping');
      else if (type === 'info') playSyntheticBeep('beep_short'); // Tono simple para zonas
      else {
        // Doble pitido simple para fija/tramo correctos
        playSyntheticBeep('beep_short');
        setTimeout(() => playSyntheticBeep('beep_short'), 400);
      }
      return; 
    }

    // Modo Voz Defecto
    playSyntheticBeep(type === 'danger' ? 'alarm_clock_beeping' : 'beep_short');

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
      playSyntheticBeep('beep_short');
      setTimeout(() => playSyntheticBeep('beep_short'), 400);
      setTimeout(() => playSyntheticBeep('alarm_clock_beeping'), 800);
      return;
    }
    playSyntheticBeep('beep_short');
    playVoice('Prueba de sonido completada. Sistema de alertas activo.', voiceType);
  } catch (err) {
    console.error('[Sound] playTestSound error:', err);
  }
};

export const playPegasusAlert = (voiceType: VoiceType, callsign: string, altitude: number, speed_kmh: number) => {
  if (typeof window === 'undefined') return;
  try {
    playSyntheticBeep('alarm_clock_beeping');
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
