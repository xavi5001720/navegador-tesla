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

const aircraftIcon = (isSuspect: boolean, heading: number, distanceToUser: number = Infinity) => {
  const isThreat = isSuspect && distanceToUser < 10000;
  return L.divIcon({
    html: renderToStaticMarkup(
      <div className={`aircraft-marker flex items-center justify-center p-2 rounded-full border-2 ${
        isThreat
          ? 'bg-rose-600 border-white animate-pulse shadow-[0_0_20px_rgba(225,29,72,1)]'
          : isSuspect 
            ? 'bg-blue-600 border-white shadow-[0_0_15px_rgba(37,99,235,0.6)]' 
            : 'bg-gray-700/80 border-gray-500 opacity-80'
      } text-white`}>
        <Plane className="h-4 w-4" style={{ transform: `rotate(${heading - 45}deg) scale(${isSuspect ? 1.4 : 1})` }} />
      </div>
    ),
    className: 'custom-aircraft-icon',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};

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
   speed?: number;
}

const createCarIcon = (heading: number) => {
  const iconHtml = renderToStaticMarkup(
    <div className="relative flex items-center justify-center h-28 w-28 group" style={{ transform: `rotate(${heading}deg)` }}>
      {/* Sombra direccional base azulada bajo el vehículo */}
      <div className="absolute inset-0 bg-blue-500/30 rounded-full blur-2xl scale-125"></div>
      
      {/* Imagen del coche proporcionada por el usuario */}
      <img src="/coche.png" alt="Coche" className="w-full h-full object-contain drop-shadow-[0_15px_15px_rgba(0,0,0,0.8)] transition-transform duration-500" />
    </div>
  );
  return L.divIcon({ html: iconHtml, className: 'custom-car-icon', iconSize: [110, 110], iconAnchor: [55, 55] });
};

function MapRotator({ heading, isFollowing, hasRoute, speed = 0 }: { heading: number, isFollowing: boolean, hasRoute: boolean, speed?: number }) {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const isOverview = hasRoute && speed < 10;
    
    if (isFollowing && !isOverview) {
      container.style.transition = 'transform 0.5s ease-out';
      container.style.transform = `rotate(${-heading}deg)`;
    } else {
      container.style.transition = 'transform 0.5s ease-out';
      container.style.transform = 'none';
    }
  }, [map, heading, isFollowing, hasRoute, speed]);
  return null;
}

function LocationTracker({ position, isTracking, hasRoute, speed = 0, routeCoordinates }: { position: L.LatLngExpression, isTracking: boolean, hasRoute: boolean, speed?: number, routeCoordinates?: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (isTracking) {
      if (hasRoute && routeCoordinates && routeCoordinates.length > 0 && speed < 10) {
        // Detenido o muy despacio (<10km/h): mostrar toda la ruta restante hasta el destino
        try {
           const posArr = Array.isArray(position) ? position as [number, number] : [0, 0] as [number, number];
           // Find user path progress vs the whole polyline. Use distance of 500m fallback
           const snapped = findClosestPointOnPolyline(posArr, routeCoordinates);
           const remainingPath = routeCoordinates.slice(snapped.segmentIndex);
           if (remainingPath.length > 2) {
             remainingPath.unshift(posArr); // Include car in the viewport
             const bounds = L.latLngBounds(remainingPath);
             map.fitBounds(bounds, { padding: [50, 50], animate: true, duration: 1.5 });
           } else {
             map.setView(position, 17, { animate: true, duration: 1 });
           }
        } catch (e) {
           map.setView(position, 16, { animate: true, duration: 1 });
        }
      } else {
        // En movimiento (>10km/h): seguimiento cercano, abriendo el plano gradualmente a más velocidad
        let targetZoom = hasRoute ? 18 : 17;
        if (speed > 50) targetZoom = 17;
        if (speed > 100) targetZoom = 16;
        
        map.setView(position, targetZoom, { animate: true, duration: 1 });
      }
    }
  }, [position, isTracking, map, hasRoute, speed, routeCoordinates]);
  return null;
}

export default function MapUI({ userPos, heading, routeCoordinates, radars = [], aircrafts = [], speed = 0 }: MapUIProps) {
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
        <MapRotator heading={heading} isFollowing={isFollowing} hasRoute={!!routeCoordinates} speed={speed} />
        <TileLayer attribution={MAP_ATTRIBUTION} url={DARK_MAP_TILES} />
        
        <RouteFitter routeCoordinates={routeCoordinates} />
        
        {/* Usamos userPos directamente para el tracker de vista, pero visualmente el coche puede ir snappeado */}
        <LocationTracker position={userPos} isTracking={isFollowing} hasRoute={!!routeCoordinates} speed={speed} routeCoordinates={routeCoordinates} />
        
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
                  {aircraft.isSuspect ? 'PEGASUS / VIGILANCIA' : 'VUELO CIVIL'}
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
          
          return <Marker position={pos} icon={createCarIcon(carHeading)} zIndexOffset={1000} />;
        })()}
      </MapContainer>
    </div>
  );
}
