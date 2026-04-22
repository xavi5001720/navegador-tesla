'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Car, Menu, Search, X, Navigation, AlertTriangle, Power, Map, User, LogOut, ChevronRight, Users, Trash2, Check, UserCheck, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import Sidebar from '@/components/Sidebar';
import SearchPanel from '@/components/SearchPanel';
import AlertOverlay from '@/components/AlertOverlay';
import Speedometer from '@/components/Speedometer';
import IncidentReporter from '@/components/IncidentReporter';
import SessionAlert from '@/components/SessionAlert';
import DevGuard from '@/components/DevGuard';


import { useRoute } from '@/hooks/useRoute';
import { useRadars } from '@/hooks/useRadars';
import { useAlerts } from '@/hooks/useAlerts';
import { useSpeed } from '@/hooks/useSpeed';
import { usePegasus } from '@/hooks/usePegasus';
// useAircraftSimulator was moved to MapUI.tsx
import { useGeolocation } from '@/hooks/useGeolocation';
import { useRouteSimulator } from '@/hooks/useRouteSimulator';



import { getDistance, distanceToPolyline, findClosestPointOnPolyline } from '@/utils/geo';
import { logger } from '@/lib/logger';
import { playPegasusAlert, playWaypointAlert, playTrafficJamAlert, playWeatherAlert, unlockTeslaAudio, VoiceType } from '@/utils/sound';
import MapContextMenu from '@/components/MapContextMenu';
import FavoritesPanel from '@/components/FavoritesPanel';
import { useFavorites } from '@/hooks/useFavorites';
import { useChargers, ChargerFilters, Charger } from '@/hooks/useChargers';
import { useGasStations, GasStationFilters, GasStation } from '@/hooks/useGasStations';
import { useWeather } from '@/hooks/useWeather';
import { supabase, clearSupabaseAuthStorage } from '@/lib/supabase';
import AuthModal from '@/components/AuthModal';
import UserMenu from '@/components/UserMenu';
import GarageModal from '@/components/GarageModal';
import SocialModal from '@/components/SocialModal';
import { Session } from '@supabase/supabase-js';
import { useProfile } from '@/hooks/useProfile';
import { useSocial } from '@/hooks/useSocial';
import RouteDashboard from '@/components/RouteDashboard';
import NavigationPanel from '@/components/NavigationPanel';
import AboutModal from '@/components/AboutModal';
import { useLuxuryYachts, YachtPosition } from '@/hooks/useLuxuryYachts';
import { useCommunityRadars } from '@/hooks/useCommunityRadars';
import { useFestivals } from '@/hooks/useFestivals';
import { useRestaurants, RestaurantFilters } from '@/hooks/useRestaurants';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

const DynamicMap = dynamic(() => import('@/components/MapUI'), {
  ssr: false,
  loading: () => (
    <div className="flex bg-gray-900 text-gray-400 h-full w-full items-center justify-center">
      Cargando Navegador...
    </div>
  ),
});

