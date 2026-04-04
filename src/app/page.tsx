'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { MapPin, Navigation, Menu, X, AlertTriangle, Power, Map } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import Sidebar from '@/components/Sidebar';
import AlertOverlay from '@/components/AlertOverlay';
import Speedometer from '@/components/Speedometer';
import SessionAlert from '@/components/SessionAlert';


import { useRoute } from '@/hooks/useRoute';
import { useRadars } from '@/hooks/useRadars';
import { useAlerts } from '@/hooks/useAlerts';
import { useSpeed } from '@/hooks/useSpeed';
import { usePegasus } from '@/hooks/usePegasus';
import { useAircraftSimulator } from '@/hooks/useAircraftSimulator';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useRouteSimulator } from '@/hooks/useRouteSimulator';



import { getDistance, distanceToPolyline, findClosestPointOnPolyline } from '@/utils/geo';
import { playPegasusAlert, playWaypointAlert, playTrafficJamAlert, playWeatherAlert, unlockTeslaAudio, VoiceType } from '@/utils/sound';
import MapContextMenu from '@/components/MapContextMenu';
import FavoritesPanel from '@/components/FavoritesPanel';
import { useFavorites } from '@/hooks/useFavorites';
import { useChargers, ChargerFilters, Charger } from '@/hooks/useChargers';
import { useGasStations, GasStationFilters, GasStation } from '@/hooks/useGasStations';
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
import RouteDashboard from '@/components/RouteDashboard';
import NavigationPanel from '@/components/NavigationPanel';

const DynamicMap = dynamic(() => import('@/components/MapUI'), {
  ssr: false,
  loading: () => (
    <div className="flex bg-gray-900 text-gray-400 h-full w-full items-center justify-center">
      Cargando Navegador...
    </div>
  ),
});

