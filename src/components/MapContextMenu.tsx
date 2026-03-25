'use client';

import { useState } from 'react';
import { Navigation, Star, PlusCircle, X, Check } from 'lucide-react';

interface MapContextMenuProps {
  lat: number;
  lon: number;
  screenX: number;
  screenY: number;
  hasRoute: boolean;
  isFavorite: boolean;
  onNavigate: () => void;
  onSaveFavorite: (name: string) => void;
  onAddStopBefore: () => void;
  onAddStopAfter: () => void;
  onClose: () => void;
}

export default function MapContextMenu({
  lat,
  lon,
  screenX,
  screenY,
  hasRoute,
  isFavorite,
  onNavigate,
  onSaveFavorite,
  onAddStopBefore,
  onAddStopAfter,
  onClose,
}: MapContextMenuProps) {
  const [namingMode, setNamingMode] = useState(false);
  const [favName, setFavName] = useState('');

  const menuWidth = 240;
  const approxMenuHeight = hasRoute ? 260 : 165;
  const adjustedX = screenX + menuWidth > window.innerWidth ? screenX - menuWidth : screenX;
  const adjustedY = screenY + approxMenuHeight > window.innerHeight ? screenY - approxMenuHeight : screenY;

  const handleSaveClick = () => {
    if (isFavorite) return;
    setFavName(`${lat.toFixed(4)}, ${lon.toFixed(4)}`);
    setNamingMode(true);
  };

  const handleConfirmSave = () => {
    onSaveFavorite(favName.trim() || `${lat.toFixed(4)}, ${lon.toFixed(4)}`);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-[700]" onClick={onClose} />

      <div
        className="fixed z-[800] w-[240px] rounded-2xl bg-black/92 backdrop-blur-2xl border border-white/15 shadow-2xl overflow-hidden"
        style={{ left: adjustedX, top: adjustedY }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
            {lat.toFixed(4)}, {lon.toFixed(4)}
          </span>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex flex-col p-2 gap-1">
          {/* Navegar */}
          <button
            onClick={() => { onNavigate(); onClose(); }}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-blue-500/20 text-left transition-colors group"
          >
            <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/40 transition-colors">
              <Navigation className="h-4 w-4 text-blue-400" />
            </div>
            <span className="text-sm font-semibold text-white">Ir a este lugar</span>
          </button>

          {/* Guardar favorito */}
          {!namingMode ? (
            <button
              onClick={handleSaveClick}
              disabled={isFavorite}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-colors group ${isFavorite ? 'opacity-50 cursor-default' : 'hover:bg-amber-500/20'}`}
            >
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${isFavorite ? 'bg-amber-500/30' : 'bg-amber-500/20 group-hover:bg-amber-500/40'}`}>
                <Star className={`h-4 w-4 ${isFavorite ? 'text-amber-400 fill-amber-400' : 'text-amber-400'}`} />
              </div>
              <span className="text-sm font-semibold text-white">
                {isFavorite ? 'Ya en favoritos' : 'Guardar en favoritos'}
              </span>
            </button>
          ) : (
            /* Formulario de nombre */
            <div className="px-3 py-2 flex flex-col gap-2">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Nombre del favorito</span>
              <input
                autoFocus
                type="text"
                value={favName}
                onChange={e => setFavName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleConfirmSave(); if (e.key === 'Escape') setNamingMode(false); }}
                className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-amber-400/60"
                placeholder="Nombre del lugar..."
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setNamingMode(false)}
                  className="flex-1 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-gray-400 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmSave}
                  className="flex-1 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs font-bold text-black transition-colors flex items-center justify-center gap-1"
                >
                  <Check className="h-3 w-3" /> Guardar
                </button>
              </div>
            </div>
          )}

          {/* Paradas (solo con ruta) */}
          {hasRoute && !namingMode && (
            <>
              <div className="my-1 border-t border-white/10" />
              <button
                onClick={() => { onAddStopBefore(); onClose(); }}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-emerald-500/20 text-left transition-colors group"
              >
                <div className="h-8 w-8 rounded-lg bg-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/40 transition-colors">
                  <PlusCircle className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-white">Añadir parada</span>
                  <span className="text-[10px] text-emerald-400 font-medium">antes del destino</span>
                </div>
              </button>
              <button
                onClick={() => { onAddStopAfter(); onClose(); }}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-purple-500/20 text-left transition-colors group"
              >
                <div className="h-8 w-8 rounded-lg bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/40 transition-colors">
                  <PlusCircle className="h-4 w-4 text-purple-400" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-white">Añadir parada</span>
                  <span className="text-[10px] text-purple-400 font-medium">después del destino</span>
                </div>
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
