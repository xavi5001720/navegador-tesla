'use client';

import { Star, Trash2, Navigation, X } from 'lucide-react';
import { Favorite } from '@/hooks/useFavorites';

interface FavoritesPanelProps {
  favorites: Favorite[];
  onNavigate: (fav: Favorite) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function FavoritesPanel({ favorites, onNavigate, onDelete, onClose }: FavoritesPanelProps) {
  return (
    <>
      {/* Overlay para cerrar */}
      <div className="fixed inset-0 z-[600] bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="fixed left-0 inset-y-0 z-[650] w-full md:w-[380px] flex flex-col bg-black/95 backdrop-blur-3xl border-r border-white/10 shadow-2xl animate-in slide-in-from-left duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Favoritos</h2>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">{favorites.length} guardados</p>
            </div>
          </div>
          <button onClick={onClose} className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
          {favorites.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 py-16 gap-4">
              <div className="h-16 w-16 rounded-2xl bg-white/5 flex items-center justify-center">
                <Star className="h-8 w-8 text-white/20" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-white/40">Sin destinos favoritos</p>
                <p className="text-xs text-white/20 mt-1">Toca en el mapa y guarda un destino</p>
              </div>
            </div>
          ) : (
            favorites.map(fav => (
              <div
                key={fav.id}
                className="flex items-center gap-3 rounded-2xl bg-white/5 border border-white/10 p-4 hover:bg-white/10 transition-colors group"
              >
                {/* Botón navegar (izquierda, sustituye a la estrella) */}
                <button
                  onClick={() => onNavigate(fav)}
                  className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 transition-colors"
                  title="Navegar"
                >
                  <Navigation className="h-4 w-4" />
                </button>

                {/* Nombre y coordenadas */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{fav.name}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{fav.lat.toFixed(4)}, {fav.lon.toFixed(4)}</p>
                </div>

                {/* Botón borrar */}
                <button
                  onClick={() => onDelete(fav.id)}
                  className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl bg-rose-500/10 hover:bg-rose-500/30 text-rose-400/60 hover:text-rose-400 transition-colors"
                  title="Eliminar favorito"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
