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

const createCarIcon = () => {
  const iconHtml = renderToStaticMarkup(
    <div className="relative flex items-center justify-center h-12 w-12 transform -translate-x-1/2 -translate-y-1/2">
      <div className="absolute inset-0 rounded-full border-2 border-blue-500/50 animate-ping"></div>
      <div className="h-5 w-5 rounded-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,1)] border-2 border-white flex items-center justify-center">
         <div className="h-1.5 w-1.5 bg-white rounded-full"></div>
      </div>
    </div>
  );
  return L.divIcon({ html: iconHtml, className: 'custom-car-icon', iconSize: [48, 48], iconAnchor: [24, 24] });
};

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

function LocationTracker({ position, isTracking, hasRoute }: { position: L.LatLngExpression, isTracking: boolean, hasRoute: boolean }) {
  const map = useMap();
  useEffect(() => {
    // Si NO hay ruta trazada, centramos el tracking normal con zoom 15.
    // Si HAY ruta trazada, no forzamos el zoom a 15 para permitir ver la ruta entera (RouteFitter lo maneja)
    if (isTracking && !hasRoute) {
      map.setView(position, 15, { animate: true, duration: 1 });
    }
  }, [position, isTracking, map, hasRoute]);
  return null;
}

interface MapUIProps {
   userPos: [number, number];
   routeCoordinates?: [number, number][];
   radars: Radar[];
   aircrafts?: Aircraft[];
}

export default function MapUI({ userPos, routeCoordinates, radars = [], aircrafts = [] }: MapUIProps) {
  const [isFollowing, setIsFollowing] = useState(true);

  const carIcon = useRef(createCarIcon());

  // No longer watching geolocation here, userPos is passed as a prop
  // The onPositionUpdate prop is also removed as userPos is the source of truth

  return (
    <div className="relative h-full w-full bg-gray-900 overflow-hidden">
      {/* Removed hasLocation state and its related UI */}

      <button 
        onClick={() => {
           setIsFollowing(true);
           // If there's no route, re-center the map to the user's position
           // The map's center prop will handle the actual re-centering via LocationTracker
        }}
        className={`absolute bottom-32 right-8 z-[400] flex h-12 w-12 items-center justify-center rounded-full backdrop-blur-lg border transition-all shadow-lg
          ${isFollowing && !routeCoordinates 
            ? 'bg-blue-600/90 border-blue-500 text-white shadow-blue-500/30' 
            : 'bg-white/10 border-white/20 text-gray-300 hover:bg-white/20'}`}
      >
        <Navigation className={`h-5 w-5 ${isFollowing && !routeCoordinates ? 'animate-pulse' : ''}`} />
      </button>

      <MapContainer 
        center={userPos} 
        zoom={15} 
        className="h-full w-full z-0"
        zoomControl={false}
      >
        <MapEvents onDragStart={() => setIsFollowing(false)} />
        <TileLayer attribution={MAP_ATTRIBUTION} url={DARK_MAP_TILES} />
        
        {/* Fitbounds si hay array de ruta */}
        <RouteFitter routeCoordinates={routeCoordinates} />
        
        {/* Tracking del usuario si le da a centrar o si está recien cargado SIN ruta activa */}
        <LocationTracker position={userPos} isTracking={isFollowing} hasRoute={!!routeCoordinates} />
        
        {/* Trazado de Ruta */}
        {routeCoordinates && routeCoordinates.length > 0 && (
           <>
             {/* Línea gruesa neón con sombra para efecto premium */}
             <Polyline 
                positions={routeCoordinates} 
                pathOptions={{ color: '#3b82f6', weight: 6, opacity: 0.8, lineCap: 'round', lineJoin: 'round' }}
             />
             <Polyline 
                positions={routeCoordinates} 
                pathOptions={{ color: '#60a5fa', weight: 2, opacity: 1, lineCap: 'round', lineJoin: 'round' }}
             />
             {/* Destino final marcado en rojo */}
             <Marker position={routeCoordinates[routeCoordinates.length - 1]} icon={endMarkerIcon} />
           </>
        )}

        {/* Marcadores de Radares */}
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

        {/* Marcadores de Aviones (Pegasus) */}
        {aircrafts.map((aircraft) => (
          <Marker
            key={aircraft.icao24}
            position={[aircraft.lat, aircraft.lon]}
            icon={aircraftIcon(aircraft.isSuspect)}
          >
            <Popup className="tesla-popup">
              <div className="p-2">
                <p className={`font-bold text-lg ${aircraft.isSuspect ? 'text-blue-500' : 'text-gray-400'} mb-1`}>
                  {aircraft.isSuspect ? 'PEGASUS / VIGILANCIA' : 'VUELO CIVIL'}
                </p>
                <p className="text-xs opacity-70 mb-1">{aircraft.callsign || 'N/A'} ({aircraft.origin_country})</p>
                <p className="text-sm">Altitud: <b>{Math.round(aircraft.altitude || 0)}m</b></p>
                <p className="text-sm">Velocidad: <b>{Math.round((aircraft.velocity || 0) * 3.6)} km/h</b></p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Vehículo actual */}
        <Marker position={userPos} icon={carIcon.current}>
          <Popup className="premium-popup">
            <div className="text-center font-sans p-1">
              <span className="block font-bold text-gray-900 pb-1 border-b">Tesla</span>
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
