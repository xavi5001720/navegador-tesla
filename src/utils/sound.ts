// src/utils/sound.ts

// Global AudioContext and Buffers
let audioCtx: AudioContext | null = null;
let audioUnlocked = false;

const BUFFERS: Record<string, AudioBuffer | null> = {
  beep_short: null,
  alarm_clock_beeping: null
};

// Rutas de audio
const AUDIO_URLS = {
  beep_short: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg',
  alarm_clock_beeping: 'https://actions.google.com/sounds/v1/alarms/alarm_clock_beeping.ogg'
};

// Pre-carga los sonidos de la red para decodificarlos en memoria
const preloadAudioBuffer = async (name: keyof typeof AUDIO_URLS) => {
  if (!audioCtx) return;
  try {
    const response = await fetch(AUDIO_URLS[name]);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    BUFFERS[name] = audioBuffer;
  } catch (err) {
    console.error(`Error loading audio ${name}:`, err);
  }
};

export const unlockTeslaAudio = () => {
  if (typeof window === 'undefined' || audioUnlocked) return;
  
  try {
    // Definición estándar y con compatibilidad WebKit para navegadores antiguos
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      console.warn("Web Audio API no soportada en este navegador");
      return;
    }

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }

    // Si estaba suspendido, lo reactivamos
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(e => console.warn("No se pudo reanudar el AudioContext:", e));
    }

    // 1. Oscilador inaudible para mantener activo el DSP del coche
    // Esto evita que el amplificador del coche se duerma y que se pierda
    // el inicio (o la totalidad) de los pitidos cortos por retardo.
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.value = 1; // Frecuencia muy baja, inaudible
    gainNode.gain.value = 0.001; // Volumen casi nulo
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    
    // 2. Precargamos los audios
    preloadAudioBuffer('beep_short');
    preloadAudioBuffer('alarm_clock_beeping');

    audioUnlocked = true;
    console.log('Tesla Audio Unlocked successfully via Web Audio API');
    
    // Despertamos también speechSynthesis
    const utterance = new SpeechSynthesisUtterance('');
    utterance.volume = 0;
    window.speechSynthesis.speak(utterance);
    
  } catch (err) {
    console.error("Audio unlock error:", err);
  }
};

// Función auxiliar para tocar un buffer
const playBuffer = (bufferName: keyof typeof AUDIO_URLS, volume: number) => {
  if (!audioCtx) return;
  
  // Si el navegador suspendió el contexto (e.g. al mandar la app a segundo plano), intentamos revivirlo
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  
  const buffer = BUFFERS[bufferName];
  if (!buffer) {
    console.warn(`Buffer para ${bufferName} no precargado aún.`);
    // Fallback improvisado a HTML5 si aún no está cargado (solo precaución)
    const fallbackAudio = new Audio(AUDIO_URLS[bufferName]);
    fallbackAudio.volume = volume;
    fallbackAudio.play().catch(() => {});
    return;
  }

  try {
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;

    const gainNode = audioCtx.createGain();
    gainNode.gain.value = Math.max(0, Math.min(1, volume)); // clamp entre 0 y 1

    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    source.start(0);
  } catch (err) {
    console.error("Error playing buffer:", err);
  }
};

export const playRadarAlert = (volume: number, type: 'safe_first' | 'safe_second' | 'danger') => {
  if (typeof window === 'undefined') return;

  try {
    const isDanger = type === 'danger';
    
    // 1. Efecto de sonido inmediato (sin red, desde memoria con Web Audio API)
    if (isDanger) {
      playBuffer('alarm_clock_beeping', volume);
    } else {
      playBuffer('beep_short', volume);
    }

    // 2. Voz sintetizada (Avisos de voz para quien los soporte bien)
    let msg = '';
    if (type === 'danger') {
      msg = '¡Peligro! Exceso de velocidad en radar próximo. Reduzca la velocidad.';
    } else if (type === 'safe_first') {
      msg = 'Atención, radar próximo. Velocidad correcta.';
    } else if (type === 'safe_second') {
      msg = 'Radar muy cercano. Velocidad correcta.';
    }

    if (msg) {
      const utterance = new SpeechSynthesisUtterance(msg);
      utterance.lang = 'es-ES';
      utterance.volume = volume;
      utterance.pitch = isDanger ? 1.2 : 1; 
      
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  } catch (err) {
    console.error("Error in playRadarAlert:", err);
  }
};

export const playTestSound = (volume: number) => {
  if (typeof window === 'undefined') return;

  try {
    playBuffer('beep_short', volume);

    const msg = 'Prueba de sonido de radar. Ajusta el volumen ahora.';
    const utterance = new SpeechSynthesisUtterance(msg);
    utterance.lang = 'es-ES';
    utterance.volume = volume;
    
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.error("Error in playTestSound:", err);
  }
};

export const playPegasusAlert = (volume: number, callsign: string, altitude: number, speed_kmh: number) => {
  if (typeof window === 'undefined') return;

  try {
    playBuffer('alarm_clock_beeping', volume);

    const nameStr = callsign && callsign !== 'N/A' ? `llamada ${callsign}` : 'Aeronave';
    const msg = `Alerta. Objetivo aéreo en radio de 10 kilómetros. ${nameStr} detectada a ${Math.round(altitude)} metros de altura y ${Math.round(speed_kmh)} kilómetros por hora. Posible vigilancia.`;
    
    const utterance = new SpeechSynthesisUtterance(msg);
    utterance.lang = 'es-ES';
    utterance.volume = volume;
    utterance.pitch = 0.9;
    
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.error("Error pegasus sound:", err);
  }
};
