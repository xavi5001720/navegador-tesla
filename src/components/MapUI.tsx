'use client';

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Navigation, Camera, Plane } from 'lucide-react'; 
import { renderToStaticMarkup } from 'react-dom/server';
import { Radar } from '@/hooks/useRadars';
import { Aircraft } from '@/hooks/usePegasus';
import { Charger } from '@/hooks/useChargers';
import { GasStation } from '@/hooks/useGasStations';
import { findClosestPointOnPolyline, getBearing } from '@/utils/geo';
import MapContextMenu from './MapContextMenu';
import { RouteSection } from '@/hooks/useRoute';
import { WeatherPoint } from '@/hooks/useWeather';
import { getCarFilter } from '@/utils/carStyles';

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
    <div className="relative h-10 w-10 flex flex-col items-center">
      <div className="h-8 w-8 flex items-center justify-center rounded-full bg-rose-600 border-2 border-white shadow-lg animate-pulse z-10">
         <Camera className="h-4 w-4 text-white" />
      </div>
      {speedLimit && (
        <div className="absolute -bottom-1 bg-white border-2 border-rose-600 rounded-full h-5 w-5 flex items-center justify-center shadow-md z-20">
          <span className="text-[10px] font-black text-black leading-none">{speedLimit}</span>
        </div>
      )}
    </div>
  ),
  className: 'custom-radar-icon',
  iconSize: [40, 44],
  iconAnchor: [20, 32],
});

