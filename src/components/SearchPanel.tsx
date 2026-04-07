'use client';

import { useState } from 'react';
import { Star, Search, Loader2, Navigation } from 'lucide-react';

interface SearchPanelProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
  onOpenFavorites: () => void;
}

export default function SearchPanel({ onSearch, isLoading = false, onOpenFavorites }: SearchPanelProps) {
  const [query, setQuery] = useState('');

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
  );
}
