'use client';

import { useEffect, useState } from 'react';
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

const aircraftIcon = (isSuspect: boolean, heading: number) => L.divIcon({
  html: renderToStaticMarkup(
    <div className={`aircraft-marker flex items-center justify-center p-2 rounded-full border-2 ${isSuspect ? 'bg-blue-600 border-white animate-pulse shadow-[0_0_20px_rgba(37,99,235,1)]' : 'bg-gray-700/80 border-gray-500 opacity-80'} text-white`}>
      <Plane className="h-4 w-4" style={{ transform: `rotate(${heading - 45}deg) scale(${isSuspect ? 1.4 : 1})` }} />
    </div>
  ),
  className: 'custom-aircraft-icon',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const DARK_MAP_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const MAP_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>';

function MapEvents({ onDragStart }: { onDragStart: () => void }) {
  const map = useMap();
  useEffect(() => {
    map.on('dragstart', onDragStart);
    return () => {
      map.off('dragstart', onDragStart);
    };
  }, [map, onDragStart]);
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
}

const createCarIcon = (heading: number) => {
  const iconHtml = renderToStaticMarkup(
    <div className="relative flex items-center justify-center h-20 w-20 group" style={{ transform: `rotate(${heading}deg)` }}>
      {/* Sombra/Halo de dirección */}
      <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-2xl scale-125"></div>
      
      {/* Coche Tesla en SVG (Orientado al Norte) */}
      <svg viewBox="0 0 100 100" className="w-16 h-16 drop-shadow-[0_10px_10px_rgba(0,0,0,0.6)] object-contain">
        {/* Cuerpo del Coche */}
        <path d="M50 5 C40 5 35 10 32 18 L28 45 L28 85 C28 90 32 94 37 94 L63 94 C68 94 72 90 72 85 L72 45 L68 18 C65 10 60 5 50 5 Z" fill="#E81922" />
        {/* Parabrisas */}
        <path d="M35 30 C35 25 40 22 50 22 C60 22 65 25 65 30 L63 42 C63 42 55 45 50 45 C45 45 37 42 37 42 Z" fill="#1A1A1A" />
        {/* Techo de Cristal / Sunroof */}
        <path d="M38 45 L62 45 L60 75 L40 75 Z" fill="#0D0D0D" />
        {/* Ventanilla Trasera */}
        <path d="M40 78 L60 78 L58 88 L42 88 Z" fill="#1A1A1A" />
        {/* Faros delanteros (subtiles) */}
        <path d="M32 12 Q35 10 38 12" stroke="white" strokeWidth="1" fill="none" opacity="0.4" />
        <path d="M68 12 Q65 10 62 12" stroke="white" strokeWidth="1" fill="none" opacity="0.4" />
        {/* Logo Tesla "T" Plateado en el Capó */}
        <g transform="translate(50, 13) scale(0.4)" fill="#CBD5E1">
          <path d="M-10 0 C-10 0 -5 -1 0 -1 C5 -1 10 0 10 0 L10 2 C10 2 5 1 0 1 C-5 1 -10 2 -10 2 Z" />
          <path d="M-2 3 L2 3 L1 9 C1 9 0 10 -1 9 L-2 3 Z" />
        </g>
      </svg>
    </div>
  );
  return L.divIcon({ html: iconHtml, className: 'custom-car-icon', iconSize: [80, 80], iconAnchor: [40, 40] });
};

function MapRotator({ heading, isFollowing }: { heading: number, isFollowing: boolean }) {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    if (isFollowing) {
      container.style.transition = 'transform 0.5s ease-out';
      container.style.transform = `rotate(${-heading}deg)`;
    } else {
      container.style.transform = 'none';
    }
  }, [map, heading, isFollowing]);
  return null;
}

function LocationTracker({ position, isTracking, hasRoute }: { position: L.LatLngExpression, isTracking: boolean, hasRoute: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (isTracking) {
      // Auto-Zoom: Si estamos en movimiento (tracking activo), nos acercamos más (zoom 17-18)
      const targetZoom = hasRoute ? 17 : 16;
      map.setView(position, targetZoom, { animate: true, duration: 1 });
    }
  }, [position, isTracking, map, hasRoute]);
  return null;
}

export default function MapUI({ userPos, heading, routeCoordinates, radars = [], aircrafts = [] }: MapUIProps) {
  const [isFollowing, setIsFollowing] = useState(true);

  return (
    <div className="relative h-full w-full bg-gray-900 overflow-hidden">
      <style jsx global>{`
        .leaflet-container {
           background: #030712 !important;
        }
      `}</style>

      <button 
        onClick={() => setIsFollowing(true)}
        className={`absolute bottom-32 right-8 z-[400] flex h-12 w-12 items-center justify-center rounded-full backdrop-blur-lg border transition-all shadow-lg
          ${isFollowing 
            ? 'bg-blue-600/90 border-blue-500 text-white shadow-blue-500/30' 
            : 'bg-white/10 border-white/20 text-gray-300 hover:bg-white/20'}`}
      >
        <Navigation className={`h-5 w-5 ${isFollowing ? 'animate-pulse' : ''}`} />
      </button>

      <MapContainer 
        center={userPos} 
        zoom={15} 
        className="h-full w-full z-0"
        zoomControl={false}
      >
        <MapEvents onDragStart={() => setIsFollowing(false)} />
        <MapRotator heading={heading} isFollowing={isFollowing} />
        <TileLayer attribution={MAP_ATTRIBUTION} url={DARK_MAP_TILES} />
        
        <RouteFitter routeCoordinates={routeCoordinates} />
        
        {/* Usamos userPos directamente para el tracker de vista, pero visualmente el coche puede ir snappeado */}
        <LocationTracker position={userPos} isTracking={isFollowing} hasRoute={!!routeCoordinates} />
        
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
            key={radar.id} 
            position={[radar.lat, radar.lon]} 
            icon={radarIcon(radar.speedLimit)}
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
            key={aircraft.icao24}
            position={[aircraft.lat, aircraft.lon]}
            icon={aircraftIcon(aircraft.isSuspect, aircraft.track)}
          >
            <Popup className="tesla-popup">
              <div className="p-2 text-gray-900">
                <p className={`font-bold text-lg ${aircraft.isSuspect ? 'text-blue-500' : 'text-gray-400'} mb-1`}>
                  {aircraft.isSuspect ? 'PEGASUS / VIGILANCIA' : 'VUELO CIVIL'}
                </p>
                <p className="text-sm">Altitud: <b>{Math.round(aircraft.altitude || 0)}m</b></p>
              </div>
            </Popup>
          </Marker>
        ))}

        {(() => {
          let pos = userPos;
          let carHeading = heading;
          
          if (isFollowing && routeCoordinates && routeCoordinates.length > 0) {
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
          
          return <Marker position={pos} icon={createCarIcon(carHeading)} />;
        })()}
      </MapContainer>
    </div>
  );
}
