// src/utils/sound.ts

export type VoiceType = 'hombre' | 'mujer' | 'robot';

export interface AlertPreferences {
  fixedRadars: boolean;
  mobileRadars: boolean;
  aircraft: boolean;
  traffic: boolean;
  weather: boolean;
  stops: boolean;
}

const VOLUME = 1.0;

let audioUnlocked = false;
let persistentVoiceAudio: HTMLAudioElement | null = null;

const getPersistentVoiceAudio = () => {
  if (!persistentVoiceAudio && typeof window !== 'undefined') {
    persistentVoiceAudio = new Audio();
  }
  return persistentVoiceAudio;
};

// ── Unlock audio ─────────────────────────────────────────────────────────────
export const unlockTeslaAudio = () => {
  if (typeof window === 'undefined' || audioUnlocked) return;
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }

    const player = getPersistentVoiceAudio();
    if (player) {
      const silentAudio = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
      player.src = silentAudio;
      player.play().then(() => player.pause()).catch(() => {});
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance('');
      window.speechSynthesis.speak(u);
    }

    audioUnlocked = true;
    console.log('[Sound] Persistent Audio and Voice Player unlocked');
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

  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  if (type === 'beep_short') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  } else {
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

let isSpeaking = false;

export const isVoiceSpeaking = () => isSpeaking;

const playVoice = (msg: string, voiceType: VoiceType) => {
  if (typeof window === 'undefined') return;

  // A. MODO ROBOT: SpeechSynthesis Nativo
  if (voiceType === 'robot') {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(msg);
      utterance.lang = 'es-ES';
      utterance.pitch = 1.5;
      utterance.rate = 1.2;
      isSpeaking = true;
      utterance.onend = () => { isSpeaking = false; };
      utterance.onerror = () => { isSpeaking = false; };
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('[Sound] SpeechSynthesis error:', err);
      isSpeaking = false;
    }
    return;
  }

  // B. MODO MUJER/HOMBRE: Google TTS Proxy (con reproductor persistente)
  try {
    const player = getPersistentVoiceAudio();
    if (!player) return;

    player.pause();
    player.currentTime = 0;

    let lang = 'es';
    if (voiceType === 'hombre') lang = 'es-US';

    const url = `/api/tts?text=${encodeURIComponent(msg)}&lang=${lang}&v=4`;
    player.src = url;
    player.volume = VOLUME;
    isSpeaking = true;
    player.onended = () => { isSpeaking = false; };
    player.onerror = () => { isSpeaking = false; };
    player.play().catch(e => {
      console.warn('[Sound] MP3 Voice blocked by browser policy, using native TTS fallback:', e);
      isSpeaking = false;
      try {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(msg);
          utterance.lang = 'es-ES';
          utterance.rate = 1.0;
          window.speechSynthesis.speak(utterance);
        }
      } catch (errFallback) {
        console.error('[Sound] Native fallback error:', errFallback);
      }
    });
  } catch (err) {
    console.error('[Sound] playVoice (MP3) error:', err);
    isSpeaking = false;
  }
};

// ── Public API ────────────────────────────────────────────────────────────────
export const playRadarAlert = (
  voiceType: VoiceType, 
  type: 'safe_30s' | 'safe_10s' | 'safe_passing' | 'danger' | 'info' | 'safe_first' | 'safe_second', 
  radarType: 'fixed' | 'mobile_zone' | 'camera' | 'section' | 'mobile' | 'community_mobile' = 'fixed',
  audioMode: 'voice' | 'beep' = 'voice',
  speedLimit?: number,
  distanceM?: number,
  currentSpeed?: number
) => {
  if (typeof window === 'undefined') return;
  try {
    if (audioMode === 'beep') {
      if (type === 'danger') playSyntheticBeep('alarm_clock_beeping');
      else if (type === 'info') playSyntheticBeep('beep_short');
      else {
        playSyntheticBeep('beep_short');
        setTimeout(() => playSyntheticBeep('beep_short'), 400);
      }
      return; 
    }

    playSyntheticBeep(type === 'danger' ? 'alarm_clock_beeping' : 'beep_short');

    let radarStr = 'radar fijo';
    if (radarType === 'section') radarStr = 'radar de tramo';
    else if (radarType === 'camera') radarStr = 'cámara de vigilancia';
    else if (radarType === 'mobile_zone' || radarType === 'mobile' || radarType === 'community_mobile') radarStr = 'zona de radar móvil';

    const limitStr = speedLimit ? ` de ${speedLimit}` : '';
    const distStr = distanceM != null
      ? (distanceM >= 1000 ? ` a ${(distanceM / 1000).toFixed(1)} kilómetros` : ` a ${Math.round(distanceM)} metros`)
      : '';
    const currentSpdStr = currentSpeed ? `. Vas a ${Math.round(currentSpeed)}` : '';

    let msg = '';
    if (type === 'danger') {
      // Mensaje corto para que no se solape en la repetición
      msg = `¡Radar${limitStr}${distStr}! Vas a ${Math.round(currentSpeed || 0)}, reduce velocidad.`;
    }
    else if (type === 'safe_30s' || type === 'safe_first') {
      if (radarStr === 'zona de radar móvil') {
        msg = `Posible zona de radar móvil${limitStr}${distStr}${currentSpdStr}.`;
      } else {
        msg = `${radarStr.charAt(0).toUpperCase() + radarStr.slice(1)}${limitStr}${distStr}${currentSpdStr}, velocidad correcta.`;
      }
    }
    else if (type === 'safe_10s' || type === 'safe_second') {
      msg = `${radarStr.charAt(0).toUpperCase() + radarStr.slice(1)}${limitStr}${distStr}, velocidad correcta.`;
    }
    else if (type === 'safe_passing') {
      msg = `Pasando ${radarStr}${limitStr}, velocidad correcta.`;
    }
    else if (type === 'info') {
      msg = `Atención, ${radarStr}${limitStr}.`;
    }

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

export const playPegasusAlert = (voiceType: VoiceType, callsign: string, altitude: number, speed_kmh: number, distanceKm: number) => {
  if (typeof window === 'undefined') return;
  try {
    playSyntheticBeep('alarm_clock_beeping');
    const msg = `Detectada aeronave a ${distanceKm.toFixed(1)} kilómetros. Altura de la aeronave ${Math.round(altitude)}, velocidad de la aeronave ${Math.round(speed_kmh)}.`;
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
    playSyntheticBeep('alarm_clock_beeping');
    const distStr = distanceKm < 1 ? 'menos de un kilómetro' : `${Math.round(distanceKm)} kilómetros`;
    const msg = `Tráfico lento a ${distStr}.`;
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
