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

import { distanceToPolyline, findClosestPointOnPolyline } from '@/utils/geo';
import { playPegasusAlert, unlockTeslaAudio } from '@/utils/sound';
import MapContextMenu from '@/components/MapContextMenu';
import FavoritesPanel from '@/components/FavoritesPanel';
import { useFavorites } from '@/hooks/useFavorites';

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
    loadingRoute, 
    routeError, 
    calculateRoute, 
    findAndTraceRoute, 
    addWaypointBefore,
    addWaypointAfter,
    clearRoute 
  } = useRoute();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRadarsEnabled, setIsRadarsEnabled] = useState(false);
  const [isAircraftsEnabled, setIsAircraftsEnabled] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [alertVolume, setAlertVolume] = useState(0.5);
  const [lastRecalculationTime, setLastRecalculationTime] = useState(0);
  const [customZoom, setCustomZoom] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ lat: number; lon: number; screenX: number; screenY: number } | null>(null);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const { favorites, saveFavorite, removeFavorite, isFavorite } = useFavorites();

  // Lógica de Recalculado Automático
  useEffect(() => {
    if (!route || !destination || loadingRoute) return;

    const now = Date.now();
    // Cooldown de 15 segundos entre recalculados
    if (now - lastRecalculationTime < 15000) return;

    const distOffRoute = distanceToPolyline(userPos, route.coordinates);
    
    // Si estamos a más de 100 metros del camino trazado, recalculamos
    if (distOffRoute > 100) {
      console.log("Desviación detectada (" + Math.round(distOffRoute) + "m). Recalculando ruta...");
      setLastRecalculationTime(now);
      calculateRoute(userPos, destination);
    }
  }, [userPos, route, destination, loadingRoute, lastRecalculationTime, calculateRoute]);

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

  const { radars: allRadars, loadingRadars, fetchingRouteRadars } = useRadars(userPos, route?.coordinates, isRadarsEnabled);

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

  const speed = useSpeed();
  const { nearestRadar, distance, isAlertActive, alertType, remainingRadars } = useAlerts(userPos, radars, isSoundEnabled, alertVolume, speed);
  const { allAircrafts, aircrafts, totalCount: aircraftCount, isAnyPegasusNearby, isRateLimited, loading: loadingAircrafts, activeAccount } = usePegasus(userPos, isAircraftsEnabled, route?.coordinates);

  const notifiedPegasus = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    if (!isSoundEnabled || !aircrafts || aircrafts.length === 0) return;
    
    aircrafts.forEach(ac => {
      if (ac.distanceToUser < 10000 && !notifiedPegasus.current.has(ac.icao24)) {
        notifiedPegasus.current.add(ac.icao24);
        playPegasusAlert(alertVolume, ac.callsign, ac.altitude, ac.velocity * 3.6);
      }
    });
  }, [aircrafts, isSoundEnabled, alertVolume]);

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
        alertVolume={alertVolume}
        setAlertVolume={setAlertVolume}
        onOpenFavorites={() => setIsFavoritesOpen(true)}
      />

      {/* Sección del Mapa (Fondo) */}
      <section className="relative flex-1 bg-gray-900 overflow-hidden">
        <DynamicMap 
          userPos={userPos}
          heading={heading}
          routeCoordinates={route?.coordinates} 
          radars={radars}
          aircrafts={allAircrafts}
          speed={speed}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          customZoom={customZoom}
          onZoomChange={setCustomZoom}
          onMapClick={handleMapClick}
        />

        {/* Panel de Avisos Rápidos y Velocímetro */}
        <div className="absolute bottom-6 right-6 z-[500] flex flex-col items-end gap-3 md:flex-row md:items-center md:gap-4 md:bottom-8 md:right-8">
          <Speedometer speed={speed} />
          
          <div className="flex flex-col gap-3 md:flex-row">
            <button 
              onClick={() => { setViewMode('overview'); setCustomZoom(null); }}
              className={`flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-2xl shadow-2xl transition-all hover:scale-105 active:scale-95 group relative border border-white/20 ${viewMode === 'overview' ? 'bg-indigo-600' : 'bg-gray-800 hover:bg-gray-700'}`}
            >
              <img src="/mapa.png" alt="Vista General" className="h-6 w-6 md:h-8 md:w-8 object-contain drop-shadow-md" />
              <span className="absolute -top-10 right-0 scale-0 group-hover:scale-100 transition-all bg-black/80 px-3 py-1 rounded text-[10px] font-bold whitespace-nowrap">Vista General</span>
            </button>
            <button 
              onClick={() => {
                if (!hasLocation) requestGPS();
                setViewMode('navigation');
                setCustomZoom(null);
              }}
              className={`flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-2xl shadow-2xl transition-all hover:scale-105 active:scale-95 group relative border border-white/20 ${viewMode === 'navigation' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}
            >
              <img src="/volante.png" alt="Modo Navegación" className="h-6 w-6 md:h-8 md:w-8 object-contain drop-shadow-md" />
              <span className="absolute -top-10 right-0 scale-0 group-hover:scale-100 transition-all bg-black/80 px-3 py-1 rounded text-[10px] font-bold whitespace-nowrap">Modo Navegación</span>
            </button>
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
    </main>
  );
}
