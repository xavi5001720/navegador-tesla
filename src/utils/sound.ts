// src/utils/sound.ts

let audioUnlocked = false;

// Instanciar reproductores globales de HTML5 Audio para reusar y esquivar bloqueos de autoplay
let beepPlayer: HTMLAudioElement | null = null;
let voicePlayer: HTMLAudioElement | null = null;

export const unlockTeslaAudio = () => {
  if (typeof window === 'undefined' || audioUnlocked) return;
  
  try {
    if (!beepPlayer) {
      beepPlayer = new Audio();
      beepPlayer.preload = 'auto'; // Precarga
    }
    if (!voicePlayer) {
      voicePlayer = new Audio();
      voicePlayer.preload = 'auto'; // Precarga
    }

    const silentMp3 = 'data:audio/mp3;base64,//OExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';
    
    beepPlayer.src = silentMp3;
    beepPlayer.play().then(() => {
      beepPlayer?.pause();
    }).catch(() => {});

    voicePlayer.src = silentMp3;
    voicePlayer.play().then(() => {
      voicePlayer?.pause();
    }).catch(() => {});

    // Despertamos también speechSynthesis por si acaso para navegadores normales que sí lo soporten
    const utterance = new SpeechSynthesisUtterance('');
    utterance.volume = 0;
    window.speechSynthesis.speak(utterance);

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
  // 1. Intentamos hablar con el motor nativo del navegador (funciona perfecto en Móvil y PC)
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(msg);
      utterance.lang = 'es-ES';
      utterance.volume = volume;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("SpeechSynthesis error:", e);
    }
  }

  // 2. Sistema de contingencia para Tesla:
  // Como el Tesla no suele hablar por SpeechSynthesis nativo, 
  // reproducimos en paralelo el MP3 que generamos en nuestro propio servidor backend (proxy)
  if (!voicePlayer) return;
  
  // Usamos la ruta API local (el servidor Next.js se encarga de saltarse las restricciones de Google)
  const url = `/api/tts?text=${encodeURIComponent(msg)}`;
  
  voicePlayer.src = url;
  voicePlayer.volume = Math.max(0, Math.min(1, volume));
  voicePlayer.play().catch(e => console.warn("Voice Player MP3 blocked:", e));
};

export const playRadarAlert = (volume: number, type: 'safe_first' | 'safe_second' | 'danger') => {
  if (typeof window === 'undefined') return;

  try {
    const isDanger = type === 'danger';
    
    playBeep(isDanger ? 'alarm_clock_beeping' : 'beep_short', volume);

    let msg = '';
    if (type === 'danger') {
      msg = 'Peligro. Exceso de velocidad en radar próximo. Reduzca la velocidad.';
    } else if (type === 'safe_first') {
      msg = 'Atención, radar próximo. Velocidad correcta.';
    } else if (type === 'safe_second') {
      msg = 'Radar muy cercano. Velocidad correcta.';
    }

    if (msg) {
        // En navegadores de PC la síntesis nativa y el MP3 sonarían a la vez (eco),
        // pero en el teléfono/PC prevalece el nativo.
        // Dado que solo nos importa el coche, la solución híbrida asegura que suene.
        playVoice(msg, Math.max(0, volume - 0.2)); 
    }
  } catch (err) {
    console.error("Error in playRadarAlert:", err);
  }
};

export const playTestSound = (volume: number) => {
  if (typeof window === 'undefined') return;

  try {
    playBeep('beep_short', volume);

    const msg = 'Prueba de sonido completada. Ajusta el volumen a tu gusto.';
    playVoice(msg, Math.max(0, volume - 0.2));
  } catch (err) {
    console.error("Error in playTestSound:", err);
  }
};

export const playPegasusAlert = (volume: number, callsign: string, altitude: number, speed_kmh: number) => {
  if (typeof window === 'undefined') return;

  try {
    playBeep('alarm_clock_beeping', volume);

    const nameStr = callsign && callsign !== 'N/A' ? `llamada ${callsign}` : 'Una Aeronave';
    const msg = `Alerta Pegasus. ${nameStr} detectada a ${Math.round(altitude)} metros de altura. Velocidad ${Math.round(speed_kmh)} kilómetros por hora. Posible vigilancia.`;
    
    playVoice(msg, Math.max(0, volume - 0.2));
  } catch (err) {
    console.error("Error pegasus sound:", err);
  }
};
