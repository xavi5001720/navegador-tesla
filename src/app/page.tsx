'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { MapPin, Navigation, Menu, X, AlertTriangle } from 'lucide-react';

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
    hasLocation, 
    requestGPS 
  } = useGeolocation();

  const { route, loadingRoute, routeError, findAndTraceRoute, clearRoute } = useRoute();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Open sidebar by default only on desktop
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth > 768) {
      setIsSidebarOpen(true);
    }
  }, []);

  const { radars: allRadars, loadingRadars } = useRadars(userPos, route?.coordinates);

  // Filtrar radares para mostrar solo los que están en la ruta
  const radars = useMemo(() => {
    if (!route || !route.coordinates || route.coordinates.length === 0 || allRadars.length === 0) {
      return allRadars;
    }

    return allRadars.filter(radar => {
      const radarPos: [number, number] = [radar.lat, radar.lon];
      const distToPath = distanceToPolyline(radarPos, route.coordinates);
      return distToPath < 150;
    });
  }, [allRadars, route]);

  const { nearestRadar, distance, isAlertActive } = useAlerts(userPos, radars);
  const { aircrafts, isAnyPegasusNearby, isRateLimited, loading: loadingAircrafts } = usePegasus(userPos);
  const speed = useSpeed();

  const handleSearchSubmit = async (query: string) => {
    const origin: [number, number] = userPos || [40.4168, -3.7038];
    await findAndTraceRoute(origin, query);
  };

  return (
    <main className="flex h-screen w-full overflow-hidden bg-gray-950 font-sans text-white selection:bg-blue-500/30">
      
      {/* Alerta de Radar */}
      {isAlertActive && nearestRadar && distance !== null && (
        <AlertOverlay radar={nearestRadar} distance={distance} />
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
        radars={radars}
        isAnyPegasusNearby={isAnyPegasusNearby}
        isRateLimited={isRateLimited}
        loadingAircrafts={loadingAircrafts}
        hasLocation={hasLocation}
        onSearch={handleSearchSubmit}
      />

      {/* Sección del Mapa (Fondo) */}
      <section className="relative flex-1 bg-gray-900 overflow-hidden">
        <DynamicMap 
          userPos={userPos}
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