export default function Home() {
  const sessionClientId = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const id = localStorage.getItem('tesla_session_id') || crypto.randomUUID();
    localStorage.setItem('tesla_session_id', id);
    return id;
  }, []);

  const [viewMode, setViewMode] = useState<'navigation' | 'overview'>('overview');
  const [sessionConflict, setSessionConflict] = useState<'none' | 'warning' | 'kicked'>('none');
  const [isSessionMaster, setIsSessionMaster] = useState(false);
  const [expandedFriendId, setExpandedFriendId] = useState<string | null>(null);
  const [isNavMinimized, setIsNavMinimized] = useState(false);
  const [isDraggingFriends, setIsDraggingFriends] = useState(false);


  const [isSimulatingState, setIsSimulatingState] = useState(false);
  const [showDebugToggle, setShowDebugToggle] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.has('xavi')) {
        setShowDebugToggle(true);
      }
    }
  }, []);

  const { 
    userPos, 
    setUserPos, 
    heading,
    setHeading,
    hasLocation,
    gpsError,
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
    lastTrafficTime,
    lastTrafficPos,
    liveDistance,
    liveDuration,
    nextInstruction,
    activeLaneGuidance,
    distanceToNextInstruction,
    originalTotalDistance,
    originalTotalDuration,
    updateLiveMetrics
  } = useRoute();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRadarsEnabled, setIsRadarsEnabled] = useState(false);
  const [isAircraftsEnabled, setIsAircraftsEnabled] = useState(false);
  const [isChargersEnabled, setIsChargersEnabled] = useState(false);
  const [isWeatherEnabled, setIsWeatherEnabled] = useState(false);
  const [isFestivalsEnabled, setIsFestivalsEnabled] = useState(false);
  const [isRestaurantsEnabled, setIsRestaurantsEnabled] = useState(false);
  const [mapMode, setMapMode] = useState<'satellite' | 'light'>('satellite');
  
  const [chargerFilters, setChargerFilters] = useState<ChargerFilters>({
    isFree: false, connectors: [], minPower: 0
  });

  const [isGasStationsEnabled, setIsGasStationsEnabled] = useState(false);
  const [gasStationFilters, setGasStationFilters] = useState<GasStationFilters>({
    fuels: [], maxPrice: null
  });

  const [restaurantFilters, setRestaurantFilters] = useState<RestaurantFilters>(() => {
    const currentHour = new Date().getHours();
    return {
      smartOptimization: true, 
      maxDeviation: 5,
      targetTime: currentHour < 15 ? '14:00' : '21:00'
    };
  });

  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [isTrafficWanted, setIsTrafficWanted] = useState(true);
  const [voiceType, setVoiceType] = useState<VoiceType>('mujer');
  const [audioMode, setAudioMode] = useState<'voice' | 'beep'>('voice');
  const [lastRecalculationTime, setLastRecalculationTime] = useState(0);
  const lastTrafficRequestTimeRef = useRef(0);
  const [customZoom, setCustomZoom] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ lat: number; lon: number; screenX: number; screenY: number } | null>(null);
  const [selectedPOI, setSelectedPOI] = useState<
    | { type: 'charger'; data: Charger }
    | { type: 'gasStation'; data: GasStation }
    | null
  >(null);
  const [selectedYacht, setSelectedYacht] = useState<YachtPosition | null>(null);

  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isGarageOpen, setIsGarageOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isYachtsEnabled, setIsYachtsEnabled] = useState(false);
  const [isSocialOpen, setIsSocialOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  // authLoading: true while we don't yet know if there is a valid session.
  // The UI must NOT render as "logged in" while this is true.
  const [authLoading, setAuthLoading] = useState(true);

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
  const { 
    friends, 
    loading, 
    addFriend, 
    acceptFriend,
    removeFriend,
    updateFriendNickname,
    refreshFriends: fetchFriends
  } = useSocial(
    session, 
    userPos as [number, number], 
    heading,
    speed,
    // CRÍTICO: Solo compartimos si está activo en el perfil Y hemos tomado el control de la sesión (sin conflictos)
    (profile?.is_sharing_location ?? false) && sessionConflict === 'none' && isSessionMaster, 
    hasLocation
  );

  const { yachts: realYachts, loadingYachts } = useLuxuryYachts(isYachtsEnabled);
  const yachts = realYachts;
  
  const wasStoppedRef = useRef(true);
  const isManualOverviewRef = useRef(false);
  const [currentZoom, setCurrentZoom] = useState(15);
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

  // Auth state management:
  // We rely on onAuthStateChange rather than calling getSession() separately.
  // The SDK fires INITIAL_SESSION synchronously (from localStorage) + validates it
  // against the server. This is the single source of truth.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {

      if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !newSession)) {
        setSession(null);
        logger.clearUser();
        clearSupabaseAuthStorage();
        setAuthLoading(false);
        return;
      }

      if (event === 'TOKEN_REFRESHED' && !newSession) {
        // Token refresh failed → session is corrupted, clean up
        console.warn('[Auth] Token refresh fallido. Limpiando sesión corrupta.');
        clearSupabaseAuthStorage();
        logger.clearUser();
        await supabase.auth.signOut();
        setSession(null);
        setAuthLoading(false);
        return;
      }

      setSession(newSession);
      if (newSession?.user) {
        logger.setUser(newSession.user.id, newSession.user.email);
      } else {
        logger.clearUser();
      }
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    // Close all panels before signing out
    setIsUserMenuOpen(false);
    setIsGarageOpen(false);
    setIsSocialOpen(false);
    setIsSettingsOpen(false);

    // Clear session_id from the DB so other devices don't detect a conflict
    if (session?.user?.id) {
      await updateProfile({ last_session_id: null });
    }

    // Sign out from Supabase (clears token + fires SIGNED_OUT event)
    await supabase.auth.signOut();

    // Belt-and-suspenders: wipe auth storage in case something residual remains
    clearSupabaseAuthStorage();

    // Reset local auth state immediately (onAuthStateChange will also fire)
    setSession(null);
    setAuthLoading(false);
  };

  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // 1. Cargar preferencias guardadas en el perfil al iniciar sesión
  useEffect(() => {
    if (profile && !prefsLoaded) {
      const p = profile.preferences || {};
      
      // Usar un microtask para evitar renderizado en cascada síncrono
      Promise.resolve().then(() => {
        if (p.isRadarsEnabled !== undefined) setIsRadarsEnabled(p.isRadarsEnabled);
        if (p.isAircraftsEnabled !== undefined) setIsAircraftsEnabled(p.isAircraftsEnabled);
        if (p.isChargersEnabled !== undefined) setIsChargersEnabled(p.isChargersEnabled);
        if (p.chargerFilters !== undefined) setChargerFilters(p.chargerFilters);
        if (p.isGasStationsEnabled !== undefined) setIsGasStationsEnabled(p.isGasStationsEnabled);
        if (p.gasStationFilters !== undefined) setGasStationFilters(p.gasStationFilters);
        if (p.isWeatherEnabled !== undefined) setIsWeatherEnabled(p.isWeatherEnabled);
        if (p.isFestivalsEnabled !== undefined) setIsFestivalsEnabled(p.isFestivalsEnabled);
        if (p.isSoundEnabled !== undefined) setIsSoundEnabled(p.isSoundEnabled);
        if (p.voiceType !== undefined) setVoiceType(p.voiceType);
        setPrefsLoaded(true);
      });
    }
  }, [profile, prefsLoaded]);

  // Resetear flag si el usuario cierra sesión
  useEffect(() => {
    if (!session) {
      Promise.resolve().then(() => setPrefsLoaded(false));
    }
  }, [userPos, session]);

  // 2. Guardar preferencias explícitamente cuando el usuario pulse el botón Guardar
  const handleSavePreferences = useCallback(async () => {
    if (!session || !profile) return;
    
    const newPrefs = {
      isRadarsEnabled,
      isAircraftsEnabled,
      isChargersEnabled,
      chargerFilters,
      isGasStationsEnabled,
      gasStationFilters,
      isWeatherEnabled,
      isFestivalsEnabled,
      isSoundEnabled,
      voiceType
    };

    // Solo guardamos si realmente hay cambios respecto al perfil cargado
    if (JSON.stringify(profile.preferences) === JSON.stringify(newPrefs)) {
      return;
    }

    const res = await updateProfile({
      preferences: newPrefs
    });
    
    if (res.success) {
      // Éxito
    }
  }, [
    session, profile, updateProfile, isRadarsEnabled, isAircraftsEnabled, isChargersEnabled, 
    chargerFilters, isGasStationsEnabled, gasStationFilters, isWeatherEnabled, isFestivalsEnabled,
    isSoundEnabled, voiceType
  ]);

  // 2.1 Auto-save con debounce (2 segundos)
  useEffect(() => {
    // CRÍTICO: No auto-guardar NADA si hay un conflicto de sesión pendiente o resuelto (kickout)
    if (!session || !prefsLoaded || sessionConflict !== 'none') return;

    const timer = setTimeout(() => {
      handleSavePreferences();
    }, 2000);

    return () => clearTimeout(timer);
  }, [
    isRadarsEnabled, isAircraftsEnabled, isChargersEnabled, 
    chargerFilters, isGasStationsEnabled, gasStationFilters, 
    isWeatherEnabled, isFestivalsEnabled, isSoundEnabled, voiceType,
    session, prefsLoaded, handleSavePreferences, sessionConflict
  ]);


  // 3. Gestión de Sesión Única Controlada (Realtime)
  useEffect(() => {
    if (!session?.user) {
      Promise.resolve().then(() => {
        setSessionConflict('none');
        setIsSessionMaster(false);
      });
      return;
    }

    // Al entrar, verificamos si ya existe una sesión activa para advertir al usuario
    const checkActiveSession = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('last_session_id')
        .eq('id', session.user.id)
        .single();
      
      // Si el ID en la DB es diferente al nuestro, hay conflicto
      if (!error && data?.last_session_id && data.last_session_id !== sessionClientId) {
        console.log('[Auth] Conflicto de sesión detectado: ya hay un dispositivo activo');
        setSessionConflict('warning');
        isSessionMasterRef.current = false;
      } else {
        // No hay sesión activa o es la nuestra, tomamos control oficialmente
        updateProfile({ last_session_id: sessionClientId });
        setIsSessionMaster(true);
        setSessionConflict('none');
      }
    };

    // Solo verificamos si aún no estamos en un estado de conflicto explícito
    if (sessionConflict === 'none') {
      checkActiveSession();
    }

    // Escuchar si el last_session_id cambia en la DB (otro dispositivo entró y tomó el mando)
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
          
          // Si el ID cambia y no es el nuestro, hemos sido expulsados
          // PERO solo nos expulsamos si nosotros éramos el "master" (isSessionMaster)
          if (isSessionMaster && newSessionId && newSessionId !== sessionClientId) {
            console.warn('[Auth] Sesión robada por otro terminal:', newSessionId);
            setSessionConflict('kicked');
            setIsSessionMaster(false);
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
    if (!userPos || !route || !destination || loadingRoute) return;

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
      Promise.resolve().then(() => {
        setLastRecalculationTime(now);
        calculateRoute(userPos, destination, waypoints, true, isTrafficWanted);
      });
    }
  }, [userPos, speed, route, destination, waypoints, loadingRoute, lastRecalculationTime, calculateRoute, isTrafficWanted]);

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

  // Recalcular ruta al cambiar la preferencia de tráfico si hay una ruta activa
  useEffect(() => {
    if (route && destination && userPos) {
      // Protección anti-spam estricta: solo llamamos a la API si han pasado más de 30min Y se ha movido > 1km
      const now = Date.now();
      const timeSinceLastRequest = now - lastTrafficTime;
      
      // FIX I8: Eliminada copia local de getDistance — se usa la importada de utils/geo
      const distSinceLastRequest = lastTrafficPos ? getDistance(userPos, lastTrafficPos) : Infinity;

      const isTimeOk = timeSinceLastRequest > 1800000; // 30 min
      const isDistOk = distSinceLastRequest > 1000; // 1 km
      
      if (isTrafficWanted && !(isTimeOk && isDistOk)) {
        console.log(`[Ahorro Crítico] Tráfico bloqueado. Han pasado ${Math.round(timeSinceLastRequest/60000)}min y movido ${Math.round(distSinceLastRequest)}m. (Faltan: ${isTimeOk ? '0' : 30 - Math.round(timeSinceLastRequest/60000)}min o ${isDistOk ? '0' : 1000 - Math.round(distSinceLastRequest)}m)`);
        return;
      }

      console.log(`[page] Preferencia de tráfico cambiada a ${isTrafficWanted ? 'ON' : 'OFF'}. Recalculando ruta...`);
      calculateRoute(userPos, destination, waypoints, true, isTrafficWanted);
    }
  }, [isTrafficWanted, route, destination, userPos, lastTrafficTime, lastTrafficPos, waypoints, calculateRoute]);


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
      Promise.resolve().then(() => setIsSidebarOpen(true));
    }
  }, []);

  const { reportRadar, voteRadar, cooldownRemaining, isReporting, hiddenIds } = useCommunityRadars();

  const { radars: allRadars, radarZones: allRadarZones, loadingRadars, fetchingRouteRadars, lastUpdate, progress, refreshRadars } = useRadars(userPos, route?.coordinates, isRadarsEnabled, session?.user?.id);

  // Filtrar radares:
  // - Sin ruta: solo los próximos (ya se buscan en radio de 10km por useRadars)
  // - Con ruta: solo los que están en la ruta PENDIENTE por delante del usuario
  const radars = useMemo(() => {
    if (!isRadarsEnabled || !userPos) return [];
    
    // Si NO hay ruta: Filtramos la burbuja de 60km para renderizar solo los de <20km (Rendimiento UI)
    if (!route || !route.coordinates || route.coordinates.length === 0 || allRadars.length === 0) {
      return allRadars
        .filter(r => !hiddenIds.includes(String(r.id))) // Filtrar los ocultos por el usuario
        .filter(r => getDistance(userPos, [r.lat, r.lon]) < 20000);
    }

    // Encontrar el segmento de ruta más cercano al usuario
    const snapped = findClosestPointOnPolyline(userPos, route.coordinates);
    const currentSegmentIndex = snapped.segmentIndex;
    // Solo la porción de ruta que queda por delante
    const remainingRoute = route.coordinates.slice(currentSegmentIndex);

    return allRadars
      .filter(r => !hiddenIds.includes(String(r.id))) // Filtrar los ocultos por el usuario
      .filter(radar => {
        const radarPos: [number, number] = [radar.lat, radar.lon];
        // El radar debe estar a <500m del trazado restante
        const distToPath = distanceToPolyline(radarPos, remainingRoute);
        return distToPath < 500;
      });
  }, [allRadars, route, userPos, isRadarsEnabled, hiddenIds]);

  const { nearestRadar, distance, isAlertActive, alertType, remainingRadars, inSectionRadar, sectionAverageSpeed } = useAlerts(userPos || [0,0], radars, isSoundEnabled, voiceType, speed, heading || 0, allRadarZones || [], audioMode);
  const { allAircrafts, aircrafts, visibleAircrafts, totalCount: aircraftCount, isAnyPegasusNearby, isRateLimited, loading: loadingAircrafts, activeAccount, nextInterval } = usePegasus(userPos, isAircraftsEnabled, route?.coordinates, isDebugMode);
 
  // Proyección futura para movimiento fluido vía V11 (Tick 1s) movida a MapUI.tsx (AircraftLayer)

  const { chargers, loading: loadingChargers, progress: chargerProgress } = useChargers(userPos, route?.coordinates, isChargersEnabled, chargerFilters);
  const { stations: gasStations, loading: loadingGasStations, progress: gasProgress } = useGasStations(userPos, route?.coordinates, isGasStationsEnabled, gasStationFilters);
  const { weatherPoints, loadingWeather, currentWeather } = useWeather(userPos, route?.coordinates, isWeatherEnabled);
  const { festivals, loading: loadingFestivals } = useFestivals(isFestivalsEnabled);
  const { restaurants, loading: loadingRestaurants, progress: restaurantProgress, checkCanReview } = useRestaurants(
    isRestaurantsEnabled,
    restaurantFilters,
    userPos,
    route,
    liveDistance,
    liveDuration
  );

  // Directiva Core #4: indicador de conectividad — datos pueden ser caché cuando isOnline = false
  const isOnline = useOnlineStatus();

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
          Promise.resolve().then(() => {
            setViewMode('overview');
            setCustomZoom(null);
          });
        }, 60000);
      }
    } else if (speedKmh > 7) {
      // Solo volvemos a navegación si veníamos de estar parados (para no obligar a volver si el usuario cambió a overview manualmente conduciendo)
      // Y además, si el usuario explícitamente puso el modo manual general, NO le obligamos a volver.
      if (wasStoppedRef.current && viewMode === 'overview' && !isManualOverviewRef.current) {
        Promise.resolve().then(() => {
          setViewMode('navigation');
          setCustomZoom(null);
          wasStoppedRef.current = false;
        });
      } else {
        wasStoppedRef.current = false;
      }
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [speed, viewMode]);

  const handleLocateYacht = useCallback((lat: number, lng: number) => {
    setMapCenterOverride([lat, lng]);
    setViewMode('overview');
    isManualOverviewRef.current = true;
    // Si el sidebar está abierto en móvil, lo cerramos para ver el mapa
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, [setMapCenterOverride, setIsSidebarOpen]);

  const handleSearchSubmit = async (query: string, coords?: [number, number]) => {
    const origin: [number, number] = userPos || [0, 0];
    if (origin[0] === 0) return; // No navegar si no hay posición real
    if (coords) {
      await calculateRoute(origin, coords, [], false, isTrafficWanted);
    } else {
      await findAndTraceRoute(origin, query, isTrafficWanted);
    }
  };

  const handleMapClick = useCallback((lat: number, lon: number, screenX: number, screenY: number) => {
    setContextMenu({ lat, lon, screenX, screenY });
  }, []);

  const handleChargerClick = useCallback((charger: Charger) => {
    setSelectedPOI({ type: 'charger', data: charger });
    setSelectedYacht(null);
    setContextMenu(null);
  }, []);

  const handleGasStationClick = useCallback((station: GasStation) => {
    setSelectedPOI({ type: 'gasStation', data: station });
    setSelectedYacht(null);
    setContextMenu(null);
  }, []);

  const handleNavigateToPoint = useCallback(() => {
    if (!contextMenu) return;
    const origin: [number, number] = userPos || [0, 0];
    if (origin[0] === 0) return;
    calculateRoute(origin, [contextMenu.lat, contextMenu.lon], [], false, isTrafficWanted);
  }, [contextMenu, userPos, calculateRoute, isTrafficWanted]);

  const handleSaveFavorite = useCallback((name: string) => {
    if (!contextMenu) return;
    saveFavorite(contextMenu.lat, contextMenu.lon, name);
  }, [contextMenu, saveFavorite]);

  const handleAddStopBefore = useCallback(() => {
    if (!contextMenu) return;
    const origin: [number, number] = userPos || [0, 0];
    if (origin[0] === 0) return;
    addWaypointBefore(origin, [contextMenu.lat, contextMenu.lon]);
  }, [contextMenu, userPos, addWaypointBefore]);

  const handleAddStopAfter = useCallback(() => {
    if (!contextMenu) return;
    const origin: [number, number] = userPos || [0, 0];
    if (origin[0] === 0) return;
    addWaypointAfter(origin, [contextMenu.lat, contextMenu.lon]);
  }, [contextMenu, userPos, addWaypointAfter]);

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-black font-sans selection:bg-blue-500/30">
      {/* SEO: H1 oculto para motores de búsqueda */}
      <h1 className="sr-only">Viajando en Tesla v3.0 - Navegador Inteligente y Detector de Radares Pegasus</h1>
      
      
      {/* Alerta de Radar */}
      {(isAlertActive || inSectionRadar) && (nearestRadar || inSectionRadar) && (
        <AlertOverlay 
          radar={nearestRadar || ({ id: 0, lat: 0, lon: 0, type: 'section', speedLimit: 120 } as Radar)} 
          distance={distance || 0} 
          alertType={alertType}
          currentSpeed={speed}
          inSectionRadar={inSectionRadar}
          sectionAverageSpeed={sectionAverageSpeed}
        />
      )}

      {/* Botón Flotante Modo Debug (Solo visible con ?xavi) */}
      {showDebugToggle && (
        <div className="fixed top-6 right-6 z-[600]">
          <button
            onClick={() => setIsDebugMode(!isDebugMode)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
              isDebugMode 
                ? 'bg-amber-500/90 text-black border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.5)]' 
                : 'bg-black/60 text-amber-500 border-amber-500/30 hover:border-amber-500/60 backdrop-blur-md'
            }`}
          >
            {isDebugMode ? '☠️ MODO DESARROLLADOR: ON' : '🛡️ MODO DESARROLLADOR: OFF'}
          </button>
        </div>
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

      {/* Banner de Sin Cobertura — Directiva Core #4 (fallback elegante) */}
      {!isOnline && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[700] flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-gray-900/95 backdrop-blur-xl border border-amber-500/40 shadow-2xl shadow-black/60 animate-in fade-in slide-in-from-top-2 duration-300">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
          </span>
          <span className="text-[11px] font-black text-amber-300 uppercase tracking-widest">Sin cobertura &mdash; datos en caché</span>
        </div>
      )}

      {/* FIX I1: Banner de error GPS (reemplaza alert() bloqueante) */}
      {gpsError && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[600] w-[90%] max-w-md bg-red-700/90 backdrop-blur-md p-3 rounded-2xl border border-white/20 shadow-2xl flex items-center justify-between gap-4">
          <p className="text-xs font-bold text-white">{gpsError}</p>
          <button
            onClick={requestGPS}
            className="bg-white text-black text-[10px] font-black px-3 py-2 rounded-lg hover:scale-105 transition-all whitespace-nowrap"
          >
            REINTENTAR
          </button>
        </div>
      )}

      {/* Botón de Perfil / Iniciar Sesión (Top Right) */}
      <div className="fixed top-6 right-6 z-[600] flex flex-col items-end gap-3">
        {authLoading ? (
          // While auth resolves, show a neutral spinner — never flash a logged-in or logged-out state
          <div className="h-12 w-12 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 shadow-2xl">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
          </div>
        ) : session ? (
          <div className="flex flex-col items-end gap-3">
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

            {/* Recuadro de Lista de Amigos */}
            <motion.div 
              drag 
              dragMomentum={false}
              onPointerDown={() => setIsDraggingFriends(true)}
              onPointerUp={() => setIsDraggingFriends(false)}
              onDragEnd={() => setIsDraggingFriends(false)}
              className={`w-64 max-h-[300px] overflow-y-auto bg-black/60 backdrop-blur-xl border border-white/10 rounded-[32px] p-4 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500 scrollbar-hide cursor-grab active:cursor-grabbing pointer-events-auto ${isDraggingFriends ? 'arrastrando' : ''}`}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">Amigos</span>
                {friends.length > 0 && (
                  <div className="flex gap-1">
                     <div className="h-1 w-1 rounded-full bg-green-500 animate-pulse" />
                     <span className="text-[8px] font-bold text-green-500/80 uppercase">{friends.filter(f => f.is_online).length}</span>
                  </div>
                )}
              </div>
              
              {friends.length > 0 ? (
                <div className="flex flex-col gap-2">
                   {[...friends]
                    .sort((a, b) => {
                      // Orden: Online (Green) > Incoming Pending (Orange) > Outgoing Pending (Orange) > Offline (Red)
                      if (a.is_online && !b.is_online) return -1;
                      if (!a.is_online && b.is_online) return 1;
                      if (a.friendship_status === 'pending' && b.friendship_status === 'accepted') return -1;
                      if (a.friendship_status === 'accepted' && b.friendship_status === 'pending') return 1;
                      return 0;
                    })
                    .map((friend) => {
                      const isPending = friend.friendship_status === 'pending';
                      const isExpanded = expandedFriendId === friend.id;
                      
                      return (
                        <div key={friend.id} className="flex flex-col gap-2">
                          <div 
                            className={`flex items-center justify-between gap-3 bg-white/5 p-2 pr-3 rounded-2xl border transition-all group cursor-pointer ${isExpanded ? 'border-blue-500/50 bg-white/10' : 'border-white/5 hover:bg-white/10'}`}
                            onClick={() => setExpandedFriendId(isExpanded ? null : friend.id)}
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <div className="h-8 w-8 rounded-xl bg-gray-800 flex-shrink-0 flex items-center justify-center overflow-hidden border border-white/5">
                                <img src="/avatar.png" alt={friend.car_name} className={`h-full w-full object-cover ${friend.is_online ? 'opacity-100' : isPending ? 'opacity-80' : 'opacity-40 grayscale'}`} />
                              </div>
                              <div className="flex flex-col overflow-hidden">
                                <span className={`text-[11px] font-black italic leading-none uppercase truncate ${friend.is_online ? 'text-green-500' : isPending ? 'text-orange-500' : 'text-red-500'}`}>
                                  {friend.nickname ? `${friend.nickname} (${friend.car_name})` : friend.car_name}
                                </span>
                                <span className="text-[8px] font-bold text-gray-500 uppercase tracking-tighter leading-tight truncate">
                                  {isPending ? (friend.is_incoming ? 'Solicitud Recibida' : 'Esperando respuesta...') : friend.email}
                                </span>
                              </div>
                            </div>
                            <ChevronRight className={`h-3 w-3 text-gray-600 transition-transform duration-300 ${isExpanded ? 'rotate-90 text-blue-500' : 'group-hover:text-white'}`} />
                          </div>

                          {/* Acciones Expandidas */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden px-1"
                              >
                                <div className="flex gap-2 pb-2">
                                  {!isPending ? (
                                    <>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (confirm(`¿Eliminar a ${friend.car_name} de tus amigos?`)) {
                                            removeFriend(friend.id);
                                            setExpandedFriendId(null);
                                          }
                                        }}
                                        className="w-full flex items-center justify-center py-2 rounded-xl bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 text-red-500 transition-all"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </>
                                  ) : friend.is_incoming ? (
                                    <>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          acceptFriend(friend.id);
                                          setExpandedFriendId(null);
                                        }}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-[9px] font-black text-green-400 uppercase transition-all"
                                      >
                                        <UserCheck className="h-3 w-3" /> Aceptar
                                      </button>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          removeFriend(friend.id);
                                          setExpandedFriendId(null);
                                        }}
                                        className="w-10 flex items-center justify-center py-2 rounded-xl bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 text-red-500 transition-all"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </>
                                  ) : (
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeFriend(friend.id);
                                        setExpandedFriendId(null);
                                      }}
                                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gray-600/20 hover:bg-gray-600/30 border border-gray-500/30 text-[9px] font-black text-gray-400 uppercase transition-all"
                                    >
                                      <Trash2 className="h-3 w-3" /> Cancelar Solicitud
                                    </button>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                    <Users className="h-5 w-5 text-gray-600" />
                  </div>
                  <p className="text-[10px] font-medium text-gray-500 leading-tight">No tienes amigos vinculados todavía</p>
                  <button 
                    onClick={() => setIsSocialOpen(true)}
                    className="w-full py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-xl text-[10px] font-black text-blue-400 uppercase transition-all"
                  >
                    Vincular Amigos
                  </button>
                </div>
              )}
            </motion.div>

            {/* Botón de Reportar Alerta (Alineado debajo de Amigos) */}
            <DevGuard moduleId="[MAP-05]">
            <div className="mt-2">
              <IncidentReporter 
                onReport={async (lat, lon, category) => {
                  await reportRadar(lat, lon, session?.user?.id || '', category);
                  refreshRadars(); // Refrescar mapa inmediatamente tras el reporte
                }}
                userPos={userPos as [number, number]}
                isReporting={isReporting}
                cooldownRemaining={cooldownRemaining}
                userId={session?.user?.id}
              />
            </div>
            </DevGuard>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 animate-in fade-in slide-in-from-top-4 duration-700">
            <button 
              onClick={() => setIsAuthModalOpen(true)}
              className="h-12 w-12 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 shadow-2xl hover:bg-white/10 transition-all overflow-hidden group"
            >
              <img src="/avatar.png" alt="Avatar" className="h-full w-full object-cover group-hover:scale-110 transition-transform" />
            </button>
            <span className="text-[9px] font-black text-white uppercase tracking-widest text-center shadow-black drop-shadow-lg">Inicio</span>
          </div>
        )}
      </div>

      <UserMenu 
        isOpen={isUserMenuOpen}
        onClose={() => setIsUserMenuOpen(false)}
        onOpenGarage={() => setIsGarageOpen(true)}
        onOpenSocial={() => setIsSocialOpen(true)}
        isFullscreen={!isSidebarOpen}
        onToggleFullscreen={() => setIsSidebarOpen(!isSidebarOpen)}
        mapMode={mapMode}
        onToggleMapMode={() => setMapMode(prev => prev === 'satellite' ? 'light' : 'satellite')}
        onOpenAbout={() => setIsAboutOpen(true)}
        onLogout={handleSignOut}
      />

      <AboutModal 
        isOpen={isAboutOpen} 
        onClose={() => setIsAboutOpen(false)} 
      />

      {/* Panel Izquierdo (Bloque de Control) */}
      {/* Branding NavegaPRO (Siempre Visible) */}
      <AnimatePresence>
        <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="fixed top-8 left-8 z-[100] flex items-center gap-5 pointer-events-auto cursor-pointer select-none"
          >
            <img 
              src="/favicon-logo.png" 
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
      </AnimatePresence>

      <NavigationPanel 
        isVisible={!isSidebarOpen && (!!(route || nextInstruction) || isSimulating)}
        instruction={nextInstruction || (route ? { message: 'Iniciando ruta...', maneuver: 'STRAIGHT' } : null)}
        distance={distanceToNextInstruction}
        activeLaneGuidance={activeLaneGuidance}
        isSimulating={isSimulating}
        isMinimized={isNavMinimized}
        onMinimize={() => setIsNavMinimized(true)}
        isSidebarOpen={isSidebarOpen}
      />

      {/* Panel Flotante de Búsqueda (Siempre Visible) */}
      <AnimatePresence>
        {(!route || isSidebarOpen) && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed top-[120px] left-6 right-6 md:left-8 md:w-[332px] md:right-auto z-[90] pointer-events-auto"
          >
            <DevGuard moduleId="[MAP-04]">
            <SearchPanel 
              onSearch={handleSearchSubmit} 
              isLoading={loadingRoute} 
              onOpenFavorites={() => setIsFavoritesOpen(true)} 
              yachts={yachts}
            />
            </DevGuard>
          </motion.div>
        )}
      </AnimatePresence>


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
          onAddFriend={addFriend as (email: string) => Promise<{ success?: boolean; accepted?: boolean; invited?: boolean; error?: unknown }>}
          isSoundEnabled={isSoundEnabled}
          setIsSoundEnabled={setIsSoundEnabled}
          audioMode={audioMode}
          setAudioMode={setAudioMode}
          voiceType={voiceType}
          setVoiceType={setVoiceType}
          onOpenFavorites={() => setIsFavoritesOpen(true)}
          radarProgress={progress}
          isTrafficEnabled={isTrafficEnabled}
          isTrafficWanted={isTrafficWanted}
          setIsTrafficWanted={setIsTrafficWanted}
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
          isYachtsEnabled={isYachtsEnabled}
          setIsYachtsEnabled={setIsYachtsEnabled}
          yachts={yachts}
          onLocateYacht={handleLocateYacht}
          isFestivalsEnabled={isFestivalsEnabled}
          setIsFestivalsEnabled={setIsFestivalsEnabled}
          festivalsCount={festivals.length}
          loadingFestivals={loadingFestivals}
          isRestaurantsEnabled={isRestaurantsEnabled}
          setIsRestaurantsEnabled={setIsRestaurantsEnabled}
          restaurantFilters={restaurantFilters}
          setRestaurantFilters={setRestaurantFilters}
          restaurantsCount={restaurants.length}
          loadingRestaurants={loadingRestaurants}
          restaurantProgress={restaurantProgress}
        />

      {/* Sección del Mapa (Fondo) */}
      <section className="relative flex-1 bg-gray-900 overflow-hidden">
        <DynamicMap 
          userPos={userPos as [number, number]}
          heading={heading}
          hasLocation={hasLocation}
          routeCoordinates={route?.coordinates} 
          radars={radars}
          radarZones={isRadarsEnabled ? allRadarZones : []}
          aircrafts={visibleAircrafts}
          chargers={chargers}
          gasStations={gasStations}
          weatherPoints={weatherPoints}
          festivals={festivals}
          restaurants={isRestaurantsEnabled ? restaurants : []}
          waypoints={waypoints}
          yachts={isYachtsEnabled ? yachts : []}
          speed={speed}
          viewMode={viewMode}
          onViewModeChange={(mode) => handleManualViewModeChange(mode as 'navigation' | 'overview')}
          customZoom={customZoom}
          onZoomChange={setCustomZoom}
          onMapClick={handleMapClick}
          onChargerClick={handleChargerClick}
          onGasStationClick={handleGasStationClick}
          onYachtClick={(y) => {
            setSelectedPOI(null);
            setSelectedYacht(y);
          }}
          onOpenGarage={() => setIsGarageOpen(true)}
          routeSections={route?.sections}
          carColor={profile?.car_color}
          friends={friends}
          centerOverride={mapCenterOverride}
          overviewFitTrigger={overviewFitTrigger}
          distanceToNextInstruction={distanceToNextInstruction}
          isSimulating={isSimulating}
          onCurrentZoomChange={setCurrentZoom}
          mapMode={mapMode}
          onMapError={() => {
             if (mapMode === 'satellite') {
               console.warn('[Auto-Fallback] Fallo en satélite detectado. Cambiando a Modo Ligero...');
               setMapMode('light');
             }
          }}
          onUpdateFriendNickname={(friendId, name) => {
            updateFriendNickname(friendId, name);
          }}
          userId={session?.user?.id}
          voteRadar={voteRadar}
          calculateRoute={calculateRoute}
          isTrafficWanted={isTrafficWanted}
          checkCanReview={checkCanReview}
        />


        {/* Nuevo Dashboard de Ruta Compacto (Solo en Pantalla Completa + Ruta Activa) */}
        <AnimatePresence>
          {!isSidebarOpen && route && (
            <RouteDashboard 
              totalDistance={originalTotalDistance || route.distance}
              totalDuration={originalTotalDuration || route.duration}
              remainingDistance={liveDistance ?? route.distance}
              remainingDuration={liveDuration ?? route.duration}
              remainingRadarsCount={remainingRadars}
              onEndRoute={clearRoute}
              isSimulating={isSimulating}
              onStartSimulation={() => { setViewMode('navigation'); startSimulation(); }}
              onStopSimulation={stopSimulation}
              isNavMinimized={isNavMinimized}
              onUnminimizeNav={() => setIsNavMinimized(false)}
              instruction={nextInstruction || (route ? { message: 'Iniciando ruta...', maneuver: 'STRAIGHT' } : null)}
              distanceToNextInstruction={distanceToNextInstruction}
              onOpenMenu={() => setIsSidebarOpen(true)}
            />
          )}
        </AnimatePresence>

        {/* Panel de Avisos Rápidos y Velocímetro */}
        <div className="absolute bottom-6 right-6 z-[500] flex flex-col items-end gap-3 md:flex-row md:items-center md:gap-4 md:bottom-8 md:right-8">
          <Speedometer speed={speed} />
          
          <div className="flex flex-col gap-5">
            {viewMode === 'navigation' && (
             <DevGuard moduleId="[MAP-02]">
              <div className="flex flex-col items-center gap-1.5">
                <button 
                  onClick={() => handleManualViewModeChange('overview')}
                  className="flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-2xl shadow-2xl transition-all hover:scale-105 active:scale-95 group relative border border-white/20 bg-gray-800 hover:bg-gray-700"
                >
                  <img src="/mapa.png" alt="Vista General" className="h-6 w-6 md:h-8 md:w-8 object-contain drop-shadow-md" />
                </button>
                <span className="text-[9px] font-black text-white uppercase tracking-widest text-center shadow-black drop-shadow-lg">Vista General</span>
              </div>
             </DevGuard>
            )}
            {viewMode === 'overview' && (
              <>
                 <DevGuard moduleId="[MAP-02]">
                <div className="flex flex-col items-center gap-1.5">
                  <button 
                    onClick={() => setOverviewFitTrigger(prev => prev + 1)}
                    className="flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-2xl shadow-2xl transition-all hover:scale-105 active:scale-95 group relative border border-white/20 bg-gray-800 hover:bg-gray-700"
                  >
                    <img src="/mapa.png" alt="Centrar Mapa Global" className="h-6 w-6 md:h-8 md:w-8 object-contain drop-shadow-md" />
                  </button>
                  <span className="text-[9px] font-black text-white uppercase tracking-widest text-center shadow-black drop-shadow-lg">Vista General</span>
                </div>
                 </DevGuard>
                <DevGuard moduleId="[MAP-02]">
                <div className="flex flex-col items-center gap-1.5">
                  <button 
                    onClick={() => {
                      if (!hasLocation) requestGPS();
                      handleManualViewModeChange('navigation');
                    }}
                    className="flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-2xl shadow-2xl transition-all hover:scale-105 active:scale-95 group relative border border-white/20 bg-blue-600/80 hover:bg-blue-500 border-blue-400/50"
                  >
                    <img src="/volante.png" alt="Modo Navegación" className="h-6 w-6 md:h-8 md:w-8 object-contain drop-shadow-md" />
                  </button>
                  <span className="text-[9px] font-black text-white uppercase tracking-widest text-center shadow-black drop-shadow-lg">Modo Navegación</span>
                </div>
                </DevGuard>
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
          calculateRoute(origin, [lat, lon], [], false, isTrafficWanted);
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

      {selectedYacht && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-8 pointer-events-none animate-in fade-in zoom-in-95 duration-300">
          <div className="w-full max-w-md bg-black/90 backdrop-blur-3xl border border-blue-500/30 rounded-[32px] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.9)] pointer-events-auto">
            {/* Cabecera del Yate */}
            <div className="p-5 flex items-center gap-4 bg-gradient-to-br from-blue-500/10 to-transparent border-b border-white/5">
              <div className="h-12 w-12 flex items-center justify-center bg-blue-500/10 rounded-2xl border border-blue-500/20 shadow-inner">
                <img src="/yacht-icon.png" alt="Y" className="h-10 w-10 object-contain" />
              </div>
              <div className="flex flex-col flex-1 overflow-hidden">
                <span className="text-[10px] font-black text-blue-500/80 uppercase tracking-[0.2em] leading-none mb-1.5">RADAR DE LUJO</span>
                <h2 className="text-xl font-black text-white italic truncate uppercase tracking-tighter leading-tight drop-shadow-md">
                  {selectedYacht.name}
                </h2>
              </div>
            </div>

            {/* Detalles */}
            <div className="p-6 flex flex-col gap-5">
              <div className="flex flex-col bg-white/5 border border-white/10 rounded-[24px] p-4 shadow-inner">
                <span className="text-[10px] font-black text-blue-400 uppercase leading-none opacity-60 mb-1.5 px-1 tracking-widest">PROPIETARIO</span>
                <span className="text-lg font-black text-white uppercase tracking-tight italic px-1 drop-shadow-sm">
                  {selectedYacht.owner}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col bg-white/5 border border-white/10 rounded-2xl p-4 transition-all hover:bg-white/10">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none mb-2">Velocidad</span>
                  <p className="text-base font-black text-white">{selectedYacht.speed} <span className="text-[10px] opacity-40 font-bold ml-0.5">NUDOS</span></p>
                </div>
                <div className="flex flex-col bg-white/5 border border-white/10 rounded-2xl p-4 transition-all hover:bg-white/10">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none mb-2">Rumbo</span>
                  <p className="text-base font-black text-white">{selectedYacht.course || selectedYacht.heading || 0}º</p>
                </div>
              </div>

              {selectedYacht.destination && (
                <div className="flex flex-col bg-blue-900/20 border border-blue-500/20 rounded-2xl p-4">
                  <span className="text-[10px] font-black text-blue-400/70 uppercase tracking-widest leading-none mb-2">Destino Reportado</span>
                  <p className="text-sm font-black text-white italic uppercase tracking-tighter">
                    {(() => {
                      if (!selectedYacht.destination) return 'Alta Mar';
                      try {
                        const parsed = JSON.parse(selectedYacht.destination);
                        return parsed.name || selectedYacht.destination;
                      } catch (e) {
                        return selectedYacht.destination;
                      }
                    })()}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2.5">
                  <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">AIS SEÑAL ACTIVA</span>
                </div>
                <span className="text-[10px] font-bold text-gray-500">
                  {(() => {
                    try {
                      return new Date(selectedYacht.last_update).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                    } catch (e) {
                      return '--:--';
                    }
                  })()}
                </span>
              </div>

              <button
                onClick={() => setSelectedYacht(null)}
                className="w-full py-4 rounded-2xl font-black text-sm text-gray-400 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-all transform hover:scale-[1.02] active:scale-[0.98] mt-2"
              >
                Cerrar Radar
              </button>
            </div>
          </div>
        </div>
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
        sessionName={session?.user?.user_metadata?.full_name || session?.user?.email || ''}
        isLoggedIn={!!session}
        onOpenAuth={() => {
          setIsGarageOpen(false);
          setIsAuthModalOpen(true);
        }}
        onUpdate={updateProfile}
      />

      {/* Modal Social (Viajar con Amigos) */}
      <DevGuard moduleId="[SUP-01]">
      <SocialModal 
        isOpen={isSocialOpen}
        onClose={() => setIsSocialOpen(false)}
        session={session}
        profile={profile}
        updateProfile={updateProfile}
        onAddFriend={addFriend}
      />
      </DevGuard>

      {/* Alertas de Sesión Duplicada / Advertencias */}
      {sessionConflict !== 'none' && (
        <SessionAlert 
          mode={sessionConflict === 'warning' ? 'warning' : 'kickout'}
          onConfirm={() => {
            updateProfile({ last_session_id: sessionClientId });
            setIsSessionMaster(true);
            setSessionConflict('none');
          }}
          onCancel={() => {
            handleSignOut();
            setIsSessionMaster(false);
            setSessionConflict('none');
          }}
          onClose={() => {
            handleSignOut();
            setIsSessionMaster(false);
            setSessionConflict('none');
          }}
        />
      )}
    </main>
  );
}
