'use client';

import { useState, useEffect, useRef } from 'react';
import { Star, Search, Loader2, Navigation, MapPin } from 'lucide-react';

interface Suggestion {
  id: string;
  name: string;
  address: string;
  position: [number, number]; // lat, lon
}

interface SearchPanelProps {
  onSearch: (query: string, coords?: [number, number]) => void;
  isLoading?: boolean;
  onOpenFavorites: () => void;
}

export default function SearchPanel({ onSearch, isLoading = false, onOpenFavorites }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined);
  // Ref para evitar que se dispare la busqueda automatica si acabamos de seleccionar
  const skipSearchRef = useRef(false); 

  useEffect(() => {
    if (query.trim().length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      const TOMTOM_KEY = process.env.NEXT_PUBLIC_TOMTOM_API_KEY;
      if (!TOMTOM_KEY) return;
      
      setIsFetchingSuggestions(true);
      try {
        const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json?key=${TOMTOM_KEY}&limit=5&language=es-ES&typeahead=true`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data && data.results) {
          const formatted = data.results.map((r: any) => ({
            id: r.id,
            name: r.poi?.name || r.address.streetName || r.address.municipality || r.address.freeformAddress || 'Destino',
            address: r.address.freeformAddress || `${r.address.municipality || ''}, ${r.address.countrySubdivision || ''}`.replace(/^, | , | $/g, ''),
            position: [r.position.lat, r.position.lon] as [number, number]
          }));
          setSuggestions(formatted);
          setShowDropdown(true);
        }
      } catch (err) {
        console.error('Error fetching autocomplete:', err);
      } finally {
        setIsFetchingSuggestions(false);
      }
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setShowDropdown(false);
      onSearch(query);
    }
  };

  const handleSuggestionClick = (s: Suggestion) => {
    skipSearchRef.current = true;
    setQuery(s.name);
    setShowDropdown(false);
    onSearch(s.name, s.position);
  };

  return (
    <div className="relative mb-2">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <Search className={`h-5 w-5 ${isFetchingSuggestions ? 'text-blue-500 animate-pulse' : 'text-gray-400'}`} />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            placeholder="¿A dónde vamos hoy?"
            className="w-full rounded-2xl border border-white/10 bg-black/70 backdrop-blur-xl shadow-2xl py-4 pl-10 pr-4 text-sm text-white placeholder:text-gray-400 hover:bg-black/80 focus:outline-none focus:border-blue-500/50 focus:bg-black/90 focus:ring-4 focus:ring-blue-500/10 transition-all"
          />
        </div>
        <button 
          type="submit"
          disabled={isLoading || !query.trim()}
          className={`group relative flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-2xl shadow-lg transition-all ${
            isLoading || !query.trim() 
              ? 'bg-black/60 backdrop-blur-md border border-white/5 cursor-not-allowed text-gray-500'
              : 'bg-blue-600 hover:bg-blue-500 hover:scale-105 active:scale-95 shadow-blue-500/20 text-white'
          }`}
          title="Buscar destino"
        >
          <Navigation className="h-5 w-5" />
        </button>

        <button 
          type="button"
          onClick={onOpenFavorites}
          disabled={isLoading}
          className={`group relative flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-2xl shadow-lg transition-all ${
            isLoading 
              ? 'bg-gray-600 opacity-50 cursor-not-allowed'
              : 'bg-amber-500/80 hover:bg-amber-400 hover:scale-105 active:scale-95 shadow-amber-500/20'
          }`}
          title="Mis favoritos"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          ) : (
            <Star className="h-5 w-5 text-white fill-white" />
          )}
        </button>
      </form>

      {/* Autocomplete Dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute top-[64px] left-0 w-[calc(100%-120px)] bg-black/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,1)] overflow-hidden z-[1001] py-2 animate-in fade-in slide-in-from-top-4 duration-200">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleSuggestionClick(s)}
              className="w-full text-left px-4 py-3 hover:bg-blue-600/20 flex flex-col gap-0.5 border-b border-white/5 last:border-0 transition-colors"
            >
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                <span className="text-white font-medium text-sm truncate">{s.name}</span>
              </div>
              <span className="text-gray-400 text-xs truncate pl-5.5 ml-[22px]">{s.address}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
