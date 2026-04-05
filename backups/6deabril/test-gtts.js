const googleTTS = require('google-tts-api');
const https = require('https');

function download(url, dest) {
  return new Promise(resolve => {
    https.get(url, (res) => {
        console.log(dest + ' -> ' + res.headers['content-length']);
        resolve();
    });
  });
}

(async () => {
  // Mujer España
  const es = googleTTS.getAudioUrl('Hola', { lang: 'es', host: 'https://translate.google.com' });
  // Hombre (a veces mujer) de México
  const mx = googleTTS.getAudioUrl('Hola', { lang: 'es-MX', host: 'https://translate.google.com' });
  // Hombre (a veces mujer) de US
  const us = googleTTS.getAudioUrl('Hola', { lang: 'es-US', host: 'https://translate.google.com' });

  await download(es, 'ES');
  await download(mx, 'MX');
  await download(us, 'US');
})();
