'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { MapPin, Navigation, Menu, X, AlertTriangle, Power, Map } from 'lucide-react';

import Sidebar from '@/components/Sidebar';
import AlertOverlay from '@/components/AlertOverlay';
import Speedometer from '@/components/Speedometer';

import { useRoute } from '@/hooks/useRoute';
import { useRadars } from '@/hooks/useRadars';
import { useAlerts } from '@/hooks/useAlerts';
import { useSpeed } from '@/hooks/useSpeed';
import { usePegasus } from '@/hooks/usePegasus';
import { useGeolocation } from '@/hooks/useGeolocation';

import { getDistance, distanceToPolyline, findClosestPointOnPolyline } from '@/utils/geo';
import { playPegasusAlert, playWaypointAlert, playTrafficJamAlert, playWeatherAlert, unlockTeslaAudio, VoiceType } from '@/utils/sound';
import MapContextMenu from '@/components/MapContextMenu';
import FavoritesPanel from '@/components/FavoritesPanel';
import { useFavorites } from '@/hooks/useFavorites';
import { useChargers, ChargerFilters } from '@/hooks/useChargers';
import { useGasStations, GasStationFilters } from '@/hooks/useGasStations';
import { useWeather } from '@/hooks/useWeather';
import { supabase } from '@/lib/supabase';
import AuthModal from '@/components/AuthModal';
import UserMenu from '@/components/UserMenu';
import GarageModal from '@/components/GarageModal';
import SocialModal from '@/components/SocialModal';
import { User, LogOut, ChevronRight } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { useProfile } from '@/hooks/useProfile';
import { useSocial } from '@/hooks/useSocial';

const DynamicMap = dynamic(() => import('@/components/MapUI'), {
  ssr: false,
  loading: () => (
    <div className="flex bg-gray-900 text-gray-400 h-full w-full items-center justify-center">
      Cargando Navegador...
    </div>
  ),
});

