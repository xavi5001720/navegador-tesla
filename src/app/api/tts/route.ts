import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Edge config
const EDGE_WS_URL = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4';

// No dependemos de librerías extrañas de NextJS Edge, usamos Web Crypto
function getHeadersAndData(voice: string, text: string, rate: string, pitch: string) {
  const reqId = crypto.randomUUID().replace(/-/g, '');
  
  const headers = [
    `X-RequestId:${reqId}`,
    `Content-Type:application/ssml+xml`,
    `X-Timestamp:${new Date().toISOString()}`,
    `Path:ssml`
  ].join('\r\n');
  
  const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='es'>
    <voice name='${voice}'>
      <prosody rate='${rate}' pitch='${pitch}'>
        ${text}
      </prosody>
    </voice>
  </speak>`;

  return `${headers}\r\n\r\n${ssml}`;
}

// Fallback manual a Google
async function fetchGoogleTTS(text: string, lang: string) {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${lang}&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }});
  return await res.arrayBuffer();
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const text = searchParams.get('text');
  const lang = searchParams.get('lang') || 'es'; // es, es-US, es-MX
  
  if (!text) {
    return NextResponse.json({ error: 'Text parameter is required' }, { status: 400 });
  }

  // Next.js Edge Runtime 14+ soporta global WebSocket y fetch nativos
  try {
    let voice = 'es-ES-ElviraNeural'; // Mujer España (muy natural)
    let rate = '+0%';
    let pitch = '+0Hz';
    
    if (lang === 'es-US') {
      voice = 'es-ES-AlvaroNeural'; // Hombre nativo España clarísimo
      pitch = '-5Hz'; 
    } else if (lang === 'es-MX') {
      voice = 'es-MX-JorgeNeural'; // Robot (Hombre neutro muy bajado de tono)
      rate = '-10%';  // Habla un poco más lento
      pitch = '-20Hz'; // Voz anormalmente grave y lenta, efecto robot suave
    }

    return new Promise<NextResponse>((resolve) => {
      let resolved = false;
      const audioChunks: Uint8Array[] = [];
      
      const ws = new WebSocket(EDGE_WS_URL);

      const doResolve = (data: ArrayBuffer | Uint8Array, type: string) => {
        if (resolved) return;
        resolved = true;
        if (ws.readyState === WebSocket.OPEN) ws.close();
        
        // Ensure data is ArrayBuffer or Buffer since NextResponse needs BodyInit
        const payload = data instanceof Uint8Array ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data;
        
        resolve(new NextResponse(payload as BodyInit, {
          status: 200,
          headers: {
            'Content-Type': type,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        }));
      };

      const doFallback = async () => {
        if (resolved) return;
        console.warn(`[TTS] Edge failed or timeout, falling back to Google TTS for lang: ${lang}`);
        try {
          const ab = await fetchGoogleTTS(text, lang);
          doResolve(ab, 'audio/mpeg');
        } catch(e) {
          if(!resolved) {
            resolved = true;
            resolve(NextResponse.json({ error: 'All TTS engines failed' }, { status: 500 }));
          }
        }
      };

      // Timer de seguridad: 4 segundos máximo para Edge
      const timer = setTimeout(doFallback, 4000);

      ws.onopen = () => {
        const configMsg = `X-Timestamp:${new Date().toISOString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`;
        ws.send(configMsg);

        const ssmlMsg = getHeadersAndData(voice, text, rate, pitch);
        ws.send(ssmlMsg);
      };

      ws.onmessage = async (event: MessageEvent) => {
        if (typeof event.data === 'string') {
          if (event.data.includes('Path:turn.end')) {
            clearTimeout(timer);
            const totalLen = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
            const merged = new Uint8Array(totalLen);
            let offset = 0;
            for (const chunk of audioChunks) {
              merged.set(chunk, offset);
              offset += chunk.length;
            }
            if (merged.length > 0) {
              doResolve(merged, 'audio/mpeg');
            } else {
              doFallback();
            }
          }
        } else if (event.data instanceof Blob) {
           const ab = await event.data.arrayBuffer();
           const view = new Uint8Array(ab);
           // Separator \r\n\r\n is [13, 10, 13, 10]
           // The audio is after the header
           let sep = -1;
           for(let i=0; i < view.length - 3; i++) {
             if(view[i]===13 && view[i+1]===10 && view[i+2]===13 && view[i+3]===10) {
               sep = i; break;
             }
           }
           if(sep !== -1) {
             audioChunks.push(view.subarray(sep + 4));
           }
        } else if (event.data instanceof ArrayBuffer) {
           const view = new Uint8Array(event.data);
           let sep = -1;
           for(let i=0; i < view.length - 3; i++) {
             if(view[i]===13 && view[i+1]===10 && view[i+2]===13 && view[i+3]===10) {
               sep = i; break;
             }
           }
           if(sep !== -1) {
             audioChunks.push(view.subarray(sep + 4));
           }
        }
      };

      ws.onerror = (e) => {
        console.error('[TTS] WS Error:', e);
        clearTimeout(timer);
        doFallback();
      };
      
      ws.onclose = () => {
         if (!resolved && audioChunks.length === 0) {
            clearTimeout(timer);
            doFallback();
         }
      };
    });

  } catch (error) {
    console.error('Error proxying TTS:', error);
    return NextResponse.json({ error: 'Failed to fetch TTS' }, { status: 500 });
  }
}
