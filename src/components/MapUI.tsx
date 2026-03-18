'use client';

import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Navigation, Camera, Plane } from 'lucide-react'; 
import { renderToStaticMarkup } from 'react-dom/server';
import { Radar } from '@/hooks/useRadars';
import { Aircraft } from '@/hooks/usePegasus';

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

const aircraftIcon = (isSuspect: boolean) => L.divIcon({
  html: renderToStaticMarkup(
    <div className={`aircraft-marker flex items-center justify-center p-2 rounded-full border-2 ${isSuspect ? 'bg-blue-600 border-white animate-pulse shadow-[0_0_15px_rgba(37,99,235,0.8)]' : 'bg-gray-600 border-gray-400 opacity-60'} text-white`}>
      <Plane className="h-4 w-4" style={{ transform: isSuspect ? 'scale(1.2)' : 'none' }} />
    </div>
  ),
  className: 'custom-aircraft-icon',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
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

const createCarIcon = () => {
  const iconHtml = renderToStaticMarkup(
    <div className="relative flex items-center justify-center h-16 w-16 transform -translate-x-1/2 -translate-y-1/2">
      <svg viewBox="0 0 100 100" className="w-12 h-12 drop-shadow-2xl">
        {/* Cuerpo del Tesla (vista superior) */}
        <path d="M50 10 C35 10, 25 25, 25 50 C25 75, 35 90, 50 90 C65 90, 75 75, 75 50 C75 25, 65 10, 50 10 Z" fill="#3b82f6" />
        <path d="M50 15 C40 15, 30 25, 30 45 L70 45 C70 25, 60 15, 50 15 Z" fill="#1d4ed8" /> {/* Techo/Cristal frontal */}
        <path d="M50 85 C40 85, 35 75, 35 65 L65 65 C65 75, 60 85, 50 85 Z" fill="#1d4ed8" /> {/* Cristal trasero */}
        <rect x="22" y="30" width="6" height="15" rx="2" fill="#1e293b" /> {/* Rueda DI */}
        <rect x="72" y="30" width="6" height="15" rx="2" fill="#1e293b" /> {/* Rueda DD */}
        <rect x="22" y="60" width="6" height="15" rx="2" fill="#1e293b" /> {/* Rueda TI */}
        <rect x="72" y="60" width="6" height="15" rx="2" fill="#1e293b" /> {/* Rueda TD */}
        <circle cx="35" cy="20" r="3" fill="white" opacity="0.8" /> {/* Faro I */}
        <circle cx="65" cy="20" r="3" fill="white" opacity="0.8" /> {/* Faro D */}
      </svg>
    </div>
  );
  return L.divIcon({ html: iconHtml, className: 'custom-car-icon', iconSize: [64, 64], iconAnchor: [32, 32] });
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
  const carIconRef = useRef(createCarIcon());

  return (
    <div className="relative h-full w-full bg-gray-900 overflow-hidden">
      <style jsx global>{`
        .leaflet-container {
           background: #030712 !important;
        }
        /* Rotar inversamente los popups y marcadores informativos para que no salgan volcados */
        .custom-radar-icon, .custom-aircraft-icon, .custom-end-icon, .tesla-popup, .leaflet-popup {
           transform: rotate(${isFollowing ? heading : 0}deg) !important;
           transition: transform 0.5s ease-out;
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
            icon={aircraftIcon(aircraft.isSuspect)}
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

        {/* Vehículo actual - Siempre apuntando ARRIBA en modo track-up */}
        <Marker position={userPos} icon={carIconRef.current} />
      </MapContainer>
    </div>
  );
}
