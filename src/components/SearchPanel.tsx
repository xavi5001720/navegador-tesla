'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, Search, Loader2 } from 'lucide-react';

interface SearchPanelProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
}

export default function SearchPanel({ onSearch, isLoading = false }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState('');
  const recognitionRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'es-ES';

      recognition.onstart = () => setIsListening(true);

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let currentTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            currentTranscript += event.results[i][0].transcript;
          }
        }

        const fullTranscript = finalTranscript || currentTranscript;
        setQuery(fullTranscript);

        // Si es final, disparamos búsqueda automática
        if (finalTranscript) {
          onSearchRef.current(finalTranscript);
          recognition.stop();
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Error voz:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed' || event.error === 'audio-capture' || event.error === 'service-not-allowed') {
          setMicError('El navegador del coche bloquea el micrófono por seguridad. Usa el teclado.');
        } else {
          setMicError('Error de dictado: ' + event.error);
        }
        setTimeout(() => setMicError(''), 5000);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
       // Si no soporta reconocimiento
       setMicError('Reconocimiento de voz no soportado en este navegador.');
    }

    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const toggleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setQuery(''); 
      recognitionRef.current?.start();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative mb-2 flex items-center gap-2">
      <div className="relative flex-1">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isListening ? 'Escuchando destino...' : '¿A dónde vamos hoy?'}
          className={`w-full rounded-2xl border bg-white/5 py-4 pl-12 pr-4 text-sm text-white placeholder:text-gray-500 hover:bg-white/10 focus:outline-none transition-all ${
            isListening 
            ? 'border-blue-500/50 bg-blue-500/10 ring-4 ring-blue-500/20' 
            : 'border-white/10 focus:border-blue-500/50 focus:bg-white/10 focus:ring-4 focus:ring-blue-500/10'
          }`}
        />
      </div>
      
      <button 
        type={isLoading ? "button" : "button"}
        onClick={toggleListen}
        disabled={isLoading}
        className={`group relative flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-2xl shadow-lg transition-all ${
          isLoading 
            ? 'bg-gray-600 opacity-50 cursor-not-allowed'
            : isListening 
              ? 'bg-rose-600 shadow-rose-500/25 hover:bg-rose-500 hover:scale-105 active:scale-95' 
              : 'bg-blue-600 shadow-blue-500/25 hover:bg-blue-500 hover:scale-105 active:scale-95'
        }`}
      >
        {isLoading ? (
           <Loader2 className="h-5 w-5 text-white animate-spin" />
        ) : isListening ? (
          <div className="relative flex items-center justify-center">
            <Mic className="h-5 w-5 text-white absolute" />
            <div className="h-8 w-8 animate-ping rounded-full border-2 border-white/50"></div>
          </div>
        ) : (
          <Mic className="h-5 w-5 text-white" />
        )}
      </button>
      
      {micError && (
        <div className="absolute top-16 left-0 right-0 z-50 rounded-xl bg-orange-600/90 text-white text-[11px] font-bold px-4 py-2 text-center shadow-lg border border-orange-500/50 backdrop-blur-md animate-pulse">
          {micError}
        </div>
      )}
    </form>
  );
}
