'use client';

import React from 'react';
import { Navigation, AlertTriangle, ShieldAlert, X, Menu } from 'lucide-react';
import SearchPanel from './SearchPanel';

interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  loadingRoute: boolean;
  routeError: string | null;
  route: any;
  clearRoute: () => void;
  loadingRadars: boolean;
  radars: any[];
  isAnyPegasusNearby: boolean;
  isRateLimited: boolean;
  loadingAircrafts: boolean;
  hasLocation: boolean;
  onSearch: (query: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isSidebarOpen,
  setIsSidebarOpen,
  loadingRoute,
  routeError,
  route,
  clearRoute,
  loadingRadars,
  radars,
  isAnyPegasusNearby,
  isRateLimited,
  loadingAircrafts,
  hasLocation,
  onSearch
}) => {
  return (
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-full md:w-[380px] shrink-0 flex-col border-r border-white/10 bg-black/80 md:bg-black/40 p-6 backdrop-blur-3xl shadow-2xl transition-transform duration-500 md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white/90">
            Viajando en <span className="text-blue-500">Tesla</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">Navegación OpenSource</p>
        </div>
        <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-gray-400">
          <X className="h-5 w-5" />
        </button>
      </div>

      <SearchPanel onSearch={onSearch} isLoading={loadingRoute} />

      {/* Error Feedback */}
      {routeError && (
        <div className="mt-4 text-xs text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
          {routeError}
        </div>
      )}

      {/* Información de Ruta Activa */}
      {route && (
         <div className="mt-6 flex flex-col gap-2 rounded-2xl bg-blue-500/10 border border-blue-500/20 p-4 mb-4">
            <div className="flex items-center justify-between text-blue-400">
               <span className="text-sm font-semibold flex items-center gap-2">
                  <Navigation className="h-4 w-4" />
                  Ruta Calculada
               </span>
               <button onClick={clearRoute} className="text-xs hover:text-white underline">Cancelar</button>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
               <div>
                  <span className="text-xs text-gray-400 block uppercase tracking-wider">Distancia</span>
                  <span className="text-lg font-bold text-white">{(route.distance / 1000).toFixed(1)} km</span>
               </div>
               <div>
                  <span className="text-xs text-gray-400 block uppercase tracking-wider">Tiempo</span>
                  <span className="text-lg font-bold text-white">{Math.floor(route.duration / 60)} min</span>
               </div>
            </div>
         </div>
      )}

      <div className="flex-1 overflow-y-auto no-scrollbar py-4">
        <div className="grid grid-cols-1 gap-3">
           <div className="flex items-center justify-between rounded-2xl bg-white/5 p-5 border border-white/10 hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-rose-500/20 text-rose-400">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Radares</span>
                  <span className="text-2xl font-black">{loadingRadars ? '...' : radars.length}</span>
                </div>
              </div>
           </div>

           <div className={`flex flex-col rounded-2xl p-5 border transition-all duration-500 ${isAnyPegasusNearby ? 'bg-blue-600/20 border-blue-500/50 shadow-[0_0_20px_rgba(37,99,235,0.2)]' : 'bg-white/5 border-white/10'}`}>
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${isAnyPegasusNearby ? 'bg-blue-500 text-white animate-pulse' : 'bg-blue-500/20 text-blue-400'}`}>
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Pegasus</span>
                  <span className={`text-2xl font-black ${isAnyPegasusNearby ? 'text-blue-400' : 'text-white/60'}`}>
                    {loadingAircrafts ? 'BUSCANDO...' : (isAnyPegasusNearby ? 'ACTIVO' : 'Inactivo')}
                  </span>
                </div>
              </div>
              {isRateLimited && (
                <p className="mt-2 text-[10px] text-amber-500/80 font-medium leading-tight">
                  Límite de API alcanzado.
                </p>
              )}
           </div>
        </div>
      </div>

      {/* GPS Status Indicator */}
      <div className="mt-auto pt-4 flex items-center gap-3">
        <div className={`h-2.5 w-2.5 rounded-full ${hasLocation ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-amber-500 animate-pulse'}`}></div>
        <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">
          {hasLocation ? 'GPS Signal Locked' : 'Searching for Signal...'}
        </span>
      </div>
    </aside>
  );
};

export default Sidebar;
