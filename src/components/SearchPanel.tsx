'use client';

import { useState, useEffect, useRef } from 'react';
import { Star, Search, Loader2, Navigation, MapPin, SlidersHorizontal, ChevronUp } from 'lucide-react';

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
  
  // Filtros Avanzados
  const [showFilters, setShowFilters] = useState(false);
  const [cityFilter, setCityFilter] = useState('');
  const [postalFilter, setPostalFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('España');

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
      
      const advancedQuery = `${query} ${postalFilter} ${cityFilter} ${countryFilter}`.trim();

      setIsFetchingSuggestions(true);
      try {
        const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(advancedQuery)}.json?key=${TOMTOM_KEY}&limit=5&language=es-ES&typeahead=true`;
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
  }, [query, postalFilter, cityFilter, countryFilter]);

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
            onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); setShowFilters(false); }}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            placeholder={showFilters ? "Calle..." : "¿A dónde vamos?"}
            autoComplete="no-autocomplete-please"
            name="tesla-search-field-obscure"
            id="tesla-search-field-obscure"
            autoCorrect="off"
            spellCheck={false}
            className={`w-full rounded-2xl border border-white/10 bg-black/70 backdrop-blur-xl shadow-2xl py-4 pl-10 pr-12 text-sm text-white placeholder:text-gray-400 hover:bg-black/80 focus:outline-none focus:border-blue-500/50 focus:bg-black/90 focus:ring-4 focus:ring-blue-500/10 transition-all ${showFilters ? 'ring-2 ring-blue-500/50' : ''}`}
          />
          <button
            type="button"
            onClick={() => { setShowFilters(!showFilters); setShowDropdown(false); }}
            className={`absolute inset-y-0 right-0 flex items-center pr-4 transition-colors ${showFilters ? 'text-blue-500' : 'text-gray-400 hover:text-white'}`}
            title="Búsqueda Avanzada"
          >
            {showFilters ? <ChevronUp className="h-5 w-5" /> : <SlidersHorizontal className="h-4 w-4" />}
          </button>
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
        <div className="absolute top-[64px] left-0 w-full bg-black/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,1)] overflow-hidden z-[1001] py-2 animate-in fade-in slide-in-from-top-4 duration-200">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleSuggestionClick(s)}
              className="w-full text-left px-4 py-3 hover:bg-blue-600/20 flex flex-col gap-0.5 border-b border-white/5 last:border-0 transition-colors"
            >
              <div className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
                <span className="text-white font-medium text-sm">{s.name}</span>
              </div>
              <span className="text-gray-400 text-xs pl-5.5 ml-[22px] block">{s.address}</span>
            </button>
          ))}
        </div>
      )}
      
      {/* Filtros Avanzados Dropdown */}
      {showFilters && (
        <div className="absolute top-[64px] left-0 w-full bg-black/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,1)] overflow-hidden z-[1002] p-4 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-1">Afinar Búsqueda</h4>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ciudad"
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                autoComplete="no-city-autofill"
                name="tesla-city-obscure"
                id="tesla-city-obscure"
                autoCorrect="off"
                spellCheck={false}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500/50"
              />
              <input
                type="text"
                placeholder="C.Postal"
                value={postalFilter}
                onChange={(e) => setPostalFilter(e.target.value)}
                autoComplete="no-postal-autofill"
                name="tesla-postal-obscure"
                id="tesla-postal-obscure"
                autoCorrect="off"
                spellCheck={false}
                className="w-24 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <input
              type="text"
              placeholder="País"
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              autoComplete="no-country-autofill"
              name="tesla-country-obscure"
              id="tesla-country-obscure"
              autoCorrect="off"
              spellCheck={false}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>
        </div>
      )}
    </div>
  );
}
