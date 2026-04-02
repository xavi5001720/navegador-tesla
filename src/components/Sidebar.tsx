'use client';

import React, { useState } from 'react';
import { Navigation, Radar, Plane, X, Volume2, VolumeX, Play, Power, Database } from 'lucide-react';
import SearchPanel from './SearchPanel';
import { playTestSound, VoiceType } from '@/utils/sound';

import { ChargerFilters } from '@/hooks/useChargers';
import { GasStationFilters } from '@/hooks/useGasStations';
import { WeatherPoint } from '@/hooks/useWeather';

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
  isChargersEnabled: boolean;
  setIsChargersEnabled: (v: boolean) => void;
  chargerFilters: ChargerFilters;
  setChargerFilters: (f: ChargerFilters) => void;
  chargersCount: number;
  loadingChargers: boolean;
  chargerProgress: number;
  isGasStationsEnabled: boolean;
  setIsGasStationsEnabled: (v: boolean) => void;
  gasStationFilters: GasStationFilters;
  setGasStationFilters: (f: GasStationFilters) => void;
  gasStationsCount: number;
  loadingGasStations: boolean;
  gasProgress: number;
  isWeatherEnabled: boolean;
  setIsWeatherEnabled: (v: boolean) => void;
  loadingWeather: boolean;
  currentWeather: WeatherPoint | null;
  activeAccount?: number;
  onOpenFavorites: () => void;
  lastRadarUpdate?: string | null;
  radarProgress?: number;
  isTrafficEnabled?: boolean;
  liveDistance?: number | null;
  liveDuration?: number | null;
  waypoints?: [number, number][];
  onSavePreferences?: () => void;
  isLoggedIn?: boolean;
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
  liveDistance = null,
  liveDuration = null,
  waypoints = [],
  isChargersEnabled,
  setIsChargersEnabled,
  chargerFilters,
  setChargerFilters,
  chargersCount,
  loadingChargers,
  chargerProgress,
  isGasStationsEnabled,
  setIsGasStationsEnabled,
  gasStationFilters,
  setGasStationFilters,
  gasStationsCount,
  loadingGasStations,
  gasProgress,
  isWeatherEnabled,
  setIsWeatherEnabled,
  loadingWeather,
  currentWeather,
  onSavePreferences,
  isLoggedIn
}) => {
  const [showRadarStats, setShowRadarStats] = useState(false);
  const [showChargerFilters, setShowChargerFilters] = useState(false);
  const [showSoundOptions, setShowSoundOptions] = useState(false);
  const [radarStatsData, setRadarStatsData] = useState<any>(null);
  const [loadingRadarStats, setLoadingRadarStats] = useState(false);

  const handleToggleRadarStats = async () => {
    setShowRadarStats(!showRadarStats);
    if (!showRadarStats && !radarStatsData) {
      setLoadingRadarStats(true);
      try {
        const res = await fetch('/api/radars/stats');
        const data = await res.json();
        setRadarStatsData(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingRadarStats(false);
      }
    }
  };

  const [showGasFilters, setShowGasFilters] = useState(false);
  const [gasStatsData, setGasStatsData] = useState<any>(null);
  const [loadingGasStats, setLoadingGasStats] = useState(false);

  const handleToggleGasStats = async () => {
    setShowGasFilters(!showGasFilters);
    if (!showGasFilters && !gasStatsData) {
      setLoadingGasStats(true);
      try {
        const res = await fetch('/api/gas/stats');
        const data = await res.json();
        setGasStatsData(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingGasStats(false);
      }
    }
  };

  return (
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-full md:w-[380px] shrink-0 flex-col border-r border-white/10 bg-black/80 p-6 backdrop-blur-3xl shadow-2xl transition-transform duration-500 overflow-y-auto no-scrollbar ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src="/logopro.png" alt="NavegaPRO Logo" className="h-14 w-auto object-contain drop-shadow-xl" />
          <h1 className="text-3xl font-black italic tracking-tighter bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(59,130,246,0.3)]">
            NavegaPRO
          </h1>
        </div>
        <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-gray-400">
          <X className="h-5 w-5" />
        </button>
      </div>

      <SearchPanel onSearch={onSearch} isLoading={loadingRoute} onOpenFavorites={onOpenFavorites} />

      {/* Botón Eliminar Ruta (solo cuando hay ruta activa) */}
      {route && (
        <button
          onClick={clearRoute}
          className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 active:scale-95 transition-all text-sm font-bold"
        >
          <X className="h-4 w-4" />
          Eliminar ruta
        </button>
      )}

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
                  <span className="text-lg font-bold text-white">
                    {((liveDistance ?? route.distance) / 1000).toFixed(1)} km
                  </span>
               </div>
               <div>
                  <span className="text-xs text-gray-400 block uppercase tracking-wider">Tiempo</span>
                  <span className="text-lg font-bold text-white">
                    {(() => {
                      const duration = liveDuration ?? route.duration;
                      const totalMins = Math.floor(duration / 60);
                      const h = Math.floor(totalMins / 60);
                      const m = totalMins % 60;
                      return h > 0 ? `${h}h ${m}m` : `${m}m`;
                    })()}
                  </span>
               </div>
            </div>
            {/* Paradas intermedias */}
            {waypoints.length > 0 && (
              <div className="mt-3 flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Paradas</span>
                {waypoints.map((wp, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-black text-emerald-400">{i + 1}</span>
                    </div>
                    <span className="text-[11px] text-gray-300 font-medium">
                      {wp[0].toFixed(4)}, {wp[1].toFixed(4)}
                    </span>
                  </div>
                ))}
              </div>
            )}
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

      <div className="py-4">
        <div className="grid grid-cols-1 gap-3">

           <div className={`flex flex-col rounded-2xl bg-white/5 p-5 border border-white/10 hover:bg-white/10 transition-colors ${!isSoundEnabled && 'opacity-70'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={() => setShowSoundOptions(!showSoundOptions)} className={`p-1 rounded-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 ${isSoundEnabled ? 'bg-blue-500/20 hover:bg-blue-500/30 cursor-pointer' : 'bg-gray-500/20'}`}>
                     <div className="h-11 w-11 flex items-center justify-center drop-shadow-md">
                        {isSoundEnabled ? <Volume2 className="h-7 w-7 text-blue-400" /> : <VolumeX className="h-7 w-7 text-gray-400" />}
                     </div>
                  </button>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Alertas de Sonido</span>
                    </div>
                    {isSoundEnabled ? (
                      <span className="text-2xl font-black leading-none text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]">ON</span>
                    ) : (
                      <span className="text-2xl font-black leading-none text-white/30 truncate">OFF</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1.5 shrink-0 align-self-start mt-1">
                  <button 
                    onClick={() => setIsSoundEnabled(!isSoundEnabled)}
                    className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 transition-all duration-300 ease-in-out focus:outline-none shadow-lg ${isSoundEnabled ? 'bg-green-500 border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-red-500/20 border-red-500/50'}`}
                  >
                    <span className={`inline-flex items-center justify-center h-5 w-5 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${isSoundEnabled ? 'translate-x-[26px]' : 'translate-x-[4px]'}`}>
                      <Power className={`h-3 w-3 ${isSoundEnabled ? 'text-green-500' : 'text-red-500'}`} strokeWidth={3} />
                    </span>
                  </button>
                  {isSoundEnabled ? (
                    <span className="text-[9px] font-bold text-green-500 uppercase tracking-wider">Activado</span>
                  ) : (
                    <span className="text-[9px] font-bold text-rose-500 uppercase tracking-wider">Desactivado</span>
                  )}
                </div>
              </div>

              {/* Opciones de sonido (Desplegable test) */}
              {showSoundOptions && (
                 <div className="mt-4 pt-4 border-t border-white/10 animate-fade-in flex flex-col gap-3">
                    <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg">
                       <span className="text-[10px] text-gray-300 font-bold uppercase tracking-wider">Voz del sistema</span>
                       <button
                         onClick={() => playTestSound(voiceType)}
                         className="flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/50 text-blue-300 px-3 py-1.5 rounded-xl transition-all active:scale-95 text-[10px] font-bold uppercase"
                       >
                         <Play className="h-3 w-3" />
                         Reproducir Test
                       </button>
                    </div>
                 </div>
              )}
           </div>

           <div className={`flex flex-col rounded-2xl bg-white/5 p-5 border border-white/10 hover:bg-white/10 transition-colors ${!isRadarsEnabled && 'opacity-70'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={handleToggleRadarStats} className={`p-1 rounded-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 ${isRadarsEnabled ? 'bg-rose-500/20 hover:bg-rose-500/30 cursor-pointer' : 'bg-gray-500/20'}`}>
                    <img src="/radares.png" alt="Radares" className={`h-11 w-11 object-contain drop-shadow-md ${fetchingRouteRadars ? 'animate-pulse opacity-50' : ''}`} />
                  </button>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Sistema Antiradar</span>
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

              {/* Estadísticas de Radares (Desplegable) */}
              {showRadarStats && (
                <div className="mt-4 pt-4 border-t border-white/10 animate-fade-in">
                  <div className="flex items-center gap-2 mb-3">
                    <Database className="h-4 w-4 text-rose-400" />
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">BASE DE DATOS ACTUALIZADA</span>
                  </div>
                  
                  {loadingRadarStats ? (
                    <div className="text-[11px] text-gray-400 animate-pulse text-center py-2">Cargando base de datos...</div>
                  ) : radarStatsData ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg">
                        <span className="text-xs text-gray-300 font-medium tracking-wide">🇪🇸 España ({radarStatsData.es.count})</span>
                        <span className="text-[9px] text-gray-500 font-bold bg-black/40 px-2 py-0.5 rounded-full">
                          {radarStatsData.es.lastUpdate 
                            ? new Date(radarStatsData.es.lastUpdate).toLocaleString('es-ES', { 
                                timeZone: 'Europe/Madrid',
                                day: '2-digit', month: '2-digit', year: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                              }) 
                            : 'Sin datos'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg">
                        <span className="text-xs text-gray-300 font-medium tracking-wide">🇫🇷 Francia Sur ({radarStatsData.fr_south.count})</span>
                        <span className="text-[9px] text-gray-500 font-bold bg-black/40 px-2 py-0.5 rounded-full">
                          {radarStatsData.fr_south.lastUpdate 
                            ? new Date(radarStatsData.fr_south.lastUpdate).toLocaleString('es-ES', { 
                                timeZone: 'Europe/Madrid',
                                day: '2-digit', month: '2-digit', year: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                              }) 
                            : 'Sin datos'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg">
                        <span className="text-xs text-gray-300 font-medium tracking-wide">🇫🇷 Francia Norte ({radarStatsData.fr_north.count})</span>
                        <span className="text-[9px] text-gray-500 font-bold bg-black/40 px-2 py-0.5 rounded-full">
                          {radarStatsData.fr_north.lastUpdate 
                            ? new Date(radarStatsData.fr_north.lastUpdate).toLocaleString('es-ES', { 
                                timeZone: 'Europe/Madrid',
                                day: '2-digit', month: '2-digit', year: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                              }) 
                            : 'Sin datos'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t border-white/5 mt-1">
                        <span className="text-xs font-black text-rose-400 uppercase tracking-widest">Total Sincronizado</span>
                        <span className="text-sm font-black text-rose-400 bg-rose-500/10 px-3 py-1 rounded-xl border border-rose-500/20">{radarStatsData.total}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-rose-400 text-center py-2 bg-rose-500/10 rounded-lg">Error al cargar datos</div>
                  )}
                </div>
              )}

           </div>

           <div className={`flex flex-col rounded-2xl p-5 border transition-all duration-500 ${isAnyPegasusNearby ? 'bg-blue-600/20 border-blue-500/50 shadow-[0_0_20px_rgba(37,99,235,0.2)]' : 'bg-white/5 border-white/10'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-1 rounded-xl flex items-center justify-center ${isAircraftsEnabled ? (isAnyPegasusNearby ? 'bg-blue-500 animate-pulse' : 'bg-blue-500/20') : 'bg-gray-500/20'}`}>
                    <img src="/controlador.png" alt="Aviones" className="h-11 w-11 object-contain drop-shadow-md" />
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

           {/* Bloque Cargadores */}
           <div className={`flex flex-col rounded-2xl bg-white/5 p-5 border border-white/10 hover:bg-white/10 transition-colors ${!isChargersEnabled && 'opacity-70'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <button 
                     onClick={() => setShowChargerFilters(!showChargerFilters)}
                     className={`p-1 rounded-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 ${isChargersEnabled ? 'bg-emerald-500/20 hover:bg-emerald-500/30 cursor-pointer' : 'bg-gray-500/20'}`}
                   >
                     <img src="/cargadorEV.png" alt="Cargadores" className={`h-11 w-11 object-contain drop-shadow-lg ${loadingChargers ? 'animate-pulse opacity-50' : ''}`} />
                   </button>
                   <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Cargadores EV</span>
                    </div>
                    {isChargersEnabled ? (
                      loadingChargers ? (
                        <span className="text-[10px] font-bold text-emerald-400 animate-pulse uppercase mt-1">
                          Buscando... {chargerProgress > 0 && `${chargerProgress}%`}
                        </span>
                      ) : (
                        <div className="flex flex-col">
                          <span className="text-2xl font-black leading-none text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]">{chargersCount}</span>
                          <span className="text-[9px] text-gray-500 font-medium mt-1 uppercase">Públicos Mapeados</span>
                        </div>
                      )
                    ) : (
                      <span className="text-2xl font-black leading-none text-white/30">OFF</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <button 
                    onClick={() => setIsChargersEnabled(!isChargersEnabled)}
                    className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 transition-all duration-300 ease-in-out focus:outline-none shadow-lg ${isChargersEnabled ? 'bg-green-500 border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-red-500/20 border-red-500/50'}`}
                  >
                    <span className={`inline-flex items-center justify-center h-5 w-5 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${isChargersEnabled ? 'translate-x-[26px]' : 'translate-x-[4px]'}`}>
                      <Power className={`h-3 w-3 ${isChargersEnabled ? 'text-green-500' : 'text-red-500'}`} strokeWidth={3} />
                    </span>
                  </button>
                  {isChargersEnabled ? (
                    <span className="text-[9px] font-bold text-green-500 uppercase tracking-wider">Activado</span>
                  ) : (
                    <span className="text-[9px] font-bold text-rose-500 uppercase tracking-wider">Desactivado</span>
                  )}
                </div>
              </div>

              {/* Filtros de Cargadores (Desplegable) */}
              {showChargerFilters && (
                <div className="mt-4 pt-4 border-t border-white/10 animate-fade-in flex flex-col gap-3">
                  <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg">
                     <span className="text-xs font-medium text-white">Solo gratuitos</span>
                     <button 
                       onClick={() => setChargerFilters({ ...chargerFilters, isFree: !chargerFilters.isFree })}
                       className={`w-8 h-4 rounded-full transition-colors relative ${chargerFilters.isFree ? 'bg-emerald-500' : 'bg-gray-600'}`}
                     >
                        <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-transform duration-200 ${chargerFilters.isFree ? 'translate-x-4' : 'translate-x-0.5'}`} />
                     </button>
                  </div>
                  
                  <div className="bg-white/5 p-2 rounded-lg flex flex-col gap-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Conector</span>
                      <div className="flex flex-wrap gap-2">
                         {(['ccs', 'tipo2', 'enchufe'] as const).map(c => (
                            <button 
                               key={c}
                               onClick={() => {
                                 let newC = [...(chargerFilters.connectors || [])] as ('ccs' | 'tipo2' | 'enchufe')[];
                                 if (newC.includes(c)) newC = newC.filter(x => x !== c);
                                 else newC.push(c);
                                 setChargerFilters({ ...chargerFilters, connectors: newC });
                               }}
                               className={`px-2 py-1 text-[10px] font-bold uppercase rounded-md transition-colors ${chargerFilters.connectors?.includes(c) ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                            >
                               {c}
                            </button>
                         ))}
                         <button 
                            onClick={() => setChargerFilters({ ...chargerFilters, connectors: [] })}
                            className={`px-2 py-1 text-[10px] font-bold uppercase rounded-md transition-colors ${!chargerFilters.connectors?.length ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-700 text-gray-400'}`}
                         >
                            Todos
                         </button>
                      </div>
                  </div>

                  <div className="bg-white/5 p-2 rounded-lg flex flex-col gap-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Potencia Mínima</span>
                      <div className="flex gap-2">
                         {[0, 22, 50, 150].map(p => (
                            <button 
                               key={p}
                               onClick={() => setChargerFilters({ ...chargerFilters, minPower: p })}
                               className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-colors ${chargerFilters.minPower === p ? 'bg-emerald-600 text-white shadow-lg' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                            >
                               {p === 0 ? 'Todas' : `>${p}kW`}
                            </button>
                         ))}
                      </div>
                  </div>
                </div>
              )}
           </div>

           {/* Bloque Gasolineras */}
           <div className={`flex flex-col rounded-2xl bg-white/5 p-5 border border-white/10 hover:bg-white/10 transition-colors ${!isGasStationsEnabled && 'opacity-70'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <button 
                     onClick={handleToggleGasStats}
                     className={`p-1 rounded-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 ${isGasStationsEnabled ? 'bg-orange-500/20 hover:bg-orange-500/30 cursor-pointer' : 'bg-gray-500/20'}`}
                   >
                     <img src="/gasolinera.png" alt="Gasolineras" className={`h-11 w-11 object-contain drop-shadow-lg ${loadingGasStations ? 'animate-pulse opacity-50' : ''}`} />
                   </button>
                   <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Gasoil / Gasolina</span>
                    </div>
                    {isGasStationsEnabled ? (
                      loadingGasStations ? (
                        <span className="text-[10px] font-bold text-orange-400 animate-pulse uppercase mt-1">
                          Buscando... {gasProgress > 0 && `${gasProgress}%`}
                        </span>
                      ) : (
                        <div className="flex flex-col">
                          <span className="text-2xl font-black leading-none text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]">{gasStationsCount}</span>
                          <span className="text-[9px] text-gray-500 font-medium mt-1 uppercase">
                            {route ? 'Gasolineras en ruta' : 'Gasolineras locales'}
                          </span>
                        </div>
                      )
                    ) : (
                      <span className="text-2xl font-black leading-none text-white/30">OFF</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1.5 shrink-0 align-self-start mt-1">
                  <button 
                    onClick={() => setIsGasStationsEnabled(!isGasStationsEnabled)}
                    className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 transition-all duration-300 ease-in-out focus:outline-none shadow-lg ${isGasStationsEnabled ? 'bg-green-500 border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-red-500/20 border-red-500/50'}`}
                  >
                    <span className={`inline-flex items-center justify-center h-5 w-5 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${isGasStationsEnabled ? 'translate-x-[26px]' : 'translate-x-[4px]'}`}>
                      <Power className={`h-3 w-3 ${isGasStationsEnabled ? 'text-green-500' : 'text-red-500'}`} strokeWidth={3} />
                    </span>
                  </button>
                  {isGasStationsEnabled ? (
                    <span className="text-[9px] font-bold text-green-500 uppercase tracking-wider">Activado</span>
                  ) : (
                    <span className="text-[9px] font-bold text-rose-500 uppercase tracking-wider">Desactivado</span>
                  )}
                </div>
              </div>

              {/* Filtros de Gasolineras y Estadísticas (Desplegable) */}
              {showGasFilters && (
                <div className="mt-4 pt-4 border-t border-white/10 animate-fade-in flex flex-col gap-3">
                  
                  {/* Stats */}
                  <div className="bg-white/5 p-2 rounded-lg flex flex-col justify-between items-center text-xs">
                     <span className="text-[10px] text-gray-300 font-bold w-full pb-1 border-b border-white/5 mb-2 uppercase tracking-wider">BASE DE DATOS ACTUALIZADA</span>
                     {loadingGasStats ? (
                       <span className="text-[10px] text-gray-400 animate-pulse w-full text-center">Cargando base de datos...</span>
                     ) : gasStatsData ? (
                       <div className="flex justify-between w-full">
                         <span className="text-gray-400">Total España: {gasStatsData.total}</span>
                         <span className="text-[9px] font-bold text-gray-400 bg-black/40 px-2 py-0.5 rounded-full">
                           {gasStatsData.es?.lastUpdate ? new Date(gasStatsData.es.lastUpdate).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Sin datos'}
                         </span>
                       </div>
                     ) : (
                       <span className="text-[10px] text-rose-400 text-center w-full">Error al cargar datos</span>
                     )}
                  </div>

                  <div className="bg-white/5 p-2 rounded-lg flex flex-col gap-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Combustible</span>
                      <div className="flex flex-wrap gap-2">
                         {(['g95', 'g98', 'diesel', 'glp'] as const).map(f => {
                            const labelMap = { g95: 'G95', g98: 'G98', diesel: 'Diésel', glp: 'GLP/GNC' };
                            const isSelected = gasStationFilters.fuels?.[0] === f;
                            return (
                              <button 
                                 key={f}
                                 onClick={() => {
                                   // Selección única: si ya está seleccionado, lo quita (ninguno); si no, lo pone solo
                                   setGasStationFilters({ ...gasStationFilters, fuels: isSelected ? [] : [f] });
                                 }}
                                 className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-md transition-colors ${isSelected ? 'bg-orange-600 text-white shadow-lg ring-2 ring-orange-400/30' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                              >
                                 {labelMap[f]}
                              </button>
                            );
                         })}
                      </div>
                  </div>

                  <div className="bg-white/5 p-2 rounded-lg flex flex-col gap-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Precio Máximo (€/L)</span>
                      <div className="flex gap-2">
                         <input 
                           type="number"
                           step="0.01"
                           min="0"
                           placeholder="Sin límite..."
                           value={gasStationFilters.maxPrice || ''}
                           onChange={(e) => {
                             const val = e.target.value ? parseFloat(e.target.value) : null;
                             setGasStationFilters({ ...gasStationFilters, maxPrice: val });
                           }}
                           className="w-full bg-black/40 border border-white/10 rounded-md py-1.5 px-3 text-xs text-white focus:outline-none focus:border-orange-500 placeholder-gray-600 font-bold"
                         />
                      </div>
                  </div>
                  
                  <div className="flex items-center justify-between bg-orange-500/10 border border-orange-500/20 p-2 rounded-lg">
                     <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">Mostrar solo la más barata</span>
                     <button 
                       onClick={() => setGasStationFilters({ ...gasStationFilters, onlyCheapest: !gasStationFilters.onlyCheapest })}
                       className={`w-8 h-4 rounded-full transition-colors relative ${gasStationFilters.onlyCheapest ? 'bg-orange-500' : 'bg-gray-600'}`}
                     >
                        <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-transform duration-200 ${gasStationFilters.onlyCheapest ? 'translate-x-4' : 'translate-x-0.5'}`} />
                     </button>
                  </div>
                </div>
              )}
           </div>

           {/* Bloque Meteorológico (Clima) */}
           <div className={`flex flex-col rounded-2xl bg-white/5 p-5 border border-white/10 hover:bg-white/10 transition-colors ${!isWeatherEnabled && 'opacity-70'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-1 rounded-xl flex items-center justify-center ${isWeatherEnabled ? 'bg-sky-500/20' : 'bg-gray-500/20'}`}>
                    <img src="/clima.png" alt="Clima" className={`h-11 w-11 object-contain drop-shadow-lg ${loadingWeather ? 'animate-pulse opacity-50' : ''}`} />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Sistema Meteorológico</span>
                    </div>
                    {isWeatherEnabled ? (
                      loadingWeather ? (
                        <span className="text-[10px] font-bold text-sky-400 animate-pulse uppercase mt-1">
                          Escaneando atmósfera...
                        </span>
                      ) : currentWeather ? (
                        <div className="flex gap-3 mt-1">
                           <div className="flex flex-col">
                              <span className="text-2xl font-black leading-none text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]">{Math.round(currentWeather.temp)}º</span>
                              <span className="text-[9px] text-gray-500 font-medium mt-1 uppercase truncate max-w-[80px]">{currentWeather.description}</span>
                           </div>
                           <div className="w-px bg-white/10 my-1"></div>
                           <div className="flex flex-col justify-center">
                              <span className="text-xs font-bold text-gray-300">{Math.round(currentWeather.windSpeed)} <span className="text-[9px] text-gray-500">km/h</span></span>
                              <span className="text-[9px] text-gray-500 font-medium uppercase mt-0.5">Viento</span>
                           </div>
                        </div>
                      ) : (
                        <span className="text-sm font-bold leading-none text-gray-400 mt-1">Sin datos locales</span>
                      )
                    ) : (
                      <span className="text-2xl font-black leading-none text-white/30 truncate">OFF</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1.5 shrink-0 align-self-start mt-1">
                  <button 
                    onClick={() => setIsWeatherEnabled(!isWeatherEnabled)}
                    className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 transition-all duration-300 ease-in-out focus:outline-none shadow-lg ${isWeatherEnabled ? 'bg-green-500 border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-red-500/20 border-red-500/50'}`}
                  >
                    <span className={`inline-flex items-center justify-center h-5 w-5 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${isWeatherEnabled ? 'translate-x-[26px]' : 'translate-x-[4px]'}`}>
                      <Power className={`h-3 w-3 ${isWeatherEnabled ? 'text-green-500' : 'text-red-500'}`} strokeWidth={3} />
                    </span>
                  </button>
                  {isWeatherEnabled ? (
                    <span className="text-[9px] font-bold text-green-500 uppercase tracking-wider">Activado</span>
                  ) : (
                    <span className="text-[9px] font-bold text-rose-500 uppercase tracking-wider">Desactivado</span>
                  )}
                </div>
              </div>
           </div>

        </div>

      </div>

      {/* Botón explícito para guardar preferencias en el perfil del usuario */}
      {isLoggedIn && onSavePreferences && (
        <div className="mt-8 mb-4">
          <button
            onClick={(e) => {
              const btn = e.currentTarget;
              const originalText = btn.innerHTML;
              btn.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Guardando...`;
              
              // Simular un poco de espera para mostrar el loading si es inmediato
              setTimeout(() => {
                onSavePreferences();
                btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check h-4 w-4 inline mr-2 text-green-400"><path d="M20 6 9 17l-5-5"/></svg> <span class="text-green-100">Guardado Correctamente</span>`;
                btn.classList.add('bg-green-600', 'hover:bg-green-500', 'shadow-[0_0_15px_rgba(22,163,74,0.4)]');
                btn.classList.remove('bg-blue-600', 'hover:bg-blue-500', 'shadow-[0_0_15px_rgba(37,99,235,0.4)]');
                
                setTimeout(() => {
                  btn.innerHTML = originalText;
                  btn.classList.remove('bg-green-600', 'hover:bg-green-500', 'shadow-[0_0_15px_rgba(22,163,74,0.4)]');
                  btn.classList.add('bg-blue-600', 'hover:bg-blue-500', 'shadow-[0_0_15px_rgba(37,99,235,0.4)]');
                }, 3000);
              }, 400);
            }}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white transition-all bg-blue-600 hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)] hover:shadow-[0_0_25px_rgba(37,99,235,0.6)] active:scale-[0.98]"
          >
            <Database className="h-4 w-4" />
            Guardar Configuración
          </button>
        </div>
      )}

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
