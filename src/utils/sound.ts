// src/utils/sound.ts

let audioUnlocked = false;

export const unlockTeslaAudio = () => {
  if (typeof window === 'undefined' || audioUnlocked) return;
  try {
    // Silent audio trick for Tesla Browser: plays a tiny silent MP3 in an infinite loop
    // to force the browser to keep the audio session active and route it to car speakers.
    const silentAudio = new Audio('data:audio/mp3;base64,//OExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq');
    silentAudio.loop = true;
    silentAudio.volume = 0.01;
    silentAudio.play().then(() => {
      audioUnlocked = true;
      console.log('Tesla Audio Unlocked successfully');
    }).catch(e => {
      console.warn('Silent audio play blocked. Interaction might be needed.', e);
    });
    
    // Also wake up the speechless synthesis engine
    const utterance = new SpeechSynthesisUtterance('');
    utterance.volume = 0;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.error("Audio unlock error:", err);
  }
};

export const playRadarAlert = (volume: number, type: 'safe_first' | 'safe_second' | 'danger') => {
  if (typeof window === 'undefined') return;

  try {
    const isDanger = type === 'danger';
    
    // 1. Voz sintetizada
    let msg = '';
    if (type === 'danger') {
      msg = '¡Peligro! Exceso de velocidad en radar próximo. Reduzca la velocidad.';
    } else if (type === 'safe_first') {
      msg = 'Atención, radar próximo. Velocidad correcta.';
    } else if (type === 'safe_second') {
      msg = 'Radar muy cercano. Velocidad correcta.';
    }

    const utterance = new SpeechSynthesisUtterance(msg);
    utterance.lang = 'es-ES';
    utterance.volume = volume;
    utterance.pitch = isDanger ? 1.2 : 1; 
    
    // Limpiamos colas previas para que no se acumulen
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);

    // 2. Efecto de sonido
    const audioUrl = isDanger 
      ? 'https://actions.google.com/sounds/v1/alarms/alarm_clock_beeping.ogg'
      : 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg';
    
    const audio = new Audio(audioUrl);
    audio.volume = volume;
    audio.play().catch(e => console.warn("Audio play blocked:", e));
  } catch (err) {
    console.error("Error in playRadarAlert:", err);
  }
};

export const playTestSound = (volume: number) => {
  if (typeof window === 'undefined') return;

  try {
    const msg = 'Prueba de sonido de radar. Ajusta el volumen ahora.';
    const utterance = new SpeechSynthesisUtterance(msg);
    utterance.lang = 'es-ES';
    utterance.volume = volume;
    
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);

    const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
    audio.volume = volume;
    audio.play().catch(e => console.warn("Audio play blocked:", e));
  } catch (err) {
    console.error("Error in playTestSound:", err);
  }
};

export const playPegasusAlert = (volume: number, callsign: string, altitude: number, speed_kmh: number) => {
  if (typeof window === 'undefined') return;

  try {
    const nameStr = callsign && callsign !== 'N/A' ? `llamada ${callsign}` : 'Aeronave';
    const msg = `Alerta. Objetivo aéreo en radio de 10 kilómetros. ${nameStr} detectada a ${Math.round(altitude)} metros de altura y ${Math.round(speed_kmh)} kilómetros por hora. Posible vigilancia.`;
    
    const utterance = new SpeechSynthesisUtterance(msg);
    utterance.lang = 'es-ES';
    utterance.volume = volume;
    utterance.pitch = 0.9;
    
    // Para Pegasus no cancelamos la cola de speechSynthesis por si se está cantando un radar fijo
    window.speechSynthesis.speak(utterance);

    const audio = new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock_beeping.ogg');
    audio.volume = volume;
    audio.play().catch(e => console.warn("Audio play blocked directly", e));
  } catch (err) {
    console.error("Error pegasus sound:", err);
  }
};
