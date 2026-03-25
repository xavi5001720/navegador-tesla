'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Navigation, Camera, Plane } from 'lucide-react'; 
import { renderToStaticMarkup } from 'react-dom/server';
import { Radar } from '@/hooks/useRadars';
import { Aircraft } from '@/hooks/usePegasus';
import { findClosestPointOnPolyline, getBearing } from '@/utils/geo';

const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = defaultIcon;


const endMarkerIcon = L.divIcon({
   html: renderToStaticMarkup(
     <div className="h-6 w-6 rounded-full bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,1)] border-4 border-white transform -translate-x-1/2 -translate-y-1/2"></div>
   ),
   className: 'custom-end-icon',
   iconSize: [24, 24],
   iconAnchor: [12, 12],
});

const radarIcon = (speedLimit?: number) => L.divIcon({
  html: renderToStaticMarkup(
    <div className="h-8 w-8 flex items-center justify-center rounded-full bg-rose-600 border-2 border-white shadow-lg animate-pulse">
       <Camera className="h-4 w-4 text-white" />
    </div>
  ),
  className: 'custom-radar-icon',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const aircraftIcon = (isSuspect: boolean, heading: number, distanceToUser: number = Infinity) => {
  const isThreat = isSuspect && distanceToUser < 10000;
  return L.divIcon({
    html: renderToStaticMarkup(
      <div className="aircraft-marker-container">
        {isSuspect ? (
          <div className={`flex items-center justify-center p-2 rounded-full border-2 ${
            isThreat
              ? 'bg-rose-600 border-white animate-pulse shadow-[0_0_20px_rgba(225,29,72,1)]'
              : 'bg-blue-600 border-white shadow-[0_0_15px_rgba(37,99,235,0.6)]' 
          } text-white`}>
            <Plane className="h-4 w-4" style={{ transform: `rotate(${heading - 45}deg) scale(1.4)` }} />
          </div>
        ) : (
          <div className="flex items-center justify-center text-amber-500/90 drop-shadow-md">
            <Plane fill="currentColor" className="h-5 w-5" style={{ transform: `rotate(${heading - 45}deg)` }} />
          </div>
        )}
      </div>
    ),
    className: 'custom-aircraft-icon',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};

const SATELLITE_MAP_TILES = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
const MAP_ATTRIBUTION = '&copy; Google Maps';

function MapEvents({ onViewModeChange }: { onViewModeChange?: (mode: 'navigation' | 'overview' | 'explore') => void }) {
  const map = useMap();
  useEffect(() => {
    const onDragStart = () => {
      if (onViewModeChange) onViewModeChange('explore');
    };
    map.on('dragstart', onDragStart);
    return () => {
      map.off('dragstart', onDragStart);
    };
  }, [map, onViewModeChange]);
  return null;
}

// Ajustamos la vista cuando hay una nueva ruta calculada
function RouteFitter({ routeCoordinates }: { routeCoordinates?: [number, number][] }) {
   const map = useMap();
   useEffect(() => {
     if (routeCoordinates && routeCoordinates.length > 0) {
        const bounds = L.latLngBounds(routeCoordinates);
        map.fitBounds(bounds, { padding: [50, 50], animate: true, duration: 1 });
     }
   }, [routeCoordinates, map]);
   return null;
}


interface MapUIProps {
   userPos: [number, number];
   heading: number;
   routeCoordinates?: [number, number][];
   radars: Radar[];
   aircrafts?: Aircraft[];
   speed?: number;
   viewMode?: 'navigation' | 'overview' | 'explore';
   onViewModeChange?: (mode: 'navigation' | 'overview' | 'explore') => void;
   customZoom?: number | null;
   onZoomChange?: (zoom: number) => void;
}

const createCarIcon = (heading: number) => {
  const iconHtml = renderToStaticMarkup(
    <div className="relative flex items-center justify-center h-28 w-28 group" style={{ transform: `rotate(${heading}deg)` }}>
      {/* Sombra direccional base azulada bajo el vehículo */}
      <div className="absolute inset-0 bg-blue-500/30 rounded-full blur-2xl scale-125"></div>
      
      {/* Imagen del coche proporcionada por el usuario */}
      <img src="/coche.png" alt="Coche" className="w-full h-full object-contain drop-shadow-[0_15px_15px_rgba(0,0,0,0.8)] transition-transform duration-500 rotate-180" />
    </div>
  );
  return L.divIcon({ html: iconHtml, className: 'custom-car-icon', iconSize: [110, 110], iconAnchor: [55, 55] });
};

// Interpolación angular más corta entre dos ángulos (evita el salto 359° → 0°)
function lerpAngle(current: number, target: number, alpha: number): number {
  let diff = ((target - current) % 360 + 540) % 360 - 180; // diff en [-180, 180]
  return current + diff * alpha;
}

function MapRotator({ heading, viewMode, hasRoute, speed = 0 }: { heading: number, viewMode: string, hasRoute: boolean, speed?: number }) {
  const map = useMap();
  const smoothedHeadingRef = useRef<number>(heading);
  const rafRef = useRef<number | null>(null);
  const targetHeadingRef = useRef<number>(heading);

  // Actualizamos el target cuando llega un heading nuevo del GPS
  useEffect(() => {
    targetHeadingRef.current = heading;
  }, [heading]);

  useEffect(() => {
    const container = map.getContainer();
    const shouldRotate = viewMode === 'navigation' && speed >= 10;

    // Eliminamos la transición CSS: ahora la animamos manualmente con rAF para tener control total
    container.style.transition = 'none';

    const animate = () => {
      if (!shouldRotate) {
        // Volvemos suavemente al norte cuando estamos detenidos o en otro modo
        smoothedHeadingRef.current = lerpAngle(smoothedHeadingRef.current, 0, 0.08);
        container.style.transform = Math.abs(smoothedHeadingRef.current) > 0.1
          ? `rotate(${-smoothedHeadingRef.current}deg)`
          : 'none';
        if (Math.abs(smoothedHeadingRef.current) > 0.1) {
          rafRef.current = requestAnimationFrame(animate);
        } else {
          container.style.transform = 'none';
        }
        return;
      }

      // Factor de suavizado: 0.06 = muy suave (GPS ruidoso), 0.15 = más reactivo
      smoothedHeadingRef.current = lerpAngle(smoothedHeadingRef.current, targetHeadingRef.current, 0.06);
      container.style.transform = `rotate(${-smoothedHeadingRef.current}deg)`;
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [map, viewMode, speed]);

  return null;
}

function LocationTracker({ position, viewMode, hasRoute, speed = 0, routeCoordinates, customZoom }: { position: L.LatLngExpression, viewMode: string, hasRoute: boolean, speed?: number, routeCoordinates?: [number, number][], customZoom?: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (viewMode === 'explore') return;

    if (viewMode === 'overview') {
      if (hasRoute && routeCoordinates && routeCoordinates.length > 0) {
        try {
          const posArr = Array.isArray(position) ? position as [number, number] : [0, 0] as [number, number];
          const snapped = findClosestPointOnPolyline(posArr, routeCoordinates);
          const remainingPath = routeCoordinates.slice(snapped.segmentIndex);
          if (remainingPath.length > 2) {
            remainingPath.unshift(posArr);
            const bounds = L.latLngBounds(remainingPath);
            map.fitBounds(bounds, { padding: [50, 50], animate: true, duration: 1.5 });
          } else {
            map.setView(position, 17, { animate: true, duration: 1 });
          }
        } catch (e) {
          map.setView(position, 16, { animate: true, duration: 1 });
        }
      } else {
        map.setView(position, 14, { animate: true, duration: 1.5 });
      }
    } else if (viewMode === 'navigation') {
      // Si el usuario ha fijado un zoom con los botones +/-, lo respetamos
      if (customZoom != null) {
        map.setView(position, customZoom, { animate: true, duration: 0.8 });
        return;
      }

      if (speed < 10) {
        map.setView(position, 17, { animate: true, duration: 1 });
      } else {
        let targetZoom = hasRoute ? 18 : 17;
        if (speed > 50) targetZoom = 17;
        if (speed > 100) targetZoom = 16;
        map.setView(position, targetZoom, { animate: true, duration: 1 });
      }
    }
  }, [position, viewMode, map, hasRoute, speed, routeCoordinates, customZoom]);
  return null;
}

function ZoomControls({ onViewModeChange, onZoomChange }: { onViewModeChange?: (mode: 'navigation' | 'overview' | 'explore') => void, onZoomChange?: (zoom: number) => void }) {
  const map = useMap();
  
  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newZoom = map.getZoom() + 1;
    map.setZoom(newZoom);
    if (onZoomChange) onZoomChange(newZoom);
  };
  
  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newZoom = map.getZoom() - 1;
    map.setZoom(newZoom);
    if (onZoomChange) onZoomChange(newZoom);
  };

  return (
    <div 
      className="absolute top-1/2 right-6 -translate-y-1/2 flex flex-col gap-3 z-[1000]"
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <button 
        onClick={handleZoomIn}
        className="flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-2xl shadow-2xl bg-black/60 backdrop-blur-xl border border-white/20 hover:bg-white/10 transition-all text-white text-3xl font-light hover:scale-105 active:scale-95"
      >
        +
      </button>
      <button 
        onClick={handleZoomOut}
        className="flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-2xl shadow-2xl bg-black/60 backdrop-blur-xl border border-white/20 hover:bg-white/10 transition-all text-white text-3xl font-light hover:scale-105 active:scale-95 mb-8 md:mb-0"
      >
        −
      </button>
    </div>
  );
}

export default function MapUI({ userPos, heading, routeCoordinates, radars = [], aircrafts = [], speed = 0, viewMode = 'navigation', onViewModeChange, customZoom, onZoomChange }: MapUIProps) {
  return (
    <div className="relative h-full w-full bg-gray-900 overflow-hidden">
      <style jsx global>{`
        .leaflet-container {
           background: #030712 !important;
        }
      `}</style>

      <MapContainer 
        center={userPos} 
        zoom={15} 
        className="h-full w-full z-0"
        zoomControl={false}
      >
        <ZoomControls onViewModeChange={onViewModeChange} onZoomChange={onZoomChange} />
        <MapEvents onViewModeChange={onViewModeChange} />
        <MapRotator heading={heading} viewMode={viewMode} hasRoute={!!routeCoordinates} speed={speed} />
        <TileLayer attribution={MAP_ATTRIBUTION} url={SATELLITE_MAP_TILES} />
        
        <RouteFitter routeCoordinates={routeCoordinates} />
        
        <LocationTracker position={userPos} viewMode={viewMode} hasRoute={!!routeCoordinates} speed={speed} routeCoordinates={routeCoordinates} customZoom={customZoom} />
        
        {routeCoordinates && routeCoordinates.length > 0 && (
           <>
             <Polyline 
                positions={routeCoordinates} 
                pathOptions={{ color: '#3b82f6', weight: 6, opacity: 0.8, lineCap: 'round', lineJoin: 'round' }}
             />
             <Marker position={routeCoordinates[routeCoordinates.length - 1]} icon={endMarkerIcon} />
           </>
        )}

        {radars.map((radar) => (
          <Marker 
            key={`radar-${radar.id}`} 
            position={[radar.lat, radar.lon]} 
            icon={radarIcon(radar.speedLimit)}
            zIndexOffset={100}
          >
            <Popup className="tesla-popup">
              <div className="p-2">
                <p className="font-bold text-lg text-red-500 mb-1">RADAR {radar.type.toUpperCase()}</p>
                {radar.speedLimit && <p className="text-sm font-medium">Límite: <span className="text-xl font-bold">{radar.speedLimit} km/h</span></p>}
              </div>
            </Popup>
          </Marker>
        ))}

        {aircrafts.map((aircraft) => (
          <Marker
            key={`ac-${aircraft.icao24}`}
            position={[aircraft.lat, aircraft.lon]}
            icon={aircraftIcon(aircraft.isSuspect, aircraft.track, aircraft.distanceToUser)}
            zIndexOffset={90}
          >
            <Popup className="tesla-popup">
              <div className="p-2 text-gray-900">
                <p className={`font-bold text-lg ${aircraft.isSuspect ? 'text-blue-500' : 'text-gray-400'} mb-1`}>
                  {aircraft.isSuspect ? 'AERONAVE' : 'VUELO CIVIL'}
                </p>
                <p className="text-sm">Altitud: <b>{Math.round(aircraft.altitude || 0)}m</b></p>
                <p className="text-sm">Llamada: <b>{aircraft.callsign}</b></p>
                <p className="text-sm">Velocidad: <b>{Math.round(aircraft.velocity * 3.6)} km/h</b></p>
              </div>
            </Popup>
          </Marker>
        ))}

        {(() => {
          let pos = userPos;
          let carHeading = heading;
          
          if (viewMode === 'navigation' && routeCoordinates && routeCoordinates.length > 0) {
            const snapped = findClosestPointOnPolyline(userPos, routeCoordinates);
            if (snapped.distance < 25) {
              pos = snapped.point;
              const p1 = routeCoordinates[snapped.segmentIndex];
              const p2 = routeCoordinates[snapped.segmentIndex + 1];
              if (p1 && p2) {
                carHeading = getBearing(p1, p2);
              }
            }
          }
          
          return <Marker position={pos} icon={createCarIcon(carHeading)} zIndexOffset={1000} />;
        })()}
      </MapContainer>
    </div>
  );
}
