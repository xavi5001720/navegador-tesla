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
      
      {/* Coche Super-Deportivo Futurista en SVG */}
      <svg viewBox="0 0 120 120" className="w-24 h-24 drop-shadow-[0_15px_15px_rgba(0,0,0,0.8)] object-contain transition-transform duration-500">
        <defs>
          <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            {/* Color Perla Blanco/Plata */}
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="50%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
          <linearGradient id="glassGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#020617" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Llantas ultra anchas y oscuras sobresaliendo un poco */}
        <rect x="22" y="25" width="10" height="24" rx="4" fill="#0f172a" />
        <rect x="88" y="25" width="10" height="24" rx="4" fill="#0f172a" />
        <rect x="22" y="75" width="10" height="26" rx="4" fill="#0f172a" />
        <rect x="88" y="75" width="10" height="26" rx="4" fill="#0f172a" />

        {/* Chasis oscurecido debajo para dar profundidad */}
        <path d="M 30 20 L 90 20 L 95 100 L 25 100 Z" fill="#000" opacity="0.6" />

        {/* Carrocería principal súper aerodinámica (Blanc Perla) */}
        <path d="M 45 6 L 75 6 C 90 15, 98 40, 96 65 C 94 90, 85 108, 70 112 L 50 112 C 35 108, 26 90, 24 65 C 22 40, 30 15, 45 6 Z" fill="url(#bodyGradient)" />
        
        {/* Entradas de refrigeración frontales y nervios en capó de carbono */}
        <path d="M 50 15 L 70 15 L 65 28 L 55 28 Z" fill="#000" opacity="0.85" />
        <path d="M 55 28 L 65 28 L 60 40 Z" fill="#333" opacity="0.5" />
        
        {/* Faldones laterales aerodinámicos (Túnel de Viento) */}
        <path d="M 26 50 Q 35 65 28 85 Q 38 65 26 50" fill="#1e293b" />
        <path d="M 94 50 Q 85 65 92 85 Q 82 65 94 50" fill="#1e293b" />

        {/* Front Splitter agresivo tipo F1 en Carbono */}
        <path d="M 32 10 L 88 10 C 92 12, 92 15, 87 18 L 33 18 C 28 15, 28 12, 32 10 Z" fill="#020617" />
        
        {/* Cúpula del habitáculo tintada mega negra rodeada del marco del techo */}
        <path d="M 45 35 C 45 22, 75 22, 75 35 C 80 50, 75 75, 60 85 C 45 75, 40 50, 45 35 Z" fill="url(#glassGradient)" />
        {/* Brillo en forma de ola sobre el parabrisas delantero */}
        <path d="M 47 37 C 47 26, 73 26, 73 37 C 77 50, 75 65, 60 72 C 45 65, 43 50, 47 37 Z" fill="#fff" opacity="0.1" /> 
        
        {/* Espejos / cámaras retrovisoras finas y cortantes */}
        <path d="M 28 40 L 22 38 L 24 43 Z" fill="#cbd5e1" />
        <path d="M 92 40 L 98 38 L 96 43 Z" fill="#cbd5e1" />

        {/* Faros matriciales delanteros: Líneas de Neón Cyan Cyberpunk */}
        <path d="M 28 17 L 42 12 L 44 19 L 32 24 Z" fill="#38bdf8" filter="url(#glow)" />
        <path d="M 92 17 L 78 12 L 76 19 L 88 24 Z" fill="#38bdf8" filter="url(#glow)" />
        {/* Lentes de proyección central ultra-brillantes blancas/azuladas */}
        <circle cx="36" cy="18" r="2.5" fill="#ffffff" filter="url(#glow)" />
        <circle cx="84" cy="18" r="2.5" fill="#ffffff" filter="url(#glow)" />

        {/* Ala trasera deportiva (Spoiler activo elevado) */}
        <path d="M 30 100 C 40 92, 80 92, 90 100 L 92 104 C 80 96, 40 96, 28 104 Z" fill="#020617" />

        {/* Firma lumínica trasera LED rojo contínuo */}
        <path d="M 35 106 C 45 109, 75 109, 85 106 L 81 110 C 70 112, 50 112, 39 110 Z" fill="#ef4444" filter="url(#glow)" />
        
        {/* Difusor trasero Aerodinámico de Carbono Massive */}
        <path d="M 42 110 L 78 110 L 72 118 L 48 118 Z" fill="#0f172a" />
        <line x1="53" y1="110" x2="53" y2="118" stroke="#333" strokeWidth="1" />
        <line x1="60" y1="110" x2="60" y2="118" stroke="#333" strokeWidth="1" />
        <line x1="67" y1="110" x2="67" y2="118" stroke="#333" strokeWidth="1" />
        
        {/* Escapes iluminados en azul eléctrico / reactores de plasma */}
        <ellipse cx="56.5" cy="115" rx="2" ry="3" fill="#38bdf8" filter="url(#glow)" />
        <ellipse cx="63.5" cy="115" rx="2" ry="3" fill="#38bdf8" filter="url(#glow)" />
      </svg>
    </div>
  );
  return L.divIcon({ html: iconHtml, className: 'custom-car-icon', iconSize: [110, 110], iconAnchor: [55, 55] });
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
        <MapRotator heading={heading} isFollowing={isFollowing} />
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