export default function Home() {
  const sessionClientId = useRef(typeof window !== 'undefined' ? crypto.randomUUID() : '').current;
  const [viewMode, setViewMode] = useState<'navigation' | 'overview'>('overview');
  const [isSessionDuplicated, setIsSessionDuplicated] = useState(false);


  const [isSimulatingState, setIsSimulatingState] = useState(false);

  const { 
    userPos, 
    setUserPos, 
    heading,
    setHeading,
    hasLocation, 
    requestGPS 
  } = useGeolocation(isSimulatingState);

  const { speed, setSpeed } = useSpeed(isSimulatingState);

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
    nextInstruction,
    activeLaneGuidance,
    distanceToNextInstruction,
    updateLiveMetrics
  } = useRoute();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRadarsEnabled, setIsRadarsEnabled] = useState(false);
  const [isAircraftsEnabled, setIsAircraftsEnabled] = useState(false);
  const [isChargersEnabled, setIsChargersEnabled] = useState(false);
  const [isWeatherEnabled, setIsWeatherEnabled] = useState(false);
  
  const [chargerFilters, setChargerFilters] = useState<ChargerFilters>({
    isFree: false, connectors: [], minPower: 0
  });

  const [isGasStationsEnabled, setIsGasStationsEnabled] = useState(false);
  const [gasStationFilters, setGasStationFilters] = useState<GasStationFilters>({
    fuels: [], maxPrice: null
  });

  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [voiceType, setVoiceType] = useState<VoiceType>('mujer');
  const [lastRecalculationTime, setLastRecalculationTime] = useState(0);
  const [customZoom, setCustomZoom] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ lat: number; lon: number; screenX: number; screenY: number } | null>(null);
  const [selectedPOI, setSelectedPOI] = useState<
    | { type: 'charger'; data: Charger }
    | { type: 'gasStation'; data: GasStation }
    | null
  >(null);

  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isGarageOpen, setIsGarageOpen] = useState(false);
  const [isSocialOpen, setIsSocialOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  const { favorites, saveFavorite, removeFavorite, isFavorite } = useFavorites();

  const { 
    isSimulating, 
    startSimulation, 
    stopSimulation 
  } = useRouteSimulator({
    routeCoordinates: route?.coordinates,
    sections: route?.sections,
    setUserPos,
    setHeading,
    setSpeed,
    setIsSimulating: setIsSimulatingState
  });



  
  const { profile, updateProfile } = useProfile(session);
  const { friends, addFriend } = useSocial(session, userPos);
  
  const wasStoppedRef = useRef(true);
  const isManualOverviewRef = useRef(false);
  const [mapCenterOverride, setMapCenterOverride] = useState<[number, number] | null>(null);

  const [overviewFitTrigger, setOverviewFitTrigger] = useState(0);

  const handleManualViewModeChange = useCallback((mode: 'navigation' | 'overview') => {
    isManualOverviewRef.current = mode === 'overview';
    setViewMode(mode);
    setCustomZoom(null);
    if (mode === 'overview') {
      setOverviewFitTrigger(prev => prev + 1);
    }
  }, []);

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
    setIsUserMenuOpen(false);
    setIsGarageOpen(false);
    setIsSocialOpen(false);
    setIsSettingsOpen(false);
    await supabase.auth.signOut();
  };

  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // 1. Cargar preferencias guardadas en el perfil al iniciar sesión
  useEffect(() => {
    if (profile && !prefsLoaded) {
      const p = profile.preferences || {};
      if (p.isRadarsEnabled !== undefined) setIsRadarsEnabled(p.isRadarsEnabled);
      if (p.isAircraftsEnabled !== undefined) setIsAircraftsEnabled(p.isAircraftsEnabled);
      if (p.isChargersEnabled !== undefined) setIsChargersEnabled(p.isChargersEnabled);
      if (p.chargerFilters !== undefined) setChargerFilters(p.chargerFilters);
      if (p.isGasStationsEnabled !== undefined) setIsGasStationsEnabled(p.isGasStationsEnabled);
      if (p.gasStationFilters !== undefined) setGasStationFilters(p.gasStationFilters);
      if (p.isWeatherEnabled !== undefined) setIsWeatherEnabled(p.isWeatherEnabled);
      if (p.isSoundEnabled !== undefined) setIsSoundEnabled(p.isSoundEnabled);
      if (p.voiceType !== undefined) setVoiceType(p.voiceType);
      
      setPrefsLoaded(true);
    }
  }, [profile, prefsLoaded]);

  // Resetear flag si el usuario cierra sesión
  useEffect(() => {
    if (!session) {
      setPrefsLoaded(false);
    }
  }, [session]);

  // 2. Guardar preferencias explícitamente cuando el usuario pulse el botón Guardar
  const handleSavePreferences = useCallback(async () => {
    if (!session) return;
    const res = await updateProfile({
      preferences: {
        isRadarsEnabled,
        isAircraftsEnabled,
        isChargersEnabled,
        chargerFilters,
        isGasStationsEnabled,
        gasStationFilters,
        isWeatherEnabled,
        isSoundEnabled,
        voiceType
      }
    });
    
    if (res.success) {
      console.log('[Prefs] Configuración guardada correctamente');
    }
  }, [
    session, updateProfile, isRadarsEnabled, isAircraftsEnabled, isChargersEnabled, 
    chargerFilters, isGasStationsEnabled, gasStationFilters, isWeatherEnabled, 
    isSoundEnabled, voiceType
  ]);

  // 2.1 Auto-save con debounce (2 segundos)
  useEffect(() => {
    if (!session || !prefsLoaded) return;

    const timer = setTimeout(() => {
      console.log('[Prefs] Auto-guardando cambios detectados...');
      handleSavePreferences();
    }, 2000);

    return () => clearTimeout(timer);
  }, [
    isRadarsEnabled, isAircraftsEnabled, isChargersEnabled, 
    chargerFilters, isGasStationsEnabled, gasStationFilters, 
    isWeatherEnabled, isSoundEnabled, voiceType,
    session, prefsLoaded, handleSavePreferences
  ]);


  // 3. Gestión de Sesión Única (Realtime)
  useEffect(() => {
    if (!session?.user) return;

    // Registrar esta sesión como la activa
    updateProfile({ last_session_id: sessionClientId });

    // Escuchar si el last_session_id cambia en la DB (otro dispositivo entró)
    const channel = supabase
      .channel(`profile_session_${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${session.user.id}`
        },
        (payload) => {
          const newSessionId = payload.new.last_session_id;
          if (newSessionId && newSessionId !== sessionClientId) {
            console.warn('[Auth] Sesión iniciada en otro dispositivo');
            setIsSessionDuplicated(true);
            handleSignOut();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, sessionClientId, updateProfile]);

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

  const lastMetricsUpdateRef = useRef(0);

  // Refresco de tráfico cada 20km y métricas en vivo
  useEffect(() => {
    if (userPos) {
      checkTrafficRefresh(userPos);
      
      const now = performance.now();
      if (now - lastMetricsUpdateRef.current > 500) { // Cada 500ms es suficiente para la UI
        updateLiveMetrics(userPos);
        lastMetricsUpdateRef.current = now;
      }
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
  const { allAircrafts, aircrafts, visibleAircrafts, totalCount: aircraftCount, isAnyPegasusNearby, isRateLimited, loading: loadingAircrafts, activeAccount } = usePegasus(userPos, isAircraftsEnabled, route?.coordinates);
 
  // Posiciones interpoladas cada 1 s — movimiento fluido para los aviones visibles (25km máximo)
  const simulatedAircrafts = useAircraftSimulator(visibleAircrafts);

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
    const speedKmh = (speed ?? 0) * 3.6;

    if (speedKmh < 4) {
      wasStoppedRef.current = true;
      if (viewMode === 'navigation') {
        // Parado (menos de 4 km/h real para ignorar ruido): temporizador para volver a vista general
        timeoutId = setTimeout(() => {
          setViewMode('overview');
          setCustomZoom(null);
        }, 60000);
      }
    } else if (speedKmh > 7) {
      // Solo volvemos a navegación si veníamos de estar parados (para no obligar a volver si el usuario cambió a overview manualmente conduciendo)
      // Y además, si el usuario explícitamente puso el modo manual general, NO le obligamos a volver.
      if (wasStoppedRef.current && viewMode === 'overview' && !isManualOverviewRef.current) {
        setViewMode('navigation');
        setCustomZoom(null);
        wasStoppedRef.current = false;
      } else {
        wasStoppedRef.current = false;
      }
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

  const handleChargerClick = useCallback((charger: Charger) => {
    setSelectedPOI({ type: 'charger', data: charger });
    handleManualViewModeChange('overview');
    setContextMenu(null);
  }, [handleManualViewModeChange]);

  const handleGasStationClick = useCallback((station: GasStation) => {
    setSelectedPOI({ type: 'gasStation', data: station });
    handleManualViewModeChange('overview');
    setContextMenu(null);
  }, [handleManualViewModeChange]);

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
              <span className="text-[14px] font-black text-white italic tracking-tight">
                {profile?.car_name && profile.car_name.trim().length > 0 
                  ? profile.car_name 
                  : (session.user.user_metadata?.full_name || session.user.email?.split('@')[0])}
              </span>
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
        isFullscreen={!isSidebarOpen}
        onToggleFullscreen={() => setIsSidebarOpen(!isSidebarOpen)}
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
                     setViewMode('overview');
                     setMapCenterOverride([friend.last_lat, friend.last_lon]);
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
      {/* Branding NavegaPRO (Oculto si hay instrucciones de navegación activas en modo pantalla completa) */}
      <AnimatePresence>
        {(!route || isSidebarOpen) && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="fixed top-8 left-8 z-[100] flex items-center gap-5 pointer-events-none select-none"
          >
            <img 
              src="/pro-logo.png?v=5" 
              alt="NavegaPRO Logo" 
              className="h-20 w-auto object-contain drop-shadow-2xl" 
            />
            <AnimatePresence>
              {isSidebarOpen && (
                <motion.h1
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="text-4xl font-black italic tracking-tighter bg-gradient-to-r from-blue-200 via-blue-500 to-blue-900 bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(59,130,246,0.4)] pr-4 pb-1"
                >
                  NavegaPRO
                </motion.h1>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <NavigationPanel 
        isVisible={!isSidebarOpen && viewMode === 'navigation' && !!route}
        instruction={nextInstruction}
        distance={distanceToNextInstruction}
        activeLaneGuidance={activeLaneGuidance}
        isSimulating={isSimulating}
      />


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
        onSavePreferences={handleSavePreferences}
        isLoggedIn={!!session}
      />

      {/* Sección del Mapa (Fondo) */}
      <section className="relative flex-1 bg-gray-900 overflow-hidden">
        <DynamicMap 
          userPos={userPos}
          heading={heading}
          hasLocation={hasLocation}
          routeCoordinates={route?.coordinates} 
          radars={radars}
          aircrafts={simulatedAircrafts}
          chargers={chargers}
          gasStations={gasStations}
          weatherPoints={weatherPoints}
          waypoints={waypoints}
          speed={speed}
          viewMode={viewMode}
          onViewModeChange={(mode) => handleManualViewModeChange(mode as 'navigation' | 'overview')}
          customZoom={customZoom}
          onZoomChange={setCustomZoom}
          onMapClick={handleMapClick}
          onChargerClick={handleChargerClick}
          onGasStationClick={(s) => setSelectedPOI({ type: 'gasStation', data: s })}
          onOpenGarage={() => setIsGarageOpen(true)}
          routeSections={route?.sections}
          carColor={profile?.car_color}
          friends={friends}
          centerOverride={mapCenterOverride}
          overviewFitTrigger={overviewFitTrigger}
          distanceToNextInstruction={distanceToNextInstruction}
          isSimulating={isSimulating}
        />


        {/* Nuevo Dashboard de Ruta Compacto (Solo en Pantalla Completa + Ruta Activa) */}
        <AnimatePresence>
          {!isSidebarOpen && route && (
            <RouteDashboard 
              totalDistance={route.distance}
              totalDuration={route.duration}
              remainingDistance={liveDistance ?? route.distance}
              remainingDuration={liveDuration ?? route.duration}
              remainingRadarsCount={remainingRadars}
              onEndRoute={clearRoute}
              isSimulating={isSimulating}
              onStartSimulation={startSimulation}
              onStopSimulation={stopSimulation}
            />
          )}
        </AnimatePresence>

        {/* Panel de Avisos Rápidos y Velocímetro */}
        <div className="absolute bottom-6 right-6 z-[500] flex flex-col items-end gap-3 md:flex-row md:items-center md:gap-4 md:bottom-8 md:right-8">


          <Speedometer speed={speed} />
          
          <div className="flex flex-col gap-3 md:flex-row">
            {viewMode === 'navigation' && (
              <button 
                onClick={() => handleManualViewModeChange('overview')}
                className="flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-2xl shadow-2xl transition-all hover:scale-105 active:scale-95 group relative border border-white/20 bg-gray-800 hover:bg-gray-700"
              >
                <img src="/mapa.png" alt="Vista General" className="h-6 w-6 md:h-8 md:w-8 object-contain drop-shadow-md" />
                <span className="absolute -top-10 right-0 scale-0 group-hover:scale-100 transition-all bg-black/80 px-3 py-1 rounded text-[10px] font-bold whitespace-nowrap">Vista General</span>
              </button>
            )}
            {viewMode === 'overview' && (
              <>
                <button 
                  onClick={() => setOverviewFitTrigger(prev => prev + 1)}
                  className="flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-2xl shadow-2xl transition-all hover:scale-105 active:scale-95 group relative border border-white/20 bg-gray-800 hover:bg-gray-700"
                >
                  <Map className="h-6 w-6 md:h-8 md:w-8 text-white drop-shadow-md" />
                  <span className="absolute -top-10 right-0 scale-0 group-hover:scale-100 transition-all bg-black/80 px-3 py-1 rounded text-[10px] font-bold whitespace-nowrap">Centrar Mapa Global</span>
                </button>
                <button 
                  onClick={() => {
                    if (!hasLocation) requestGPS();
                    handleManualViewModeChange('navigation');
                  }}
                  className="flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-2xl shadow-2xl transition-all hover:scale-105 active:scale-95 group relative border border-white/20 bg-blue-600/80 hover:bg-blue-500 border-blue-400/50"
                >
                  <img src="/volante.png" alt="Modo Navegación" className="h-6 w-6 md:h-8 md:w-8 object-contain drop-shadow-md" />
                  <span className="absolute -top-10 right-0 scale-0 group-hover:scale-100 transition-all bg-black/80 px-3 py-1 rounded text-[10px] font-bold whitespace-nowrap">Modo Navegación</span>
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Menú contextual del mapa (clic derecho genérico) */}
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

      {/* Panel unificado de Cargador EV o Gasolinera */}
      {selectedPOI && (() => {
        const isCharger = selectedPOI.type === 'charger';
        const poi = selectedPOI.data;
        const lat = isCharger ? (poi as Charger).lat : (poi as GasStation).lat;
        const lon = isCharger ? (poi as Charger).lon : (poi as GasStation).lon;
        const accentColor = isCharger ? 'emerald' : 'orange';
        const fuelLabels: Record<string, string> = { g95: 'G95', g98: 'G98', diesel: 'Diésel', glp: 'GLP' };

        const handleNavigateToPOI = () => {
          const origin: [number, number] = userPos || [40.4168, -3.7038];
          calculateRoute(origin, [lat, lon]);
          setSelectedPOI(null);
        };
        const handleAddStopBeforePOI = () => {
          const origin: [number, number] = userPos || [40.4168, -3.7038];
          addWaypointBefore(origin, [lat, lon]);
          setSelectedPOI(null);
        };
        const handleAddStopAfterPOI = () => {
          const origin: [number, number] = userPos || [40.4168, -3.7038];
          addWaypointAfter(origin, [lat, lon]);
          setSelectedPOI(null);
        };
        const handleSaveFavPOI = () => {
          const name = isCharger ? (poi as Charger).title : (poi as GasStation).name;
          saveFavorite(lat, lon, name);
        };
        const alreadyFav = isFavorite(lat, lon);

        return (
          <div className="fixed bottom-0 left-0 right-0 z-[700] flex justify-center px-4 pb-6 animate-in slide-in-from-bottom-4 duration-300">
            <div className={`w-full max-w-lg bg-gray-950/95 backdrop-blur-xl rounded-3xl border border-white/10 shadow-[0_-20px_60px_rgba(0,0,0,0.6)] overflow-hidden`}>
              
              {/* Cabecera del POI */}
              <div className={`flex items-center gap-3 p-4 border-b border-white/5 bg-gradient-to-r ${
                isCharger ? 'from-emerald-950/60 to-transparent' : 'from-orange-950/60 to-transparent'
              }`}>
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg ${
                  isCharger ? 'bg-emerald-600' : 'bg-orange-500'
                }`}>
                  <img
                    src={isCharger ? '/cargadorEV.png' : '/gasolinera.png'}
                    alt={isCharger ? 'Cargador EV' : 'Gasolinera'}
                    className="h-6 w-6 object-contain"
                    style={{ filter: 'brightness(0) invert(1)' }}
                  />
                </div>
                <div className="flex flex-col flex-1 overflow-hidden">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${
                    isCharger ? 'text-emerald-400' : 'text-orange-400'
                  }`}>{isCharger ? 'Cargador Eléctrico' : 'Gasolinera'}</span>
                  <h2 className="font-black text-white text-sm leading-tight truncate">
                    {isCharger ? (poi as Charger).title : (poi as GasStation).name}
                  </h2>
                  <p className="text-[11px] text-gray-400 truncate">
                    {isCharger ? (poi as Charger).operator : (poi as GasStation).city}
                  </p>
                </div>
              </div>

              {/* Detalles del POI */}
              <div className="p-4 flex flex-col gap-3">
                {isCharger && (() => {
                  const c = poi as Charger;
                  return (
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center bg-emerald-950/30 border border-emerald-500/20 rounded-xl px-3 py-2">
                        <span className="text-xs text-gray-400">Potencia Máxima</span>
                        <span className="font-black text-emerald-400 text-sm">{c.maxPower > 0 ? `${c.maxPower} kW` : 'N/D'}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-400">
                        <div><span className="font-bold text-gray-500 uppercase tracking-widest text-[9px]">Coste</span><p className="text-white">{c.usageCost}</p></div>
                        <div><span className="font-bold text-gray-500 uppercase tracking-widest text-[9px]">Dirección</span><p className="text-white truncate">{c.address}</p></div>
                      </div>
                    </div>
                  );
                })()}

                {!isCharger && (() => {
                  const s = poi as GasStation;
                  return (
                    <div className="flex flex-col gap-2">
                      {s.cheapestFuelPrice && (gasStationFilters.fuels?.length ?? 0) > 0 && (
                        <div className="flex justify-between items-center bg-orange-950/30 border border-orange-500/20 rounded-xl px-3 py-2">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Precio más barato</span>
                            <span className="text-[10px] text-orange-300">
                              {(gasStationFilters.fuels ?? []).map(f => ({'g95': 'G95', 'g98': 'G98', 'diesel': 'Diésel', 'glp': 'GLP'}[f] ?? f)).join(' / ')}
                            </span>
                          </div>
                          <span className="font-black text-orange-400 text-base">{s.cheapestFuelPrice.toFixed(3)} €/L</span>
                        </div>
                      )}
                      {(s.price_g95 || s.price_g98 || s.price_diesel || s.price_glp) && (
                        <div className="grid grid-cols-4 gap-1.5">
                          {[['G95', s.price_g95], ['G98', s.price_g98], ['Diésel', s.price_diesel], ['GLP', s.price_glp]]
                            .filter(([, v]) => v)
                            .map(([label, val]) => (
                              <div key={label as string} className="flex flex-col items-center bg-white/5 border border-white/10 rounded-xl py-2">
                                <span className="text-[9px] font-bold text-gray-500 uppercase">{label}</span>
                                <span className="text-xs font-black text-white">{(val as number).toFixed(3)}€</span>
                              </div>
                            ))
                          }
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-400">
                        <div><span className="font-bold text-gray-500 uppercase tracking-widest text-[9px]">Horario</span><p className="text-white">{s.schedule}</p></div>
                        <div><span className="font-bold text-gray-500 uppercase tracking-widest text-[9px]">Dirección</span><p className="text-white truncate">{s.address}</p></div>
                      </div>
                    </div>
                  );
                })()}

                {/* Botones de acción */}
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    onClick={handleNavigateToPOI}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl font-black text-xs text-white transition-all hover:scale-[1.02] active:scale-[0.98] ${
                      isCharger ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-orange-500 hover:bg-orange-400'
                    }`}
                  >
                    <img src="/navegacion.png" alt="" className="h-4 w-4 object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
                    Ir aquí
                  </button>
                  <button
                    onClick={handleSaveFavPOI}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl font-black text-xs transition-all hover:scale-[1.02] active:scale-[0.98] border ${
                      alreadyFav
                        ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                        : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    <span>{alreadyFav ? '★' : '☆'}</span>
                    {alreadyFav ? 'Guardado' : 'Guardar'}
                  </button>
                  {route && (
                    <>
                      <button
                        onClick={handleAddStopBeforePOI}
                        className="flex items-center justify-center gap-2 py-3 rounded-xl font-black text-xs text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
                      >
                        ↑ Parada antes
                      </button>
                      <button
                        onClick={handleAddStopAfterPOI}
                        className="flex items-center justify-center gap-2 py-3 rounded-xl font-black text-xs text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
                      >
                        ↓ Parada después
                      </button>
                    </>
                  )}
                </div>

                {/* Botón Cerrar */}
                <button
                  onClick={() => setSelectedPOI(null)}
                  className="w-full py-3.5 rounded-xl font-black text-sm text-gray-400 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-all mt-1"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
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
        sessionName={session?.user?.user_metadata?.full_name || session?.user?.email || ''}
        isLoggedIn={!!session}
        onOpenAuth={() => {
          setIsGarageOpen(false);
          setIsAuthModalOpen(true);
        }}
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
