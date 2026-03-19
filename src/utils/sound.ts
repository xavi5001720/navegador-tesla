// src/utils/sound.ts

export const playRadarAlert = (volume: number, type: 'safe' | 'danger') => {
  if (typeof window === 'undefined') return;

  try {
    const isDanger = type === 'danger';
    
    // 1. Voz sintetizada
    const msg = isDanger ? '¡Peligro! Exceso de velocidad en radar próximo' : 'Atención, radar próximo';
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
