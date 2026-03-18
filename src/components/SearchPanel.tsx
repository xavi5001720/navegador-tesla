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
  const recognitionRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'es-ES';

      recognition.onstart = () => setIsListening(true);

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        setQuery(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error('Error voz:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
         setIsListening(false);
         // Al terminar de escuchar, si hay texto, lanzamos búsqueda automática
         if (query.trim()) {
            onSearch(query);
         }
      };

      recognitionRef.current = recognition;
    }
  }, [query, onSearch]);

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
    </form>
  );
}
