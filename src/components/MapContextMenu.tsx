'use client';

import { Navigation, Star, PlusCircle, X } from 'lucide-react';

interface MapContextMenuProps {
  lat: number;
  lon: number;
  screenX: number;
  screenY: number;
  hasRoute: boolean;
  isFavorite: boolean;
  onNavigate: () => void;
  onSaveFavorite: () => void;
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
  // Ajustamos para que el menú no se salga de la pantalla
  const menuWidth = 220;
  const approxMenuHeight = hasRoute ? 220 : 130;
  const adjustedX = screenX + menuWidth > window.innerWidth ? screenX - menuWidth : screenX;
  const adjustedY = screenY + approxMenuHeight > window.innerHeight ? screenY - approxMenuHeight : screenY;

  return (
    <>
      {/* Overlay translúcido para cerrar al tocar fuera */}
      <div
        className="fixed inset-0 z-[700]"
        onClick={onClose}
      />

      {/* Menú contextual */}
      <div
        className="fixed z-[800] w-[220px] rounded-2xl bg-black/90 backdrop-blur-2xl border border-white/15 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        style={{ left: adjustedX, top: adjustedY }}
      >
        {/* Header con coordenadas */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
            {lat.toFixed(4)}, {lon.toFixed(4)}
          </span>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Opciones */}
        <div className="flex flex-col p-2 gap-1">
          <button
            onClick={() => { onNavigate(); onClose(); }}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-blue-500/20 text-left transition-colors group"
          >
            <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/40 transition-colors">
              <Navigation className="h-4 w-4 text-blue-400" />
            </div>
            <span className="text-sm font-semibold text-white">Ir a este lugar</span>
          </button>

          <button
            onClick={() => { onSaveFavorite(); onClose(); }}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-colors group ${isFavorite ? 'hover:bg-amber-500/10' : 'hover:bg-amber-500/20'}`}
          >
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${isFavorite ? 'bg-amber-500/30 group-hover:bg-amber-500/20' : 'bg-amber-500/20 group-hover:bg-amber-500/40'}`}>
              <Star className={`h-4 w-4 ${isFavorite ? 'text-amber-400 fill-amber-400' : 'text-amber-400'}`} />
            </div>
            <span className="text-sm font-semibold text-white">
              {isFavorite ? 'Ya en favoritos' : 'Guardar favorito'}
            </span>
          </button>

          {hasRoute && (
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
