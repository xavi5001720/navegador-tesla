let audioUnlocked = false;

let beepPlayer: HTMLAudioElement | null = null;
let voicePlayer: HTMLAudioElement | null = null;

export const unlockTeslaAudio = () => {
  if (typeof window === 'undefined' || audioUnlocked) return;
  
  try {
    if (!beepPlayer) {
      beepPlayer = new Audio();
      beepPlayer.preload = 'auto';
    }
    if (!voicePlayer) {
      voicePlayer = new Audio();
      voicePlayer.preload = 'auto';
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
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=es&q=${encodeURIComponent(msg)}`;
  
  // Añadimos un timestamp al final para evitar caché agresiva del navegador si la URL es idéntica siempre
  voicePlayer.src = url + '&_=' + Date.now();
  voicePlayer.volume = Math.max(0, Math.min(1, volume));
  voicePlayer.play().catch(e => console.warn("Voice blocked:", e));
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
        // Quitamos el setTimeout para no perder el token de interacción del usuario
        playVoice(msg, volume);
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
    // Sin setTimeout para asegurar que se dispara con la interacción del botón
    playVoice(msg, volume);
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
    
    playVoice(msg, volume);
  } catch (err) {
    console.error("Error pegasus sound:", err);
  }
};
