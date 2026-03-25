// src/utils/sound.ts

let audioUnlocked = false;

// Instanciar reproductores globales de HTML5 Audio para reusar y esquivar bloqueos de autoplay
let beepPlayer: HTMLAudioElement | null = null;
let voicePlayer: HTMLAudioElement | null = null;

export const unlockTeslaAudio = () => {
  if (typeof window === 'undefined' || audioUnlocked) return;
  
  try {
    // Ya no usamos Web Audio API ("AudioContext") con osciladores continuos 
    // para evitar que el navegador del coche se apropie permanentemente 
    // de la sesión multimedia y pare tu música de Spotify.

    if (!beepPlayer) {
      beepPlayer = new Audio();
      beepPlayer.preload = 'auto'; // Precarga para evitar demoras
    }
    if (!voicePlayer) {
      voicePlayer = new Audio();
      voicePlayer.preload = 'auto'; // Precarga
    }

    // Truco clásico de "reproducir y pausar" en la primera interacción 
    // para conseguir el permiso del navegador para saltarse el autoplay-blocking.
    // Usamos el archivo MP3 silencioso Base64 cortísimo
    const silentMp3 = 'data:audio/mp3;base64,//OExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';
    
    beepPlayer.src = silentMp3;
    beepPlayer.play().then(() => {
      beepPlayer?.pause();
    }).catch(() => {});

    voicePlayer.src = silentMp3;
    voicePlayer.play().then(() => {
      voicePlayer?.pause();
    }).catch(() => {});

    audioUnlocked = true;
    console.log('Tesla Audio Unlocked successfully via HTML5 Audio and TTS Proxy');
  } catch (err) {
    console.error("Audio unlock error:", err);
  }
};

const playBeep = (type: 'beep_short' | 'alarm_clock_beeping', volume: number) => {
  if (!beepPlayer) return;
  const url = type === 'beep_short' 
    ? 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg'
    : 'https://actions.google.com/sounds/v1/alarms/alarm_clock_beeping.ogg';
    
  beepPlayer.src = url;
  beepPlayer.volume = Math.max(0, Math.min(1, volume));
  beepPlayer.play().catch(e => console.warn("Beep blocked:", e));
};

const playVoice = (msg: string, volume: number) => {
  if (!voicePlayer) return;
  // TRUCO MAESTRO: Como el "SpeechSynthesis" interno del Chromium de 
  // Tesla no tiene enrutado el audio, usamos el endpoint de Google Translate 
  // que nos devuelve un MP3 real con la voz que queremos.
  // El coche reproducirá la voz igual que lo hace con el audio de un vídeo de Youtube.
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=es&q=${encodeURIComponent(msg)}`;
  
  voicePlayer.src = url;
  voicePlayer.volume = Math.max(0, Math.min(1, volume));
  voicePlayer.play().catch(e => console.warn("Voice blocked:", e));
};

export const playRadarAlert = (volume: number, type: 'safe_first' | 'safe_second' | 'danger') => {
  if (typeof window === 'undefined') return;

  try {
    const isDanger = type === 'danger';
    
    // 1. Efecto de sonido inmediato
    playBeep(isDanger ? 'alarm_clock_beeping' : 'beep_short', volume);

    // 2. Voz usando Google TTS (Audio MP3 de verdad)
    let msg = '';
    if (type === 'danger') {
      msg = 'Peligro. Exceso de velocidad en radar próximo. Reduzca la velocidad.';
    } else if (type === 'safe_first') {
      msg = 'Atención, radar próximo. Velocidad correcta.';
    } else if (type === 'safe_second') {
      msg = 'Radar muy cercano. Velocidad correcta.';
    }

    if (msg) {
        // Le damos un pequeño delay (800ms) a la voz para que suene justo al terminar o mezclar con el pitido.
        // Además, esto le da unas fracciones de segundo al DSP del coche para despertar 
        // con el primer pitido, asegurando que no se coma la primera palabra.
        setTimeout(() => {
            playVoice(msg, volume);
        }, 800);
    }
  } catch (err) {
    console.error("Error in playRadarAlert:", err);
  }
};

export const playTestSound = (volume: number) => {
  if (typeof window === 'undefined') return;

  try {
    playBeep('beep_short', volume);

    const msg = 'Prueba de sonido de radar completada. Ajusta tu volumen.';
    setTimeout(() => {
        playVoice(msg, volume);
    }, 800);
  } catch (err) {
    console.error("Error in playTestSound:", err);
  }
};

export const playPegasusAlert = (volume: number, callsign: string, altitude: number, speed_kmh: number) => {
  if (typeof window === 'undefined') return;

  try {
    playBeep('alarm_clock_beeping', volume);

    const nameStr = callsign && callsign !== 'N/A' ? `llamada ${callsign}` : 'Aeronave';
    const msg = `Alerta. Objetivo aéreo. ${nameStr} detectada a ${Math.round(altitude)} metros de altura. Posible vigilancia.`;
    
    setTimeout(() => {
        playVoice(msg, volume);
    }, 800);
  } catch (err) {
    console.error("Error pegasus sound:", err);
  }
};
