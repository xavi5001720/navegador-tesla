'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { MapPin, Navigation, Menu, X, AlertTriangle, Power } from 'lucide-react';

import Sidebar from '@/components/Sidebar';
import AlertOverlay from '@/components/AlertOverlay';
import Speedometer from '@/components/Speedometer';

import { useRoute } from '@/hooks/useRoute';
import { useRadars } from '@/hooks/useRadars';
import { useAlerts } from '@/hooks/useAlerts';
import { useSpeed } from '@/hooks/useSpeed';
import { usePegasus } from '@/hooks/usePegasus';
import { useGeolocation } from '@/hooks/useGeolocation';

import { distanceToPolyline } from '@/utils/geo';
import { playPegasusAlert } from '@/utils/sound';

const DynamicMap = dynamic(() => import('@/components/MapUI'), {
  ssr: false,
  loading: () => (
    <div className="flex bg-gray-900 text-gray-400 h-full w-full items-center justify-center">
      Cargando Navegador...
    </div>
  ),
});

export default function Home() {
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
    clearRoute 
  } = useRoute();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRadarsEnabled, setIsRadarsEnabled] = useState(false);
  const [isAircraftsEnabled, setIsAircraftsEnabled] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [alertVolume, setAlertVolume] = useState(0.5);
  const [lastRecalculationTime, setLastRecalculationTime] = useState(0);

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

  // Open sidebar by default only on desktop
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth > 768) {
      setIsSidebarOpen(true);
    }
  }, []);

  const { radars: allRadars, loadingRadars, fetchingRouteRadars } = useRadars(userPos, route?.coordinates, isRadarsEnabled);

  // Filtrar radares para mostrar solo los que están en la ruta
  const radars = useMemo(() => {
    if (!isRadarsEnabled) return [];
    if (!route || !route.coordinates || route.coordinates.length === 0 || allRadars.length === 0) {
      return allRadars;
    }

    return allRadars.filter(radar => {
      const radarPos: [number, number] = [radar.lat, radar.lon];
      const distToPath = distanceToPolyline(radarPos, route.coordinates);
      return distToPath < 500;
    });
  }, [allRadars, route]);

  const speed = useSpeed();
  const { nearestRadar, distance, isAlertActive, alertType, remainingRadars } = useAlerts(userPos, radars, isSoundEnabled, alertVolume, speed);
  const { aircrafts, totalCount: aircraftCount, isAnyPegasusNearby, isRateLimited, loading: loadingAircrafts } = usePegasus(userPos, isAircraftsEnabled);

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
        hasLocation={hasLocation}
        onSearch={handleSearchSubmit}
        isSoundEnabled={isSoundEnabled}
        setIsSoundEnabled={setIsSoundEnabled}
        alertVolume={alertVolume}
        setAlertVolume={setAlertVolume}
      />

      {/* Sección del Mapa (Fondo) */}
      <section className="relative flex-1 bg-gray-900 overflow-hidden">
        <DynamicMap 
          userPos={userPos}
          heading={heading}
          routeCoordinates={route?.coordinates} 
          radars={radars}
          aircrafts={aircrafts}
        />

        {/* Panel de Avisos Rápidos y Velocímetro */}
        <div className="absolute bottom-6 right-6 z-[500] flex flex-col items-end gap-3 md:flex-row md:items-center md:gap-4 md:bottom-8 md:right-8">
          <Speedometer speed={speed} />
          
          <div className="flex flex-col gap-3 md:flex-row">
            <button className="flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-2xl bg-rose-600 shadow-2xl hover:bg-rose-500 transition-all hover:scale-105 active:scale-95 group relative border border-white/20">
              <AlertTriangle className="h-6 w-6 md:h-7 md:w-7 text-white" />
              <span className="absolute -top-10 right-0 scale-0 group-hover:scale-100 transition-all bg-black/80 px-3 py-1 rounded text-[10px] font-bold whitespace-nowrap">Radar Alert</span>
            </button>
            <button 
              onClick={() => {
                if (hasLocation) {
                  setUserPos([...userPos]);
                } else {
                  requestGPS();
                }
              }}
              className="flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-2xl bg-blue-600 shadow-2xl hover:bg-blue-500 transition-all hover:scale-105 active:scale-95 group relative border border-white/20"
            >
              <Navigation className="h-6 w-6 md:h-7 md:w-7 text-white" />
              <span className="absolute -top-10 right-0 scale-0 group-hover:scale-100 transition-all bg-black/80 px-3 py-1 rounded text-[10px] font-bold whitespace-nowrap">Recenter / GPS</span>
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
