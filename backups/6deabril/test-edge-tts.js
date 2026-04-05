const { EdgeTTS } = require('edge-tts');
async function test() {
  const tts = new EdgeTTS();
  const voices = await tts.getVoices();
  const esVoices = voices.filter(v => v.Locale.startsWith('es-'));
  console.log("Voces en español:");
  esVoices.forEach(v => console.log(`- ${v.Name} (${v.Gender})`));
}
test();
