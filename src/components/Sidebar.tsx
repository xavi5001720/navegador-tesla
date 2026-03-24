'use client';

import React from 'react';
import { Navigation, Radar, Plane, X, Volume2, VolumeX, Play, Power } from 'lucide-react';
import SearchPanel from './SearchPanel';
import { playTestSound } from '@/utils/sound';

interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  loadingRoute: boolean;
  routeError: string | null;
  route: any;
  clearRoute: () => void;
  loadingRadars: boolean;
  fetchingRouteRadars?: boolean;
  radars: any[];
  remainingRadars?: number;
  isAnyPegasusNearby: boolean;
  isRateLimited: boolean;
  loadingAircrafts: boolean;
  aircraftCount?: number;
  hasLocation: boolean;
  onSearch: (query: string) => void;
  isSoundEnabled: boolean;
  setIsSoundEnabled: (enabled: boolean) => void;
  alertVolume: number;
  setAlertVolume: (volume: number) => void;
  isRadarsEnabled: boolean;
  setIsRadarsEnabled: (v: boolean) => void;
  isAircraftsEnabled: boolean;
  setIsAircraftsEnabled: (v: boolean) => void;
  activeAccount?: number;
}

const Sidebar: React.FC<SidebarProps> = ({
  isSidebarOpen,
  setIsSidebarOpen,
  loadingRoute,
  routeError,
  route,
  clearRoute,
  loadingRadars,
  fetchingRouteRadars,
  radars,
  remainingRadars = 0,
  isAnyPegasusNearby,
  isRateLimited,
  loadingAircrafts,
  aircraftCount = 0,
  hasLocation,
  onSearch,
  isSoundEnabled,
  setIsSoundEnabled,
  alertVolume,
  setAlertVolume,
  isRadarsEnabled,
  setIsRadarsEnabled,
  isAircraftsEnabled,
  setIsAircraftsEnabled,
  activeAccount = 1
}) => {
  return (
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-full md:w-[380px] shrink-0 flex-col border-r border-white/10 bg-black/80 md:bg-black/40 p-6 backdrop-blur-3xl shadow-2xl transition-transform duration-500 md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white/90">
            Viajando en <span className="text-blue-500">Tesla</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">en construcción versión 4</p>
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

      {/* Configuración de Alertas */}
      <div className="mt-6 p-4 rounded-2xl bg-white/5 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {isSoundEnabled ? <Volume2 className="h-4 w-4 text-blue-400" /> : <VolumeX className="h-4 w-4 text-gray-500" />}
            <span className="text-xs font-bold uppercase tracking-wider text-gray-300">Alertas de Sonido</span>
          </div>
          <button 
            onClick={() => setIsSoundEnabled(!isSoundEnabled)}
            className={`w-10 h-5 rounded-full transition-colors relative ${isSoundEnabled ? 'bg-blue-600' : 'bg-gray-700'}`}
          >
            <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${isSoundEnabled ? 'translate-x-5' : ''}`} />
          </button>
        </div>
        
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-[10px] text-gray-500 font-bold uppercase items-center">
            <span>Volumen</span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => playTestSound(alertVolume)}
                className="flex items-center gap-1 bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white px-2 py-0.5 rounded-md transition-all active:scale-95"
              >
                <Play className="h-2 w-2" />
                <span>Test</span>
              </button>
              <span>{Math.round(alertVolume * 100)}%</span>
            </div>
          </div>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            value={alertVolume} 
            onChange={(e) => setAlertVolume(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>
      </div>

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
           <div className={`flex flex-col rounded-2xl bg-white/5 p-5 border border-white/10 hover:bg-white/10 transition-colors ${!isRadarsEnabled && 'opacity-70'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-xl flex items-center justify-center ${isRadarsEnabled ? 'bg-rose-500/20' : 'bg-gray-500/20'}`}>
                    <img src="/radares.png" alt="Radares" className={`h-8 w-8 object-contain drop-shadow-md ${fetchingRouteRadars ? 'animate-pulse opacity-50' : ''}`} />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Radares</span>
                      {isRadarsEnabled ? (
                        !loadingRadars && !fetchingRouteRadars && (
                          <div className="flex items-center gap-1 bg-green-500/10 px-1.5 py-0.5 rounded-full border border-green-500/20">
                            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="text-[8px] font-bold text-green-500 uppercase">Activado</span>
                          </div>
                        )
                      ) : (
                        <div className="flex items-center gap-1 bg-rose-500/10 px-1.5 py-0.5 rounded-full border border-rose-500/20">
                          <div className="h-1.5 w-1.5 rounded-full bg-rose-500"></div>
                          <span className="text-[8px] font-bold text-rose-500 uppercase">No Activado</span>
                        </div>
                      )}
                    </div>
                    {isRadarsEnabled ? (
                      fetchingRouteRadars ? (
                        <span className="text-[10px] font-bold text-rose-400 animate-pulse uppercase mt-1">Calculando ruta...</span>
                      ) : (
                        <span className="text-2xl font-black leading-none">{loadingRadars ? '...' : radars.length}</span>
                      )
                    ) : (
                      <span className="text-2xl font-black leading-none text-white/30">OFF</span>
                    )}
                  </div>
                </div>
                {/* Switch ON/OFF Radares Moderno */}
                <button 
                  onClick={() => setIsRadarsEnabled(!isRadarsEnabled)}
                  className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 transition-all duration-300 ease-in-out focus:outline-none shadow-lg ${isRadarsEnabled ? 'bg-green-500 border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-red-500/20 border-red-500/50'}`}
                >
                  <span className={`inline-flex items-center justify-center h-5 w-5 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${isRadarsEnabled ? 'translate-x-[26px]' : 'translate-x-[4px]'}`}>
                    <Power className={`h-3 w-3 ${isRadarsEnabled ? 'text-green-500' : 'text-red-500'}`} strokeWidth={3} />
                  </span>
                </button>
              </div>
              {remainingRadars < radars.length && !loadingRadars && !fetchingRouteRadars && (
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Restantes</span>
                  <span className="text-xl font-bold text-blue-400">{remainingRadars}</span>
                </div>
              )}
           </div>

           <div className={`flex flex-col rounded-2xl p-5 border transition-all duration-500 ${isAnyPegasusNearby ? 'bg-blue-600/20 border-blue-500/50 shadow-[0_0_20px_rgba(37,99,235,0.2)]' : 'bg-white/5 border-white/10'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-xl flex items-center justify-center ${isAircraftsEnabled ? (isAnyPegasusNearby ? 'bg-blue-500 animate-pulse' : 'bg-blue-500/20') : 'bg-gray-500/20'}`}>
                    <img src="/aviones.png" alt="Aviones" className="h-8 w-8 object-contain drop-shadow-md" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Sistema Antiaéreo</span>
                      {isAircraftsEnabled ? (
                        !loadingAircrafts && (
                          <div className="flex items-center gap-1 bg-green-500/10 px-1.5 py-0.5 rounded-full border border-green-500/20">
                            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="text-[8px] font-bold text-green-500 uppercase">Activado</span>
                          </div>
                        )
                      ) : (
                        <div className="flex items-center gap-1 bg-rose-500/10 px-1.5 py-0.5 rounded-full border border-rose-500/20">
                          <div className="h-1.5 w-1.5 rounded-full bg-rose-500"></div>
                          <span className="text-[8px] font-bold text-rose-500 uppercase">No Activado</span>
                        </div>
                      )}
                    </div>
                    {isAircraftsEnabled ? (
                      <div className="flex items-baseline gap-2">
                        <span className={`text-2xl font-black leading-none ${isAnyPegasusNearby ? 'text-blue-400' : 'text-white/60'}`}>
                          {loadingAircrafts ? '...' : aircraftCount}
                        </span>
                        {!loadingAircrafts && aircraftCount !== undefined && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 whitespace-nowrap">
                             Patriot {activeAccount}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-2xl font-black leading-none text-white/30">OFF</span>
                    )}
                  </div>
                </div>
                {/* Switch ON/OFF Aviones Moderno */}
                <button 
                  onClick={() => setIsAircraftsEnabled(!isAircraftsEnabled)}
                  className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 transition-all duration-300 ease-in-out focus:outline-none shadow-lg ${isAircraftsEnabled ? 'bg-green-500 border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-red-500/20 border-red-500/50'}`}
                >
                  <span className={`inline-flex items-center justify-center h-5 w-5 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${isAircraftsEnabled ? 'translate-x-[26px]' : 'translate-x-[4px]'}`}>
                    <Power className={`h-3 w-3 ${isAircraftsEnabled ? 'text-green-500' : 'text-red-500'}`} strokeWidth={3} />
                  </span>
                </button>
              </div>
              {isAnyPegasusNearby && (
                <p className="mt-2 text-[10px] text-blue-400 font-bold uppercase tracking-wider animate-pulse">
                  OBJETIVO SOSPECHOSO DETECTADO
                </p>
              )}
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