const chargerIcon = L.divIcon({
  html: renderToStaticMarkup(
    <div className="h-8 w-8 flex items-center justify-center rounded-full bg-emerald-600 border-2 border-white shadow-[0_0_15px_rgba(5,150,105,0.8)]">
       <img src="/cargadorEV.png" alt="C" className="h-4 w-4 object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
    </div>
  ),
  className: 'custom-charger-icon pointer-events-auto',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const gasStationIcon = L.divIcon({
  html: renderToStaticMarkup(
    <div className="h-8 w-8 flex items-center justify-center rounded-full bg-orange-500 border-2 border-white shadow-[0_0_15px_rgba(249,115,22,0.8)]">
       <img src="/gasolinera.png" alt="G" className="h-4 w-4 object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
    </div>
  ),
  className: 'custom-gas-icon pointer-events-auto',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const aircraftIcon = (isSuspect: boolean, heading: number, distanceToUser: number = Infinity, viewMode: string = 'navigation', altitude?: number, velocity?: number, callsign?: string) => {
  const isThreat = isSuspect && distanceToUser < 10000;
  const colorFilter = isThreat
    ? 'invert(15%) sepia(100%) saturate(700%) hue-rotate(340deg) brightness(120%) contrast(130%)'
    : 'none';

  let airlineName = 'Vuelo Comercial';
  if (callsign) {
    const prefix = callsign.trim().substring(0, 3).toUpperCase();
    if (airlineMapping[prefix]) {
      airlineName = `✈️ ${airlineMapping[prefix]}`;
    } else if (callsign.trim()) {
      airlineName = `Vuelo ${callsign.trim()}`;
    }
  }

  const labelHtml = (viewMode === 'overview') ? `
    <div class="absolute top-10 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none" style="min-width: 150px;">
      <div class="bg-black/80 backdrop-blur-md border border-${isSuspect ? 'blue' : 'gray'}-500/50 rounded-lg p-2 shadow-2xl text-center">
        <p class="text-[10px] font-black text-${isSuspect ? 'blue' : 'gray'}-400 uppercase tracking-tighter leading-tight whitespace-nowrap">${isSuspect ? 'Aeronave no identificada' : airlineName}</p>
        <div class="flex gap-2 mt-1 justify-center">
          <div class="flex flex-col">
            <span class="text-[8px] text-gray-400 uppercase font-bold">Altitud</span>
            <span class="text-[11px] font-black text-white">${Math.round(altitude || 0)}m</span>
          </div>
          <div class="flex flex-col border-l border-white/10 pl-2">
            <span class="text-[8px] text-gray-400 uppercase font-bold">Velocidad</span>
            <span class="text-[11px] font-black text-white">${Math.round((velocity || 0) * 3.6)} km/h</span>
          </div>
        </div>
      </div>
      <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-black/80 rotate-180 -mt-1"></div>
    </div>
  ` : '';

  return L.divIcon({
    html: `
      <div class="relative">
        <div style="transform: rotate(${heading - 45}deg); width: 40px; height: 40px; ${isThreat ? 'animation: aircraft-pulse 0.8s ease-in-out infinite;' : ''}">
          <img
            src="${isSuspect ? '/avion-no-identificado.png' : '/avion-comercial.png'}"
            alt="Avión"
            style="width: 100%; height: 100%; object-fit: contain; filter: ${colorFilter};"
          />
        </div>
        ${labelHtml}
      </div>
    `,
    className: 'custom-aircraft-icon',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
};

const weatherEmojiMap: Record<string, string> = {
  'Clear': '☀️',
  'Clouds': '⛅',
  'Rain': '🌧️',
  'Drizzle': '🌦️',
  'Thunderstorm': '⛈️',
  'Snow': '❄️',
  'Mist': '🌫️',
  'Fog': '🌫️'
};

const createWeatherIcon = (temp: number, condition: string) => {
  const emoji = weatherEmojiMap[condition] || '🌡️';
  const iconHtml = renderToStaticMarkup(
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-black/50 backdrop-blur-md border border-white/20 rounded-full shadow-[0_0_15px_rgba(0,0,0,0.5)] text-white font-bold whitespace-nowrap">
       <span className="text-lg drop-shadow-md leading-none">{emoji}</span>
       <span className="text-sm drop-shadow-md leading-none">{Math.round(temp)}º</span>
    </div>
  );
  return L.divIcon({ html: iconHtml, className: 'custom-weather-icon bg-transparent border-none', iconSize: [75, 36], iconAnchor: [37, 18] });
};

const airlineMapping: Record<string, string> = {
  'IBE': 'Iberia',
  'VLG': 'Vueling',
  'AEA': 'Air Europa',
  'RYR': 'Ryanair',
  'EZY': 'easyJet',
  'BAW': 'British Airways',
  'AFR': 'Air France',
  'DLH': 'Lufthansa',
  'KLM': 'KLM',
  'SWR': 'Swiss International Air Lines',
  'AAL': 'American Airlines',
  'DAL': 'Delta Air Lines',
  'UAL': 'United Airlines',
  'UAE': 'Emirates',
  'QTR': 'Qatar Airways',
  'THY': 'Turkish Airlines',
  'SIA': 'Singapore Airlines',
  'WZZ': 'Wizz Air',
  'EJU': 'easyJet Europe',
  'TVF': 'Transavia France',
  'TRA': 'Transavia'
};

const fuelLabels: Record<string, string> = {
  g95: 'G95',
  g98: 'G98',
  diesel: 'Diésel',
  glp: 'GLP'
};

const SATELLITE_MAP_TILES = 'https://mt1.google.com/vt/lyrs=y&apistyle=s.t:3|p.v:off&x={x}&y={y}&z={z}';
const MAP_ATTRIBUTION = '&copy; Google Maps';

// Ref global para comunicar el drag desde MapEvents a LocationTracker sin re-renders
const userIsDraggingRef = { current: false };

function MapEvents({ onMapClick }: { onMapClick?: (lat: number, lon: number, screenX: number, screenY: number) => void }) {
  const map = useMap();
  useEffect(() => {
    const onDragStart = () => {
      // Marcamos que el usuario está arrastrando; LocationTracker lo usará para pausar el seguimiento
      userIsDraggingRef.current = true;
    };
    const onDragEnd = () => {
      // Tras soltar, esperamos 5 segundos antes de volver a seguir al coche
      setTimeout(() => { userIsDraggingRef.current = false; }, 5000);
    };
    const onClick = (e: L.LeafletMouseEvent) => {
      if (onMapClick) onMapClick(e.latlng.lat, e.latlng.lng, e.originalEvent.clientX, e.originalEvent.clientY);
    };
    map.on('dragstart', onDragStart);
    map.on('dragend', onDragEnd);
    map.on('click', onClick);
    return () => {
      map.off('dragstart', onDragStart);
      map.off('dragend', onDragEnd);
      map.off('click', onClick);
    };
  }, [map, onMapClick]);
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
   carColor?: string;
   routeCoordinates?: [number, number][];
   radars: Radar[];
   aircrafts?: Aircraft[];
   chargers?: Charger[];
   gasStations?: GasStation[];
   weatherPoints?: WeatherPoint[];
   waypoints?: [number, number][];
   speed?: number;
   viewMode?: 'navigation' | 'overview';
   onViewModeChange?: (mode: 'navigation' | 'overview') => void;
   customZoom?: number | null;
   onZoomChange?: (zoom: number) => void;
   onMapClick?: (lat: number, lon: number, screenX: number, screenY: number) => void;
   routeSections?: RouteSection[];
}

const createCarIcon = (heading: number, color?: string) => {
  const iconHtml = renderToStaticMarkup(
    <div className="relative flex items-center justify-center h-28 w-28 group" style={{ transform: `rotate(${heading}deg)` }}>
      {/* Sombra direccional base azulada bajo el vehículo */}
      <div className={`absolute inset-0 rounded-full blur-2xl scale-125 transition-all duration-700 ${
           color === 'Rojo' ? 'bg-red-500/30' : 
           color === 'Azul' ? 'bg-blue-500/30' : 
           color === 'Negro' ? 'bg-gray-900/40' : 'bg-blue-500/20'}`}></div>
      
      {/* Imagen del coche con filtro dinámico */}
      <img 
        src="/coche.png" 
        alt="Coche" 
        className="w-full h-full object-contain drop-shadow-[0_15px_15px_rgba(0,0,0,0.8)] transition-all duration-700 rotate-180" 
        style={{ filter: getCarFilter(color) }}
      />
    </div>
  );
  return L.divIcon({ html: iconHtml, className: 'custom-car-icon', iconSize: [110, 110], iconAnchor: [55, 55] });
};

// Interpolación angular más corta entre dos ángulos (evita el salto 359° → 0°)
function lerpAngle(current: number, target: number, alpha: number): number {
  let diff = ((target - current) % 360 + 540) % 360 - 180; // diff en [-180, 180]
  return current + diff * alpha;
}

function MapRotator({ heading, viewMode, speed = 0 }: { heading: number, viewMode: string, speed?: number }) {
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
    // Solo rotamos en modo navegación y cuando vamos a más de 10 km/h
    const speedKmh = speed * 3.6;
    const shouldRotate = viewMode === 'navigation' && speedKmh >= 10;

    container.style.transition = 'none';

    const animate = () => {
      if (!shouldRotate) {
        // Volvemos suavemente al norte
        smoothedHeadingRef.current = lerpAngle(smoothedHeadingRef.current, 0, 0.08);
        if (Math.abs(smoothedHeadingRef.current) > 0.1) {
          container.style.transform = `rotate(${-smoothedHeadingRef.current}deg) scale(1.42)`;
          rafRef.current = requestAnimationFrame(animate);
        } else {
          container.style.transform = 'none';
        }
        return;
      }

      // Suavizado angular con rAF — scale(1.42) = √2 para cubrir el viewport en rotación
      smoothedHeadingRef.current = lerpAngle(smoothedHeadingRef.current, targetHeadingRef.current, 0.06);
      container.style.transform = `rotate(${-smoothedHeadingRef.current}deg) scale(1.42)`;
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
  const lastOverviewRouteRef = useRef<string>('');
  const lastViewModeRef = useRef<string>(viewMode);

  // VISTA GENERAL: centrado inicial cuando se entra al modo o cambia la ruta.
  // Después de eso el mapa es completamente libre: el usuario puede mover y hacer zoom sin restricciones.
  useEffect(() => {
    if (viewMode !== 'overview') {
      lastOverviewRouteRef.current = '';
      lastViewModeRef.current = viewMode;
      return;
    }

    const routeKey = JSON.stringify(routeCoordinates);
    const modeJustChanged = lastViewModeRef.current !== 'overview';
    lastViewModeRef.current = 'overview';

    // Solo centramos si acabamos de entrar al modo o si llegó una ruta nueva
    if (!modeJustChanged && lastOverviewRouteRef.current === routeKey) return;

    lastOverviewRouteRef.current = routeKey;

    if (hasRoute && routeCoordinates && routeCoordinates.length > 0) {
      try {
        const bounds = L.latLngBounds(routeCoordinates);
        map.fitBounds(bounds, { padding: [80, 80], animate: true, duration: 1.5 });
      } catch (e) {
        map.setView(position, 13, { animate: true, duration: 1.5 });
      }
    } else {
      // Sin ruta: zoom de ciudad centrado en el usuario
      map.setView(position, 13, { animate: true, duration: 1.5 });
    }
  }, [viewMode, hasRoute, routeCoordinates, map, position]);

  // MODO NAVEGACIÓN: sigue al coche con zoom dinámico.
  // Si el usuario arrastra el mapa, pausamos el seguimiento 5 segundos.
  useEffect(() => {
    if (viewMode !== 'navigation') return;
    // Si el usuario está arrastrando, no interferimos
    if (userIsDraggingRef.current) return;

    const speedKmh = speed * 3.6;

    let targetZoom: number;
    if (customZoom != null) {
      targetZoom = customZoom;
    } else if (speedKmh < 10) {
      targetZoom = 19; // Muy lento / parado: máximo detalle
    } else if (speedKmh < 40) {
      targetZoom = 18; // Ciudad
    } else if (speedKmh < 80) {
      targetZoom = 17; // Carretera secundaria
    } else if (speedKmh < 120) {
      targetZoom = 16; // Autovía
    } else {
      targetZoom = 15; // Autopista / alta velocidad
    }

    map.setView(position, targetZoom, { animate: true, duration: 0.8 });
  }, [position, viewMode, speed, map, customZoom]);

  return null;
}




export default function MapUI({ 
  userPos, 
  heading, 
  carColor,
  routeCoordinates, 
  radars = [], 
  aircrafts = [], 
  chargers = [],
  gasStations = [],
  weatherPoints = [],
  waypoints = [],
  speed = 0, 
  viewMode = 'overview', 
  onViewModeChange, 
  customZoom, 
  onZoomChange, 
  onMapClick,
  routeSections = []
}: MapUIProps) {
  return (
    <div className="relative h-full w-full bg-gray-900 overflow-hidden">
      <style jsx global>{`
        .leaflet-container {
           background: #030712 !important;
        }
        @keyframes aircraft-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.15); }
        }
      `}</style>

      <MapContainer 
        center={userPos} 
        zoom={15} 
        className="h-full w-full z-0"
        zoomControl={false}
      >
        <MapEvents onMapClick={onMapClick} />
        <MapRotator heading={heading} viewMode={viewMode} speed={speed} />
        
        {/* Capa de Satélite Limpia (Sin etiquetas ni iconos) */}
        <TileLayer 
          attribution="&copy; Google Maps"
          url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" 
        />
        
        {/* Capa de Etiquetas Limpias (Solo nombres de ciudades y carreteras, SIN POIs) */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
          opacity={0.8}
        />
        
        <RouteFitter routeCoordinates={routeCoordinates} />
        
        <LocationTracker position={userPos} viewMode={viewMode} hasRoute={!!routeCoordinates} speed={speed} routeCoordinates={routeCoordinates} customZoom={customZoom} />
        
        {(() => {
          if (!routeCoordinates || routeCoordinates.length === 0) return null;

          const snapped = findClosestPointOnPolyline(userPos, routeCoordinates);
          const currentIndex = snapped.segmentIndex;

          // Solo dibujamos desde la posición actual hasta el final
          const remainingCoords = routeCoordinates.slice(currentIndex);
          // Si el snapped está muy cerca de la línea, forzamos que el primer punto sea la posición "snapped" 
          // para suavizar la conexión coche-línea.
          if (remainingCoords.length > 0 && snapped.distance < 30) {
            remainingCoords[0] = snapped.point;
          }

          // Construimos los segmentos de color
          const polylines = [];
          let lastIndex = currentIndex;

          // Ordenamos las secciones por inicio
          const sortedSections = [...routeSections].sort((a, b) => a.start - b.start);

          sortedSections.forEach((section, idx) => {
            // Si la sección termina antes de nuestra posición actual, la ignoramos
            if (section.end <= currentIndex) return;

            // Si hay un hueco entre el último punto procesado y el inicio de esta sección lenta,
            // lo pintamos en el azul estándar.
            const startIdx = Math.max(lastIndex, section.start);
            if (startIdx > lastIndex) {
              polylines.push({
                coords: routeCoordinates.slice(lastIndex, startIdx + 1),
                color: '#3b82f6'
              });
            }

            // Pintamos la sección de tráfico
            const endIdx = section.end;
            polylines.push({
              coords: routeCoordinates.slice(startIdx, endIdx + 1),
              color: section.color
            });

            lastIndex = endIdx;
          });

          // Pintamos el tramo final si queda algo después de la última sección de tráfico
          if (lastIndex < routeCoordinates.length - 1) {
            polylines.push({
              coords: routeCoordinates.slice(lastIndex),
              color: '#3b82f6'
            });
          }

          return (
            <>
              {polylines.map((p, i) => (
                <Polyline 
                  key={`route-seg-${i}`}
                  positions={p.coords}
                  pathOptions={{ 
                    color: p.color, 
                    weight: 8, 
                    opacity: 0.9, 
                    lineCap: 'round', 
                    lineJoin: 'round' 
                  }}
                />
              ))}
              {waypoints.map((wp, i) => (
                <Marker key={`waypoint-${i}`} position={wp} icon={endMarkerIcon} />
              ))}
              <Marker position={routeCoordinates[routeCoordinates.length - 1]} icon={endMarkerIcon} />
            </>
          );
        })()}

        {radars.map((radar) => (
          <Marker 
            key={`radar-${radar.id}`} 
            position={[radar.lat, radar.lon]} 
            icon={radarIcon(radar.speedLimit)}
            zIndexOffset={100}
            interactive={false}
          />
        ))}

        {aircrafts.map((aircraft) => (
          <Marker
            key={`ac-${aircraft.icao24}`}
            position={[aircraft.lat, aircraft.lon]}
            icon={aircraftIcon(aircraft.isSuspect, aircraft.track, aircraft.distanceToUser, viewMode, aircraft.altitude, aircraft.velocity, aircraft.callsign)}
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

        {chargers.map(charger => (
          <Marker
             key={`charger-${charger.id}`}
             position={[charger.lat, charger.lon]}
             icon={chargerIcon}
             zIndexOffset={80}
             eventHandlers={{
               click: (e: L.LeafletMouseEvent) => {
                 if (onMapClick) onMapClick(charger.lat, charger.lon, e.originalEvent.clientX, e.originalEvent.clientY);
               }
             }}
          >
            <Popup className="custom-popup" closeButton={false}>
              <div className="p-3 min-w-[200px] flex flex-col gap-2 bg-gradient-to-b from-gray-900 to-black rounded-lg text-white shadow-2xl border border-emerald-500/50">
                <div className="flex items-center gap-2 pb-2 border-b border-emerald-500/30">
                  <div className="h-6 w-6 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0">
                    <img src="/cargadorEV.png" alt="⚡" className="h-4 w-4 object-contain" />
                  </div>
                  <div className="flex flex-col flex-1 overflow-hidden">
                    <h3 className="font-bold text-xs truncate break-all">{charger.title}</h3>
                    <p className="text-[10px] text-gray-400 capitalize truncate">{charger.operator}</p>
                  </div>
                </div>
                
                <div className="flex justify-between items-center text-xs bg-emerald-950/40 p-1.5 rounded-md border border-emerald-500/20">
                  <span className="text-gray-400">Potencia Máx</span>
                  <span className="font-black text-emerald-400">{charger.maxPower > 0 ? `${charger.maxPower} kW` : 'N/D'}</span>
                </div>
                
                <div className="text-[10px] text-gray-400 flex flex-col gap-1 mt-1">
                   <p><span className="font-bold text-gray-500 uppercase tracking-widest">Coste:</span> {charger.usageCost}</p>
                   <p className="truncate"><span className="font-bold text-gray-500 uppercase tracking-widest">Ubicación:</span> {charger.address}</p>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {gasStations.map(station => (
          <Marker
             key={`gas-${station.id}`}
             position={[station.lat, station.lon]}
             icon={gasStationIcon}
             zIndexOffset={85}
             eventHandlers={{
               click: (e: L.LeafletMouseEvent) => {
                 if (onMapClick) onMapClick(station.lat, station.lon, e.originalEvent.clientX, e.originalEvent.clientY);
               }
             }}
          >
            <Popup className="custom-popup" closeButton={false}>
              <div className="p-3 min-w-[200px] flex flex-col gap-2 bg-gradient-to-b from-gray-900 to-black rounded-lg text-white shadow-2xl border border-orange-500/50">
                <div className="flex items-center gap-2 pb-2 border-b border-orange-500/30">
                  <div className="h-6 w-6 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                    <img src="/gasolinera.png" alt="⛽" className="h-4 w-4 object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
                  </div>
                  <div className="flex flex-col flex-1 overflow-hidden">
                    <h3 className="font-bold text-xs truncate break-all">{station.name}</h3>
                    <p className="text-[10px] text-gray-400 capitalize truncate">{station.city}</p>
                  </div>
                </div>
                
                {station.cheapestFuelPrice && (
                  <div className="flex flex-col gap-1 bg-orange-950/40 p-1.5 rounded-md border border-orange-500/20">
                    <div className="flex justify-between items-center text-xs">
                       <span className="text-gray-400">Precio Búsqueda</span>
                       <span className="font-black text-orange-400">{station.cheapestFuelPrice.toFixed(3)} €/L</span>
                    </div>
                    {station.targetFuels && station.targetFuels.length > 0 && (
                      <div className="flex items-center gap-1.5 pt-1 border-t border-orange-500/10">
                        <span className="text-[8px] font-bold text-orange-600 uppercase tracking-tighter">Mejor precio de:</span>
                        <div className="flex gap-1">
                          {station.targetFuels.map(f => (
                            <span key={f} className="text-[8px] font-black text-white bg-orange-600 px-1 rounded-sm">{fuelLabels[f] || f}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1 text-[9px] text-gray-400 bg-white/5 p-1.5 rounded border border-white/10">
                   {station.price_g95 && <div className="flex justify-between"><span>G95</span><span className="font-bold text-white">{station.price_g95.toFixed(3)}€</span></div>}
                   {station.price_g98 && <div className="flex justify-between"><span>G98</span><span className="font-bold text-white">{station.price_g98.toFixed(3)}€</span></div>}
                   {station.price_diesel && <div className="flex justify-between"><span>Diésel</span><span className="font-bold text-white">{station.price_diesel.toFixed(3)}€</span></div>}
                   {station.price_glp && <div className="flex justify-between"><span>GLP</span><span className="font-bold text-white">{station.price_glp.toFixed(3)}€</span></div>}
                </div>

                <div className="text-[10px] text-gray-400 flex flex-col gap-1 mt-1">
                   <p className="truncate"><span className="font-bold text-gray-500 uppercase tracking-widest">Horario:</span> {station.schedule}</p>
                   <p className="truncate"><span className="font-bold text-gray-500 uppercase tracking-widest">Dirección:</span> {station.address}</p>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {weatherPoints.map(wp => (
          <Marker
             key={`weather-${wp.id}`}
             position={[wp.lat, wp.lon]}
             icon={createWeatherIcon(wp.temp, wp.condition)}
             zIndexOffset={70}
             interactive={false}
          />
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
          
          return <Marker position={pos} icon={createCarIcon(carHeading, carColor)} zIndexOffset={1000} />;
        })()}
      </MapContainer>
    </div>
  );
}
