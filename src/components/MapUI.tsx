'use client';

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Camera, Map as MapIcon } from 'lucide-react'; 
import { renderToStaticMarkup } from 'react-dom/server';
import { Radar } from '@/hooks/useRadars';
import { Aircraft } from '@/hooks/usePegasus';
import { Charger } from '@/hooks/useChargers';
import { GasStation } from '@/hooks/useGasStations';
import { findClosestPointOnPolyline, getBearing } from '@/utils/geo';
import { RouteSection } from '@/hooks/useRoute';
import { WeatherPoint } from '@/hooks/useWeather';
import { getCarFilter, getCarImage } from '@/utils/carStyles';
import { Friend } from '@/hooks/useSocial';

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
    <div className="relative h-10 w-10 flex flex-col items-center counter-rotate">
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
    <div className="h-8 w-8 flex items-center justify-center rounded-full bg-emerald-600 border-2 border-white shadow-[0_0_15px_rgba(5,150,105,0.8)] counter-rotate">
       <img src="/cargadorEV.png" alt="C" className="h-4 w-4 object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
    </div>
  ),
  className: 'custom-charger-icon pointer-events-auto',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const gasStationIcon = L.divIcon({
  html: renderToStaticMarkup(
    <div className="h-8 w-8 flex items-center justify-center rounded-full bg-orange-500 border-2 border-white shadow-[0_0_15px_rgba(249,115,22,0.8)] counter-rotate">
       <img src="/gasolinera.png" alt="G" className="h-4 w-4 object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
    </div>
  ),
  className: 'custom-gas-icon pointer-events-auto',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const airlineMapping: Record<string, string> = {
  'IBE': 'Iberia', 'VLG': 'Vueling', 'AEA': 'Air Europa', 'RYR': 'Ryanair', 'EZY': 'easyJet',
  'BAW': 'British Airways', 'AFR': 'Air France', 'DLH': 'Lufthansa', 'KLM': 'KLM',
  'SWR': 'Swiss International Air Lines', 'AAL': 'American Airlines', 'DAL': 'Delta Air Lines',
  'UAL': 'United Airlines', 'UAE': 'Emirates', 'QTR': 'Qatar Airways', 'THY': 'Turkish Airlines',
  'SIA': 'Singapore Airlines', 'WZZ': 'Wizz Air', 'EJU': 'easyJet Europe', 'TVF': 'Transavia France',
  'TRA': 'Transavia'
};

const aircraftIcon = (isSuspect: boolean, heading: number, distanceToUser: number = Infinity, viewMode: string = 'navigation', altitude?: number, velocity?: number, callsign?: string) => {
  const isThreat = isSuspect && distanceToUser < 10000;
  const colorFilter = isThreat ? 'invert(15%) sepia(100%) saturate(700%) hue-rotate(340deg) brightness(120%) contrast(130%)' : 'none';

  let airlineName = 'Vuelo Comercial';
  if (callsign) {
    const prefix = callsign.trim().substring(0, 3).toUpperCase();
    if (airlineMapping[prefix]) airlineName = `✈️ ${airlineMapping[prefix]}`;
    else if (callsign.trim()) airlineName = `Vuelo ${callsign.trim()}`;
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
          <img src="${isSuspect ? '/avion-no-identificado.png' : '/avion-comercial.png'}" style="width: 100%; height: 100%; object-fit: contain; filter: ${colorFilter};" />
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
  'Clear': '☀️', 'Clouds': '⛅', 'Rain': '🌧️', 'Drizzle': '🌦️', 'Thunderstorm': '⛈️', 'Snow': '❄️', 'Mist': '🌫️', 'Fog': '🌫️'
};

const createWeatherIcon = (temp: number, condition: string) => {
  const emoji = weatherEmojiMap[condition] || '🌡️';
  const iconHtml = renderToStaticMarkup(
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-black/50 backdrop-blur-md border border-white/20 rounded-full shadow-[0_0_15px_rgba(0,0,0,0.5)] text-white font-bold counter-rotate">
       <span className="text-lg drop-shadow-md">{emoji}</span>
       <span className="text-sm drop-shadow-md">{Math.round(temp)}º</span>
    </div>
  );
  return L.divIcon({ html: iconHtml, className: 'custom-weather-icon', iconSize: [75, 36], iconAnchor: [37, 18] });
};

function MapEvents({ viewMode, onViewModeChange, onMapClick }: { viewMode?: string, onViewModeChange?: (mode: 'navigation' | 'overview') => void, onMapClick?: (lat: number, lon: number, screenX: number, screenY: number) => void }) {
  const map = useMap();
  useEffect(() => {
    const switchToOverview = () => { if (viewMode === 'navigation' && onViewModeChange) onViewModeChange('overview'); };
    const onClick = (e: L.LeafletMouseEvent) => { if (onMapClick) onMapClick(e.latlng.lat, e.latlng.lng, e.originalEvent.clientX, e.originalEvent.clientY); };
    const container = map.getContainer();
    const onWheel = () => switchToOverview();
    const onTouchStart = (e: TouchEvent) => { if (e.touches.length >= 2) switchToOverview(); };
    map.on('dragstart', switchToOverview);
    container.addEventListener('wheel', onWheel, { passive: true });
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    map.on('click', onClick);
    return () => {
      map.off('dragstart', switchToOverview); map.off('click', onClick);
      container.removeEventListener('wheel', onWheel); container.removeEventListener('touchstart', onTouchStart);
    };
  }, [map, viewMode, onViewModeChange, onMapClick]);
  return null;
}

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
   friends?: Friend[];
   chargers?: Charger[];
   gasStations?: GasStation[];
   weatherPoints?: WeatherPoint[];
   waypoints?: [number, number][];
   speed?: number;
   hasLocation?: boolean;
   viewMode?: 'navigation' | 'overview';
   onViewModeChange?: (mode: 'navigation' | 'overview') => void;
   customZoom?: number | null;
   onZoomChange?: (zoom: number) => void;
   onMapClick?: (lat: number, lon: number, screenX: number, screenY: number) => void;
   onChargerClick?: (charger: Charger) => void;
   onGasStationClick?: (station: GasStation) => void;
   onOpenGarage?: () => void;
   routeSections?: RouteSection[];
   centerOverride?: [number, number] | null;
   overviewFitTrigger?: number;
   distanceToNextInstruction?: number | null;
   isSimulating?: boolean;
}

const createCarIcon = (heading: number, color?: string) => {
  const iconHtml = renderToStaticMarkup(
    <div className="relative flex items-center justify-center h-20 w-20 group car-always-up" style={{ transform: `rotate(var(--car-rotation, ${heading}deg))` }}>
      <div className={`absolute inset-0 rounded-full blur-2xl scale-125 transition-all duration-700 ${color === 'Rojo' ? 'bg-red-500/30' : color === 'Azul' ? 'bg-blue-500/30' : color === 'Negro' ? 'bg-gray-900/40' : 'bg-blue-500/20'}`}></div>
      <img src={getCarImage(color)} className="w-full h-full object-contain drop-shadow-[0_15px_15px_rgba(0,0,0,0.8)] rotate-180" style={{ filter: getCarFilter(color) }} />
    </div>
  );
  return L.divIcon({ html: iconHtml, className: 'custom-car-icon', iconSize: [80, 80], iconAnchor: [40, 40] });
};


const createFriendIcon = (color?: string, name?: string) => {
  const iconHtml = renderToStaticMarkup(
    <div className="relative flex flex-col items-center counter-rotate">
      <div className="relative h-20 w-20">
        <div className={`absolute inset-0 rounded-full blur-2xl scale-125 ${color === 'Rojo' ? 'bg-red-500/30' : color === 'Azul' ? 'bg-blue-500/30' : 'bg-blue-500/20'}`}></div>
        <img src={getCarImage(color)} className="w-full h-full object-contain rotate-180 opacity-90" style={{ filter: getCarFilter(color) }} />
      </div>
      <div className="mt-2 px-3 py-1 bg-black/80 backdrop-blur-md border border-green-500/50 rounded-full">
         <span className="text-[10px] font-black text-white uppercase tracking-widest">{name}</span>
      </div>
    </div>
  );
  return L.divIcon({ html: iconHtml, className: 'custom-friend-icon', iconSize: [100, 130], iconAnchor: [50, 65] });
};

function lerpAngle(current: number, target: number, alpha: number): number {
  let diff = ((target - current) % 360 + 540) % 360 - 180;
  return current + diff * alpha;
}

function MapRotator({ heading, viewMode, speed = 0 }: { heading: number, viewMode: string, speed?: number }) {
  const map = useMap();
  const smoothedHeadingRef = useRef<number>(heading);
  const rafRef = useRef<number | null>(null);
  const targetHeadingRef = useRef<number>(heading);

  useEffect(() => { if (speed * 3.6 >= 4) targetHeadingRef.current = heading; }, [heading, speed]);

  useEffect(() => {
    const container = map.getContainer();
    const shouldRotate = viewMode === 'navigation';
    const animate = () => {
      if (!shouldRotate) {
        smoothedHeadingRef.current = lerpAngle(smoothedHeadingRef.current, 0, 0.04);
        if (Math.abs(smoothedHeadingRef.current) > 0.1) {
          container.style.transform = `rotate(${-smoothedHeadingRef.current}deg) scale(1.42)`;
          container.style.setProperty('--map-heading', `${smoothedHeadingRef.current}deg`);
          container.style.setProperty('--car-rotation', `${smoothedHeadingRef.current}deg`);
          rafRef.current = requestAnimationFrame(animate);
        } else {
          container.style.transform = 'none';
          container.style.setProperty('--map-heading', '0deg');
          container.style.removeProperty('--car-rotation');
        }

        return;
      }
      smoothedHeadingRef.current = lerpAngle(smoothedHeadingRef.current, targetHeadingRef.current, 0.04);
      container.style.transform = `rotate(${-smoothedHeadingRef.current}deg) scale(1.42)`;
      container.style.setProperty('--map-heading', `${smoothedHeadingRef.current}deg`);
      container.style.setProperty('--car-rotation', `${smoothedHeadingRef.current}deg`);
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [map, viewMode]);
  return null;
}

function LocationTracker({ 
  position, viewMode, hasRoute, speed = 0, routeCoordinates, customZoom, hasLocation, centerOverride,
  overviewFitTrigger, radars, aircrafts, chargers, gasStations, weatherPoints, friends, distanceToNextInstruction,
  isSimulating
}: { 
  position: [number, number], viewMode: string, hasRoute: boolean, speed?: number, 
  routeCoordinates?: [number, number][], customZoom?: number | null, hasLocation?: boolean, 
  centerOverride?: [number, number] | null,
  overviewFitTrigger?: number, radars?: Radar[], aircrafts?: Aircraft[], chargers?: Charger[],
  gasStations?: GasStation[], weatherPoints?: WeatherPoint[], friends?: Friend[],
  distanceToNextInstruction?: number | null,
  isSimulating?: boolean
}) {
  const map = useMap();
  const lastFitTriggerRef = useRef<number>(-1);
  const firstLocationReceivedRef = useRef(false);
  const currentZoomRef = useRef<number>(15);
  const targetZoomRef = useRef<number>(15);

  useEffect(() => { if (centerOverride) map.flyTo(centerOverride, 16, { animate: true, duration: 2 }); }, [centerOverride, map]);

  useEffect(() => {
    if (viewMode === 'overview' && hasLocation && !firstLocationReceivedRef.current && !hasRoute) {
      firstLocationReceivedRef.current = true;
      map.setView(position, 14, { animate: true, duration: 1.5 });
    }
  }, [hasLocation, viewMode, position, hasRoute, map]);

  useEffect(() => {
    if (viewMode !== 'overview') return;
    if (overviewFitTrigger === undefined || lastFitTriggerRef.current === overviewFitTrigger) return;
    lastFitTriggerRef.current = overviewFitTrigger;
    const allPoints: [number, number][] = [[position[0], position[1]]];
    if (hasRoute && routeCoordinates) allPoints.push(...routeCoordinates);
    if (radars) radars.forEach(r => allPoints.push([r.lat, r.lon]));
    if (aircrafts) aircrafts.forEach(a => allPoints.push([a.lat, a.lon]));
    if (chargers) chargers.forEach(c => allPoints.push([c.lat, c.lon]));
    if (gasStations) gasStations.forEach(g => allPoints.push([g.lat, g.lon]));
    if (weatherPoints) weatherPoints.forEach(w => allPoints.push([w.lat, w.lon]));
    if (friends) friends.forEach(f => { if(f.last_lat && f.last_lon) allPoints.push([f.last_lat, f.last_lon]) });
    try {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [100, 100], animate: true, maxZoom: 16, duration: 1.5 });
    } catch (e) {
      map.setView(position, 13, { animate: true, duration: 1.5 });
    }
  }, [viewMode, overviewFitTrigger, routeCoordinates, hasRoute, map, position, radars, aircrafts, chargers, gasStations, weatherPoints, friends]);

  useEffect(() => {
    if (viewMode !== 'navigation') return;
    
    const speedKmh = speed;
    let newTargetZoom: number;

    if (customZoom != null) {
      newTargetZoom = customZoom;
    } else {
      if (speedKmh < 45) newTargetZoom = 20; 
      else if (speedKmh < 75) newTargetZoom = 18.5;
      else if (speedKmh < 105) newTargetZoom = 17;
      else newTargetZoom = 16;

      if (hasRoute && typeof distanceToNextInstruction === 'number' && distanceToNextInstruction < 350) {
        newTargetZoom = Math.max(newTargetZoom, 19.5);
      }
    }

    const zoomDiff = Math.abs(newTargetZoom - currentZoomRef.current);
    const shouldAnimateZoom = zoomDiff > 0.2;

    if (shouldAnimateZoom) {
      targetZoomRef.current = newTargetZoom;
      currentZoomRef.current = newTargetZoom;
      map.setView(position, newTargetZoom, { 
        animate: !isSimulating, // Desactivamos animaciones Leaflet si estamos simulando para evitar jitter
        duration: isSimulating ? 0 : 2, 
        easeLinearity: 0.1 
      });
    } else {
      map.setView(position, currentZoomRef.current, { 
        animate: false 
      });
    }

  }, [position, viewMode, speed, map, customZoom, hasRoute, distanceToNextInstruction, isSimulating]);

  return null;
}

export default function MapUI({ 
  userPos, heading, carColor, routeCoordinates, radars = [], aircrafts = [], chargers = [],
  gasStations = [], weatherPoints = [], waypoints = [], speed = 0, hasLocation = false,
  viewMode = 'overview', onViewModeChange, customZoom, onZoomChange, onMapClick, onChargerClick,
  onGasStationClick, onOpenGarage, routeSections = [], friends = [], centerOverride = null, 
  overviewFitTrigger = 0, distanceToNextInstruction = null, isSimulating = false
}: MapUIProps) {
  return (
    <div className="relative h-full w-full bg-gray-900 overflow-hidden">
      <style jsx global>{`
        .leaflet-container { background: #030712 !important; }
        @keyframes aircraft-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.15); } }
        .counter-rotate { transform: rotate(var(--map-heading, 0deg)); }
      `}</style>
      <MapContainer center={userPos} zoom={15} className="h-full w-full z-0" zoomControl={false}>
        <MapEvents viewMode={viewMode} onViewModeChange={onViewModeChange} onMapClick={onMapClick} />
        <MapRotator heading={heading} viewMode={viewMode} speed={speed} />
        <TileLayer attribution="&copy; Google Maps" url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" />
        <TileLayer attribution="&copy; OSM contributors &copy; CARTO" url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png" opacity={0.8} />
        <RouteFitter routeCoordinates={routeCoordinates} />
        <LocationTracker position={userPos} viewMode={viewMode} hasRoute={!!routeCoordinates} speed={speed} routeCoordinates={routeCoordinates} customZoom={customZoom} hasLocation={hasLocation} centerOverride={centerOverride} overviewFitTrigger={overviewFitTrigger} radars={radars} aircrafts={aircrafts} chargers={chargers} gasStations={gasStations} weatherPoints={weatherPoints} friends={friends} distanceToNextInstruction={distanceToNextInstruction} isSimulating={isSimulating} />

        
        {(() => {
          if (!routeCoordinates || routeCoordinates.length === 0) return null;
          
          let currentIndex = 0;
          let currentSnappedPoint = userPos;

          if (isSimulating) {
            // En simulación, el index se puede aproximar mejor pero para la linea azul
            // simplemente buscamos el punto más cercano para "comerse" la línea
            const snapped = findClosestPointOnPolyline(userPos, routeCoordinates);
            currentIndex = snapped.segmentIndex;
            currentSnappedPoint = userPos; 
          } else {
            const snapped = findClosestPointOnPolyline(userPos, routeCoordinates);
            currentIndex = snapped.segmentIndex;
            if (snapped.distance < 30) currentSnappedPoint = snapped.point;
          }

          const remainingCoords = routeCoordinates.slice(currentIndex);
          if (remainingCoords.length > 0) remainingCoords[0] = currentSnappedPoint;

          const polylines = [];
          let lastIndex = currentIndex;
          const sortedSections = [...routeSections].sort((a, b) => a.start - b.start);
          sortedSections.forEach((section) => {
            if (section.end <= currentIndex) return;
            const startIdx = Math.max(lastIndex, section.start);
            if (startIdx > lastIndex) polylines.push({ coords: routeCoordinates.slice(lastIndex, startIdx + 1), color: '#3b82f6' });
            const endIdx = section.end;
            polylines.push({ coords: routeCoordinates.slice(startIdx, endIdx + 1), color: section.color });
            lastIndex = endIdx;
          });
          if (lastIndex < routeCoordinates.length - 1) polylines.push({ coords: routeCoordinates.slice(lastIndex), color: '#3b82f6' });
          return (
            <>
              {polylines.map((p, i) => (
                <Polyline key={`route-seg-${i}`} positions={p.coords} pathOptions={{ color: p.color, weight: 8, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }} />
              ))}
              {waypoints.map((wp, i) => <Marker key={`waypoint-${i}`} position={wp} icon={endMarkerIcon} />)}
              <Marker position={routeCoordinates[routeCoordinates.length - 1]} icon={endMarkerIcon} />
            </>
          );
        })()}

        {radars.map((radar) => <Marker key={`radar-${radar.id}`} position={[radar.lat, radar.lon]} icon={radarIcon(radar.speedLimit)} interactive={false} />)}
        {aircrafts.map((aircraft) => (
          <Marker key={`ac-${aircraft.icao24}`} position={[aircraft.lat, aircraft.lon]} icon={aircraftIcon(aircraft.isSuspect, aircraft.track, aircraft.distanceToUser, viewMode, aircraft.altitude, aircraft.velocity, aircraft.callsign)}>
            <Popup className="tesla-popup">
              <div className="p-2 text-gray-900">
                <p className={`font-bold text-lg ${aircraft.isSuspect ? 'text-blue-500' : 'text-gray-400'} mb-1`}>{aircraft.isSuspect ? 'AERONAVE' : 'VUELO CIVIL'}</p>
                <p className="text-sm">Altitud: <b>{Math.round(aircraft.altitude || 0)}m</b></p>
                <p className="text-sm">Llamada: <b>{aircraft.callsign}</b></p>
                <p className="text-sm">Velocidad: <b>{Math.round(aircraft.velocity * 3.6)} km/h</b></p>
              </div>
            </Popup>
          </Marker>
        ))}
        {chargers.map(charger => <Marker key={`charger-${charger.id}`} position={[charger.lat, charger.lon]} icon={chargerIcon} eventHandlers={{ click: () => { if (onChargerClick) onChargerClick(charger); } }} />)}
        {gasStations.map(station => <Marker key={`gas-${station.id}`} position={[station.lat, station.lon]} icon={gasStationIcon} eventHandlers={{ click: () => { if (onGasStationClick) onGasStationClick(station); } }} />)}
        {weatherPoints.map(wp => <Marker key={`weather-${wp.id}`} position={[wp.lat, wp.lon]} icon={createWeatherIcon(wp.temp, wp.condition)} interactive={false} />)}
        {friends.filter(f => f.is_sharing_location && f.last_lat && f.last_lon).map((friend) => <Marker key={`friend-${friend.id}`} position={[friend.last_lat!, friend.last_lon!]} icon={createFriendIcon(friend.car_color, friend.car_name)} zIndexOffset={800} />)}

        {(() => {
          let pos = userPos;
          let carHeading = heading;
          if (viewMode === 'navigation' && !isSimulating) {
            if (routeCoordinates && routeCoordinates.length > 0) {
              const snapped = findClosestPointOnPolyline(userPos, routeCoordinates);
              if (snapped.distance < 30) {
                pos = snapped.point;
                const p1 = routeCoordinates[snapped.segmentIndex];
                const p2 = routeCoordinates[snapped.segmentIndex + 1];
                if (p1 && p2) carHeading = getBearing(p1, p2);
              }
            } else carHeading = 0;
          }
          return <Marker key="user-car-marker" position={pos} icon={createCarIcon(carHeading, carColor)} zIndexOffset={1000} interactive={true} eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e as any); if (onOpenGarage) onOpenGarage(); }, mousedown: (e) => { L.DomEvent.stopPropagation(e as any); if (onOpenGarage) onOpenGarage(); } }} />;
        })()}
      </MapContainer>
    </div>
  );
}

