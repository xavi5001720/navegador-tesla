'use client';

import React from 'react';
import { Navigation, Radar, Plane, X, Volume2, VolumeX, Play, Power } from 'lucide-react';
import SearchPanel from './SearchPanel';
import { playTestSound, VoiceType } from '@/utils/sound';

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
  rawAircraftCount?: number;
  hasLocation: boolean;
  onSearch: (query: string) => void;
  isSoundEnabled: boolean;
  setIsSoundEnabled: (enabled: boolean) => void;
  voiceType: VoiceType;
  setVoiceType: (v: VoiceType) => void;
  isRadarsEnabled: boolean;
  setIsRadarsEnabled: (v: boolean) => void;
  isAircraftsEnabled: boolean;
  setIsAircraftsEnabled: (v: boolean) => void;
  activeAccount?: number;
  onOpenFavorites: () => void;
  lastRadarUpdate?: string | null;
  radarProgress?: number;
  isTrafficEnabled?: boolean;
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
  voiceType,
  setVoiceType,
  isRadarsEnabled,
  setIsRadarsEnabled,
  isAircraftsEnabled,
  setIsAircraftsEnabled,
  activeAccount = 1,
  rawAircraftCount = 0,
  onOpenFavorites,
  lastRadarUpdate,
  radarProgress = 0,
  isTrafficEnabled = false,
}) => {
  return (
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-full md:w-[380px] shrink-0 flex-col border-r border-white/10 bg-black/80 md:bg-black/40 p-6 backdrop-blur-3xl shadow-2xl transition-transform duration-500 md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src="/logo2.png" alt="Navegador Tesla Logo" className="h-14 w-auto object-contain drop-shadow-xl" />
          <h1 className="text-3xl font-black italic tracking-tighter text-red-600 drop-shadow-[0_2px_4px_rgba(220,38,38,0.4)]">
            RadarKiLLER
          </h1>
        </div>
        <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-gray-400">
          <X className="h-5 w-5" />
        </button>
      </div>

      <SearchPanel onSearch={onSearch} isLoading={loadingRoute} onOpenFavorites={onOpenFavorites} />

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
        
        <div className="flex flex-col gap-3">
          {/* Fila: label + botón Test */}
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Tipo de voz</span>
            <button
              onClick={() => playTestSound(voiceType)}
              className="flex items-center gap-1 bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white px-2 py-0.5 rounded-md transition-all active:scale-95 text-[10px] font-bold uppercase"
            >
              <Play className="h-2 w-2" />
              Test
            </button>
          </div>
          {/* Botones selectores */}
          <div className="grid grid-cols-3 gap-2">
            {(['hombre', 'mujer', 'robot'] as VoiceType[]).map((v) => (
              <button
                key={v}
                onClick={() => setVoiceType(v)}
                className={`py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider border transition-all active:scale-95 ${
                  voiceType === v
                    ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_10px_rgba(37,99,235,0.4)]'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {v === 'hombre' ? '👨 Hombre' : v === 'mujer' ? '👩 Mujer' : '🤖 Robot'}
              </button>
            ))}
          </div>
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
                  <span className="text-lg font-bold text-white">
                    {(() => {
                      const totalMins = Math.floor(route.duration / 60);
                      const h = Math.floor(totalMins / 60);
                      const m = totalMins % 60;
                      return h > 0 ? `${h}h ${m}m` : `${m}m`;
                    })()}
                  </span>
               </div>
            </div>
            {/* Badge de estado del tráfico */}
            <div className="mt-2">
              {isTrafficEnabled ? (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Tráfico en tiempo real
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-500/10 border border-gray-500/20 px-2 py-1 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span>
                  Tráfico desactivado
                </span>
              )}
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
                    </div>
                    {isRadarsEnabled ? (
                      fetchingRouteRadars ? (
                        <span className="text-[10px] font-bold text-rose-400 animate-pulse uppercase mt-1">
                          Calculando ruta... {radarProgress > 0 && `${radarProgress}%`}
                        </span>
                      ) : (
                        <div className="flex flex-col">
                          <span className="text-2xl font-black leading-none">{loadingRadars ? '...' : radars.length}</span>
                          {lastRadarUpdate && (
                            <span className="text-[9px] text-gray-500 font-medium mt-1">
                              Actualizado: {new Date(lastRadarUpdate).toLocaleString('es-ES', { 
                                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                              })}
                            </span>
                          )}
                        </div>
                      )
                    ) : (
                      <span className="text-2xl font-black leading-none text-white/30">OFF</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  {/* Switch ON/OFF Radares Moderno */}
                  <button 
                    onClick={() => setIsRadarsEnabled(!isRadarsEnabled)}
                    className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 transition-all duration-300 ease-in-out focus:outline-none shadow-lg ${isRadarsEnabled ? 'bg-green-500 border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-red-500/20 border-red-500/50'}`}
                  >
                    <span className={`inline-flex items-center justify-center h-5 w-5 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${isRadarsEnabled ? 'translate-x-[26px]' : 'translate-x-[4px]'}`}>
                      <Power className={`h-3 w-3 ${isRadarsEnabled ? 'text-green-500' : 'text-red-500'}`} strokeWidth={3} />
                    </span>
                  </button>
                  {isRadarsEnabled ? (
                    <span className="text-[9px] font-bold text-green-500 uppercase tracking-wider">Activado</span>
                  ) : (
                    <span className="text-[9px] font-bold text-rose-500 uppercase tracking-wider">Desactivado</span>
                  )}
                </div>
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
                    <img src="/controlador.png" alt="Aviones" className="h-8 w-8 object-contain drop-shadow-md" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Sistema Antiaéreo</span>
                    </div>
                    {isAircraftsEnabled ? (
                      <div className="flex flex-col gap-1 mt-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold text-white/80">
                            {loadingAircrafts ? '...' : rawAircraftCount}
                          </span>
                          <span className="text-[10px] text-gray-400 uppercase tracking-widest">Detectadas</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-2xl font-black ${isAnyPegasusNearby ? 'text-blue-400 animate-pulse drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 'text-rose-500 drop-shadow-[0_0_4px_rgba(225,29,72,0.5)]'}`}>
                            {loadingAircrafts ? '...' : aircraftCount}
                          </span>
                          <span className="text-[10px] text-rose-400 font-bold uppercase tracking-widest">Sospechosas</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-2xl font-black leading-none text-white/30">OFF</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  {/* Switch ON/OFF Aviones Moderno */}
                  <button 
                    onClick={() => setIsAircraftsEnabled(!isAircraftsEnabled)}
                    className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 transition-all duration-300 ease-in-out focus:outline-none shadow-lg ${isAircraftsEnabled ? 'bg-green-500 border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-red-500/20 border-red-500/50'}`}
                  >
                    <span className={`inline-flex items-center justify-center h-5 w-5 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${isAircraftsEnabled ? 'translate-x-[26px]' : 'translate-x-[4px]'}`}>
                      <Power className={`h-3 w-3 ${isAircraftsEnabled ? 'text-green-500' : 'text-red-500'}`} strokeWidth={3} />
                    </span>
                  </button>
                  {isAircraftsEnabled ? (
                    <span className="text-[9px] font-bold text-green-500 uppercase tracking-wider">Activado</span>
                  ) : (
                    <span className="text-[9px] font-bold text-rose-500 uppercase tracking-wider">Desactivado</span>
                  )}
                </div>
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