export default function Home() {
  const [viewMode, setViewMode] = useState<'navigation' | 'overview' | 'explore'>('navigation');

  const { 
    userPos, 
    setUserPos, 
    heading,
    hasLocation, 
    requestGPS 
  } = useGeolocation();

  const {
    route, 
    destination, 
    waypoints,
    loadingRoute, 
    routeError, 
    calculateRoute, 
    findAndTraceRoute, 
    addWaypointBefore,
    addWaypointAfter,
    clearRoute,
    checkTrafficRefresh,
    isTrafficEnabled,
    liveDistance,
    liveDuration,
    updateLiveMetrics
  } = useRoute();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRadarsEnabled, setIsRadarsEnabled] = useState(false);
  const [isAircraftsEnabled, setIsAircraftsEnabled] = useState(false);
  const [isChargersEnabled, setIsChargersEnabled] = useState(false);
  const [isWeatherEnabled, setIsWeatherEnabled] = useState(false);
  const [chargerFilters, setChargerFilters] = useState<ChargerFilters>({
    isFree: false,
    connectors: [],
    minPower: 0
  });
  const [isGasStationsEnabled, setIsGasStationsEnabled] = useState(false);
  const [gasStationFilters, setGasStationFilters] = useState<GasStationFilters>({
    fuels: [],
    maxPrice: null
  });
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [voiceType, setVoiceType] = useState<VoiceType>('mujer');
  const [lastRecalculationTime, setLastRecalculationTime] = useState(0);
  const [customZoom, setCustomZoom] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ lat: number; lon: number; screenX: number; screenY: number } | null>(null);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isGarageOpen, setIsGarageOpen] = useState(false);
  const [isSocialOpen, setIsSocialOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  const { favorites, saveFavorite, removeFavorite, isFavorite } = useFavorites();
  const speed = useSpeed(); // declarado aquí para usarlo en el recalculado automático
  
  const { profile, updateProfile } = useProfile(session);
  const { friends, addFriend } = useSocial(session, userPos);

  // Escuchar cambios de autenticación
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // Lógica de Recalculado Automático
  useEffect(() => {
    if (!route || !destination || loadingRoute) return;

    // Solo recalculamos si el usuario se está moviendo (>5 km/h)
    // Si está parado, asumimos que aún no ha empezado el trayecto
    const speedKmh = (speed ?? 0) * 3.6;
    if (speedKmh < 5) return;

    const now = Date.now();
    // Cooldown de 30 segundos entre recalculados
    if (now - lastRecalculationTime < 30000) return;

    const distOffRoute = distanceToPolyline(userPos, route.coordinates);
    
    // Si estamos a más de 100 metros del camino trazado, recalculamos
    if (distOffRoute > 100) {
      console.log("Desviación detectada (" + Math.round(distOffRoute) + "m) a " + speedKmh.toFixed(0) + " km/h. Recalculando...");
      setLastRecalculationTime(now);
      calculateRoute(userPos, destination, waypoints);
    }
  }, [userPos, speed, route, destination, waypoints, loadingRoute, lastRecalculationTime, calculateRoute]);

  // Refresco de tráfico cada 20km
  useEffect(() => {
    if (userPos) {
      checkTrafficRefresh(userPos);
      updateLiveMetrics(userPos);
    }
  }, [userPos, checkTrafficRefresh, updateLiveMetrics]);

  // Unlock audio on first interaction
  useEffect(() => {
    const unlockAudio = () => {
      unlockTeslaAudio();
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };

    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);

    return () => {
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  // Open sidebar by default only on desktop
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth > 768) {
      setIsSidebarOpen(true);
    }
  }, []);

  const { radars: allRadars, loadingRadars, fetchingRouteRadars, lastUpdate, progress } = useRadars(userPos, route?.coordinates, isRadarsEnabled);

  // Filtrar radares:
  // - Sin ruta: solo los próximos (ya se buscan en radio de 10km por useRadars)
  // - Con ruta: solo los que están en la ruta PENDIENTE por delante del usuario
  const radars = useMemo(() => {
    if (!isRadarsEnabled) return [];
    if (!route || !route.coordinates || route.coordinates.length === 0 || allRadars.length === 0) {
      return allRadars; // Sin ruta → mostrar los próximos (búsqueda local por radio)
    }

    // Encontrar el segmento de ruta más cercano al usuario
    const snapped = findClosestPointOnPolyline(userPos, route.coordinates);
    const currentSegmentIndex = snapped.segmentIndex;
    // Solo la porción de ruta que queda por delante
    const remainingRoute = route.coordinates.slice(currentSegmentIndex);

    return allRadars.filter(radar => {
      const radarPos: [number, number] = [radar.lat, radar.lon];
      // El radar debe estar a <500m del trazado restante
      const distToPath = distanceToPolyline(radarPos, remainingRoute);
      return distToPath < 500;
    });
  }, [allRadars, route, userPos]);

  const { nearestRadar, distance, isAlertActive, alertType, remainingRadars } = useAlerts(userPos, radars, isSoundEnabled, voiceType, speed);
  const { allAircrafts, aircrafts, totalCount: aircraftCount, isAnyPegasusNearby, isRateLimited, loading: loadingAircrafts, activeAccount } = usePegasus(userPos, isAircraftsEnabled, route?.coordinates);
  const { chargers, loading: loadingChargers, progress: chargerProgress } = useChargers(userPos, route?.coordinates, isChargersEnabled, chargerFilters);
  const { stations: gasStations, loading: loadingGasStations, progress: gasProgress } = useGasStations(userPos, route?.coordinates, isGasStationsEnabled, gasStationFilters);
  const { weatherPoints, loadingWeather, currentWeather } = useWeather(userPos, route?.coordinates, isWeatherEnabled);

  const notifiedPegasus = useRef<Set<string>>(new Set());
  const notifiedWaypoints = useRef<Set<string>>(new Set());
  const notifiedTraffic = useRef<Set<string>>(new Set());
  const notifiedWeather = useRef<Set<string>>(new Set());
  
  // Alerta de proximidad a paradas
  useEffect(() => {
    if (!userPos || !waypoints || waypoints.length === 0 || !isSoundEnabled) return;
    
    waypoints.forEach((wp, index) => {
      const wpKey = `${wp[0].toFixed(5)},${wp[1].toFixed(5)}`;
      const dist = getDistance(userPos, wp);
      if (dist < 500 && !notifiedWaypoints.current.has(wpKey)) {
        notifiedWaypoints.current.add(wpKey);
        playWaypointAlert(voiceType, index + 1, dist);
      }
    });
  }, [userPos, waypoints, isSoundEnabled, voiceType]);
  useEffect(() => {
    if (!isSoundEnabled || !aircrafts || aircrafts.length === 0) return;

    aircrafts.forEach(ac => {
      if (ac.distanceToUser < 10000 && !notifiedPegasus.current.has(ac.icao24)) {
        notifiedPegasus.current.add(ac.icao24);
        playPegasusAlert(voiceType, ac.callsign, ac.altitude, ac.velocity * 3.6);
      }
    });
  }, [aircrafts, isSoundEnabled, voiceType]);
  
  // Alerta de tráfico severo próxima (Aviso de colisión / retención)
  useEffect(() => {
    if (!userPos || !route || !route.sections || !isSoundEnabled) return;
    
    // Solo avisamos si vamos por encima de una velocidad mínima (ej: autovía) para evitar falsos positivos en ciudad
    // Sin embargo, el usuario pidió avisar si "los coches deberían ir a más de 80km/h"
    // TomTom no nos da el límite de velocidad de la vía fácilmente aquí, pero podemos inferir por la posición.
    
    const snapped = findClosestPointOnPolyline(userPos, route.coordinates);
    const currentIndex = snapped.segmentIndex;
    
    // Buscamos la próxima sección de tráfico con magnitud 3 o 4 (Congestión/Atasco)
    const jamSection = route.sections.find(s => s.magnitude >= 3 && s.start > currentIndex);
    
    if (jamSection) {
      // Calculamos distancia aproximada por la polilínea
      let distanceToJam = 0;
      for (let i = currentIndex; i < jamSection.start; i++) {
        distanceToJam += getDistance(route.coordinates[i], route.coordinates[i+1]);
      }
      
      // Si estamos a menos de 10km (10000 metros) y no hemos avisado para esta sección
      const sectionKey = `jam-${jamSection.start}-${jamSection.end}`;
      if (distanceToJam < 10000 && distanceToJam > 500 && !notifiedTraffic.current.has(sectionKey)) {
        notifiedTraffic.current.add(sectionKey);
        playTrafficJamAlert(voiceType, distanceToJam / 1000);
      }
    }
  }, [userPos, route, isSoundEnabled, voiceType]);

  // Alerta de clima adverso próximo
  useEffect(() => {
    if (!userPos || !weatherPoints || weatherPoints.length === 0 || !isSoundEnabled || !isWeatherEnabled) return;
    
    weatherPoints.forEach(wp => {
      // Si el clima es lluvia, nieve o tormenta
      const badWeather = ['Rain', 'Snow', 'Thunderstorm', 'Drizzle'].includes(wp.condition);
      if (!badWeather) return;
      
      const dist = getDistance(userPos, [wp.lat, wp.lon]);
      const wpKey = `weather-${wp.lat.toFixed(4)}-${wp.lon.toFixed(4)}-${wp.condition}`;
      
      // Avisamos a los 15km (15000 metros)
      if (dist < 15000 && dist > 2000 && !notifiedWeather.current.has(wpKey)) {
        notifiedWeather.current.add(wpKey);
        playWeatherAlert(voiceType, wp.condition);
      }
    });
  }, [userPos, weatherPoints, isSoundEnabled, isWeatherEnabled, voiceType]);

  // Cambio Automático de Vista (Navegación <-> Vista General) basado en velocidad
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (speed === 0 && viewMode === 'navigation') {
      // Temporizador de 60 segundos si estamos parados
      timeoutId = setTimeout(() => {
        setViewMode('overview');
        setCustomZoom(null); // Borramos posible zoom manual para usar la vista panorámica natural
      }, 60000);
    } else if (speed > 0 && viewMode === 'overview') {
      // Vuelta automática al arrancar
      setViewMode('navigation');
      setCustomZoom(null);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [speed, viewMode]);

  const handleSearchSubmit = async (query: string) => {
    const origin: [number, number] = userPos || [40.4168, -3.7038];
    await findAndTraceRoute(origin, query);
  };

  const handleMapClick = useCallback((lat: number, lon: number, screenX: number, screenY: number) => {
    setContextMenu({ lat, lon, screenX, screenY });
  }, []);

  const handleNavigateToPoint = useCallback(() => {
    if (!contextMenu) return;
    const origin: [number, number] = userPos || [40.4168, -3.7038];
    calculateRoute(origin, [contextMenu.lat, contextMenu.lon]);
  }, [contextMenu, userPos, calculateRoute]);

  const handleSaveFavorite = useCallback((name: string) => {
    if (!contextMenu) return;
    saveFavorite(contextMenu.lat, contextMenu.lon, name);
  }, [contextMenu, saveFavorite]);

  const handleAddStopBefore = useCallback(() => {
    if (!contextMenu) return;
    const origin: [number, number] = userPos || [40.4168, -3.7038];
    addWaypointBefore(origin, [contextMenu.lat, contextMenu.lon]);
  }, [contextMenu, userPos, addWaypointBefore]);

  const handleAddStopAfter = useCallback(() => {
    if (!contextMenu) return;
    const origin: [number, number] = userPos || [40.4168, -3.7038];
    addWaypointAfter(origin, [contextMenu.lat, contextMenu.lon]);
  }, [contextMenu, userPos, addWaypointAfter]);

  return (
    <main className="flex h-screen w-full overflow-hidden bg-gray-950 font-sans text-white selection:bg-blue-500/30">
      
      {/* Alerta de Radar */}
      {isAlertActive && nearestRadar && distance !== null && (
        <AlertOverlay 
          radar={nearestRadar} 
          distance={distance} 
          alertType={alertType}
          currentSpeed={speed}
        />
      )}

      {/* Botón de Toggle Sidebar (Mobile) */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed top-6 left-6 z-[600] md:hidden h-12 w-12 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 shadow-2xl"
      >
        {isSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Banner de Estado GPS */}
      {!hasLocation && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[600] w-[90%] max-w-md bg-amber-600/90 backdrop-blur-md p-3 rounded-2xl border border-white/20 shadow-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <MapPin className="h-5 w-5 text-white animate-pulse" />
            <p className="text-xs font-bold text-white">Ubicación no detectada. ¿Estás en Madrid?</p>
          </div>
          <button 
            onClick={requestGPS}
            className="bg-white text-black text-[10px] font-black px-3 py-2 rounded-lg hover:scale-105 transition-all"
          >
            ACTIVAR GPS
          </button>
        </div>
      )}

      {/* Botón de Perfil / Iniciar Sesión (Top Right) */}
      <div className="fixed top-6 right-6 z-[600] flex items-center gap-3">
        {session ? (
          <div className="flex items-center gap-2 group">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-white uppercase italic tracking-tighter bg-blue-600 px-2 py-0.5 rounded-sm shadow-lg leading-none">USUARIO ACTIVO</span>
              <span className="text-[14px] font-black text-white italic tracking-tight">{profile?.car_name || session.user.email?.split('@')[0]}</span>
            </div>
            <button 
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="h-12 w-12 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 shadow-2xl hover:bg-white/10 transition-all group overflow-hidden"
            >
              <img src="/avatar.png" alt="Avatar" className="h-full w-full object-cover group-hover:scale-110 transition-transform" />
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setIsAuthModalOpen(true)}
            className="h-12 w-12 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 shadow-2xl hover:bg-white/10 transition-all animate-in fade-in slide-in-from-top-4 duration-700 overflow-hidden group"
          >
            <img src="/avatar.png" alt="Avatar" className="h-full w-full object-cover group-hover:scale-110 transition-transform" />
          </button>
        )}
      </div>

      {/* Menú Desplegable de Usuario */}
      <UserMenu 
        isOpen={isUserMenuOpen}
        onClose={() => setIsUserMenuOpen(false)}
        onOpenGarage={() => setIsGarageOpen(true)}
        onOpenSocial={() => setIsSocialOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLogout={handleSignOut}
      />

      {/* Lista de Amigos (Right Side) */}
      {session && friends.length > 0 && (
        <div className="fixed top-24 right-6 z-[500] flex flex-col gap-2 animate-in fade-in slide-in-from-right-4 duration-1000">
          <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/5 self-end mb-2">
            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest leading-none">Amigos Conectados</span>
          </div>
          {friends.map((friend) => (
            <div 
              key={friend.id}
              className="flex items-center gap-3 bg-black/60 backdrop-blur-xl border border-white/10 p-2 pr-4 rounded-2xl shadow-xl group hover:border-white/20 transition-all"
            >
              <div className="relative">
                <div className="h-10 w-10 rounded-xl bg-gray-800 flex items-center justify-center overflow-hidden border border-white/5">
                   <img src="/avatar.png" alt={friend.car_name} className="h-full w-full object-cover opacity-50" />
                </div>
                <div className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-gray-900 ${friend.is_online ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black text-white italic leading-tight uppercase">{friend.car_name}</span>
                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter leading-none">En su {friend.car_color}</span>
              </div>
              <button 
                className="ml-2 opacity-0 group-hover:opacity-100 transition-all h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10"
                onClick={() => {
                   if (friend.last_lat && friend.last_lon) {
                     // Centrar mapa en amigo (Lógica extra si se desea)
                   }
                }}
              >
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Panel Izquierdo (Bloque de Control) */}
      <Sidebar 
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        loadingRoute={loadingRoute}
        routeError={routeError}
        route={route}
        clearRoute={clearRoute}
        loadingRadars={loadingRadars}
        fetchingRouteRadars={fetchingRouteRadars}
        radars={radars}
        isRadarsEnabled={isRadarsEnabled}
        setIsRadarsEnabled={setIsRadarsEnabled}
        remainingRadars={remainingRadars}
        isAnyPegasusNearby={isAnyPegasusNearby}
        isRateLimited={isRateLimited}
        loadingAircrafts={loadingAircrafts}
        aircraftCount={aircrafts.length}
        isAircraftsEnabled={isAircraftsEnabled}
        setIsAircraftsEnabled={setIsAircraftsEnabled}
        activeAccount={activeAccount}
        rawAircraftCount={aircraftCount}
        hasLocation={hasLocation}
        onSearch={handleSearchSubmit}
        isSoundEnabled={isSoundEnabled}
        setIsSoundEnabled={setIsSoundEnabled}
        voiceType={voiceType}
        setVoiceType={setVoiceType}
        onOpenFavorites={() => setIsFavoritesOpen(true)}
        radarProgress={progress}
        isTrafficEnabled={isTrafficEnabled}
        liveDistance={liveDistance}
        liveDuration={liveDuration}
        waypoints={waypoints}
        isChargersEnabled={isChargersEnabled}
        setIsChargersEnabled={setIsChargersEnabled}
        chargerFilters={chargerFilters}
        setChargerFilters={setChargerFilters}
        chargersCount={chargers.length}
        loadingChargers={loadingChargers}
        chargerProgress={chargerProgress}
        isGasStationsEnabled={isGasStationsEnabled}
        setIsGasStationsEnabled={setIsGasStationsEnabled}
        gasStationFilters={gasStationFilters}
        setGasStationFilters={setGasStationFilters}
        gasStationsCount={gasStations.length}
        loadingGasStations={loadingGasStations}
        gasProgress={gasProgress}
        isWeatherEnabled={isWeatherEnabled}
        setIsWeatherEnabled={setIsWeatherEnabled}
        currentWeather={currentWeather}
        loadingWeather={loadingWeather}
      />

      {/* Sección del Mapa (Fondo) */}
      <section className="relative flex-1 bg-gray-900 overflow-hidden">
        <DynamicMap 
          userPos={userPos}
          heading={heading}
          routeCoordinates={route?.coordinates} 
          radars={radars}
          aircrafts={allAircrafts}
          chargers={chargers}
          gasStations={gasStations}
          weatherPoints={weatherPoints}
          waypoints={waypoints}
          speed={speed}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          customZoom={customZoom}
          onZoomChange={setCustomZoom}
          onMapClick={handleMapClick}
          routeSections={route?.sections}
          carColor={profile?.car_color}
        />

        {/* Panel de Avisos Rápidos y Velocímetro */}
        <div className="absolute bottom-6 right-6 z-[500] flex flex-col items-end gap-3 md:flex-row md:items-center md:gap-4 md:bottom-8 md:right-8">

          {/* Botones de Zoom — visibles solo en navegación/exploración */}
          {viewMode !== 'overview' && (
            <div className="flex flex-row gap-3 md:flex-col md:gap-2">
              <button
                onClick={() => setCustomZoom((customZoom ?? 17) + 1)}
                className="flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-2xl shadow-2xl bg-gray-800 hover:bg-gray-700 border border-white/20 transition-all hover:scale-105 active:scale-95 group relative"
              >
                <img src="/zoom-in.png" alt="Acercar" className="h-8 w-8 md:h-10 md:w-10 object-contain drop-shadow-md" />
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 scale-0 group-hover:scale-100 transition-all bg-black/80 px-3 py-1 rounded text-[10px] font-bold whitespace-nowrap">Acercar</span>
              </button>
              <button
                onClick={() => setCustomZoom((customZoom ?? 17) - 1)}
                className="flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-2xl shadow-2xl bg-gray-800 hover:bg-gray-700 border border-white/20 transition-all hover:scale-105 active:scale-95 group relative"
              >
                <img src="/zoom-out.png" alt="Alejar" className="h-8 w-8 md:h-10 md:w-10 object-contain drop-shadow-md" />
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 scale-0 group-hover:scale-100 transition-all bg-black/80 px-3 py-1 rounded text-[10px] font-bold whitespace-nowrap">Alejar</span>
              </button>
            </div>
          )}

          <Speedometer speed={speed} />
          
          <div className="flex flex-col gap-3 md:flex-row">
            {viewMode !== 'overview' && (
              <button 
                onClick={() => { setViewMode('overview'); setCustomZoom(null); }}
                className="flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-2xl shadow-2xl transition-all hover:scale-105 active:scale-95 group relative border border-white/20 bg-gray-800 hover:bg-gray-700"
              >
                <img src="/mapa.png" alt="Vista General" className="h-6 w-6 md:h-8 md:w-8 object-contain drop-shadow-md" />
                <span className="absolute -top-10 right-0 scale-0 group-hover:scale-100 transition-all bg-black/80 px-3 py-1 rounded text-[10px] font-bold whitespace-nowrap">Vista General</span>
              </button>
            )}
            {viewMode !== 'navigation' && (
              <button 
                onClick={() => {
                  if (!hasLocation) requestGPS();
                  setViewMode('navigation');
                  setCustomZoom(null);
                }}
                className="flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-2xl shadow-2xl transition-all hover:scale-105 active:scale-95 group relative border border-white/20 bg-gray-800 hover:bg-gray-700"
              >
                <img src="/volante.png" alt="Modo Navegación" className="h-6 w-6 md:h-8 md:w-8 object-contain drop-shadow-md" />
                <span className="absolute -top-10 right-0 scale-0 group-hover:scale-100 transition-all bg-black/80 px-3 py-1 rounded text-[10px] font-bold whitespace-nowrap">Modo Navegación</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Menú contextual del mapa */}
      {contextMenu && (
        <MapContextMenu
          lat={contextMenu.lat}
          lon={contextMenu.lon}
          screenX={contextMenu.screenX}
          screenY={contextMenu.screenY}
          hasRoute={!!route}
          isFavorite={isFavorite(contextMenu.lat, contextMenu.lon)}
          onNavigate={handleNavigateToPoint}
          onSaveFavorite={handleSaveFavorite}
          onAddStopBefore={handleAddStopBefore}
          onAddStopAfter={handleAddStopAfter}
          onClose={() => setContextMenu(null)}
        />
      )}
      {/* Panel de Favoritos */}
      {isFavoritesOpen && (
        <FavoritesPanel
          favorites={favorites}
          onNavigate={(fav) => {
            const origin: [number, number] = userPos || [40.4168, -3.7038];
            calculateRoute(origin, [fav.lat, fav.lon]);
            setIsFavoritesOpen(false);
          }}
          onDelete={removeFavorite}
          onClose={() => setIsFavoritesOpen(false)}
        />
      )}

      {/* Modal de Autenticación */}
      {isAuthModalOpen && (
        <AuthModal onClose={() => setIsAuthModalOpen(false)} />
      )}

      {/* Modal de Mi Vehículo (Garaje) */}
      <GarageModal 
        isOpen={isGarageOpen}
        onClose={() => setIsGarageOpen(false)}
        profile={profile}
        onUpdate={updateProfile}
      />

      {/* Modal Social (Viajar con Amigos) */}
      <SocialModal 
        isOpen={isSocialOpen}
        onClose={() => setIsSocialOpen(false)}
        session={session}
        onAddFriend={addFriend}
      />
    </main>
  );
}
