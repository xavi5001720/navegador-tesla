'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Camera, Map as MapIcon } from 'lucide-react'; 
import { renderToStaticMarkup } from 'react-dom/server';
import { Radar, RadarZone } from '@/hooks/useRadars';
import { Aircraft } from '@/hooks/usePegasus';
import { Charger } from '@/hooks/useChargers';
import { GasStation } from '@/hooks/useGasStations';
import { Friend } from '@/hooks/useSocial';
import { YachtPosition } from '@/hooks/useLuxuryYachts';
import { RouteSection } from '@/hooks/useRoute';
import { WeatherPoint } from '@/hooks/useWeather';
import { Ruler, Radio, Check, Trash2 } from 'lucide-react'; 
import { motion, AnimatePresence } from 'framer-motion';

import { getCarFilter, getCarImage } from '@/utils/carStyles';
import { getDistance, getBearing, findClosestPointOnPolyline } from '@/utils/geo';

const endMarkerIcon = L.divIcon({
   html: renderToStaticMarkup(
     <div className="h-6 w-6 rounded-full bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,1)] border-4 border-white transform -translate-x-1/2 -translate-y-1/2"></div>
   ),
   className: 'custom-end-icon',
   iconSize: [24, 24],
   iconAnchor: [12, 12],
});

const radarIcon = (type: string = 'fixed', speedLimit?: number) => L.divIcon({
  html: renderToStaticMarkup(
    <div className="relative h-10 w-10 flex flex-col items-center counter-rotate">
      <div className={`h-8 w-8 flex items-center justify-center rounded-full border-2 border-white shadow-lg animate-pulse z-10 ${
        type === 'section' ? 'bg-orange-600' : (type === 'camera' ? 'bg-blue-600' : 'bg-rose-600')
      }`}>
         {type === 'section' ? <Ruler className="h-4 w-4 text-white" /> : 
          (type === 'camera' ? <Radio className="h-4 w-4 text-white" /> : <Camera className="h-4 w-4 text-white" />)}
      </div>
      {speedLimit && (
        <div className={`absolute -bottom-1 bg-white border-2 rounded-full h-5 w-5 flex items-center justify-center shadow-md z-20 ${
          type === 'section' ? 'border-orange-600' : (type === 'camera' ? 'border-blue-600' : 'border-rose-600')
        }`}>
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

const TESLA_SHIPS_MMSI = ['366102000', '311001353', '440245000', '311000321', '636023991', '259805000', '636025798'];

// Cache global para iconos de barcos para evitar renderToStaticMarkup masivo
const yachtIconCache = new Map<string, L.DivIcon>();

const yachtIcon = (heading: number, mmsi?: string) => {
  const isTeslaShip = mmsi && TESLA_SHIPS_MMSI.includes(mmsi);
  
  // Normalizamos el heading para mejorar el hit-rate del cache
  // Un barco no cambia visualmente mucho cada 2 grados
  const roundedHeading = Math.round(heading / 2) * 2;
  const cacheKey = `${isTeslaShip ? 'tesla' : 'yacht'}-${roundedHeading}`;
  
  if (yachtIconCache.has(cacheKey)) {
    return yachtIconCache.get(cacheKey)!;
  }

  const icon = L.divIcon({
    html: renderToStaticMarkup(
      <div className="yacht-icon-container" style={{ transform: `rotate(${roundedHeading - 45}deg)` }}>
        <div className="absolute inset-0 rounded-full bg-blue-400/10 blur-2xl scale-150 animate-pulse"></div>
        <img 
          src={isTeslaShip ? "/barcotesla.png" : "/yacht-icon.png"} 
          alt="Y" 
          className="h-10 w-10 object-contain drop-shadow-[0_5px_20px_rgba(0,0,0,0.8)]" 
        />
      </div>
    ),
    className: 'custom-yacht-icon',
    iconSize: [64, 64],
    iconAnchor: [32, 32],
  });

  yachtIconCache.set(cacheKey, icon);
  return icon;
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
   yachts?: YachtPosition[];
   speed?: number;
   hasLocation?: boolean;
   viewMode?: 'navigation' | 'overview';
   onViewModeChange?: (mode: 'navigation' | 'overview') => void;
   customZoom?: number | null;
   onZoomChange?: (zoom: number) => void;
   onMapClick?: (lat: number, lon: number, screenX: number, screenY: number) => void;
   onChargerClick?: (charger: Charger) => void;
   onGasStationClick?: (station: GasStation) => void;
   onYachtClick?: (yacht: YachtPosition) => void;
   onOpenGarage?: () => void;
   onCurrentZoomChange?: (zoom: number) => void;
   routeSections?: RouteSection[];
   radarZones?: RadarZone[];
   centerOverride?: [number, number] | null;
   overviewFitTrigger?: number;
   distanceToNextInstruction?: number | null;
   isSimulating?: boolean;
   mapMode?: 'satellite' | 'light';
   onMapError?: () => void;
   followingFriendId?: string | null;
   onUpdateFriendNickname?: (friendId: string, nickname: string) => void;
   userId?: string;
   reportRadar?: (lat: number, lon: number, userId: string) => Promise<any>;
   voteRadar?: (radarId: string, userId: string, type: 'confirm' | 'reject') => Promise<void>;
   isReporting?: boolean;
   cooldownRemaining?: number;
}

const getCarIcon = (heading: number, color?: string, viewMode: string = 'navigation') => {
  // Round heading to nearest 5° to keep cache hit rates high without sacrificing accuracy
  const roundedHeading = Math.round(heading / 5) * 5;
  const key = `car-${color}-${roundedHeading}-${viewMode}`;
  if (iconCache.has(key)) return iconCache.get(key)!;

  // In navigation mode the map container rotates so we use a CSS variable to counter-rotate the car.
  const rotationStyle = viewMode === 'navigation'
    ? `rotate(var(--car-rotation, ${roundedHeading}deg))`
    : `rotate(${roundedHeading}deg)`;

  const iconHtml = renderToStaticMarkup(
    <div className="relative flex items-center justify-center h-20 w-20 group car-always-up" style={{ transform: rotationStyle }}>
      <div className={`absolute inset-0 rounded-full blur-2xl scale-125 transition-all duration-700 ${color === 'Rojo' ? 'bg-red-500/30' : color === 'Azul' ? 'bg-blue-500/30' : color === 'Negro' ? 'bg-gray-900/40' : 'bg-blue-500/20'}`}></div>
      <img src={getCarImage(color)} className="w-full h-full object-contain drop-shadow-[0_15px_15px_rgba(0,0,0,0.8)] rotate-180" style={{ filter: getCarFilter(color) }} />
    </div>
  );
  const icon = L.divIcon({ html: iconHtml, className: 'custom-car-icon', iconSize: [80, 80], iconAnchor: [40, 40] });
  iconCache.set(key, icon);
  return icon;
};

// Sistema de Caché de Iconos para evitar parpadeo (Flickering)
const iconCache = new Map<string, L.DivIcon>();

const getFriendIcon = (color?: string, name?: string, nickname?: string, heading: number = 0) => {
  const roundedHeading = Math.round(heading / 2) * 2;
  const key = `friend-${color}-${name}-${nickname}-${roundedHeading}`;
  if (iconCache.has(key)) return iconCache.get(key)!;

  const displayName = nickname ? `${nickname} (${name})` : name;
  const iconHtml = renderToStaticMarkup(
    <div className="relative flex flex-col items-center group car-marker-social">
      <div className="mb-1 pointer-events-none">
        <span className="text-[10px] font-black text-white px-2 py-0.5 rounded-full bg-blue-600/60 border border-blue-400/40 backdrop-blur-sm shadow-lg whitespace-nowrap uppercase tracking-widest leading-none block">
          {displayName}
        </span>
      </div>
      <div className="relative h-20 w-20" style={{ transform: `rotate(${roundedHeading}deg)` }}>
        <div className={`absolute inset-0 rounded-full blur-2xl scale-125 ${color === 'Rojo' ? 'bg-red-500/30' : color === 'Azul' ? 'bg-blue-500/30' : 'bg-blue-500/20'}`}></div>
        <img src={getCarImage(color)} className="w-full h-full object-contain rotate-180 opacity-90" style={{ filter: getCarFilter(color) }} />
      </div>
    </div>
  );
  
  const icon = L.divIcon({ html: iconHtml, className: 'custom-friend-icon', iconSize: [100, 130], iconAnchor: [50, 65] });
  iconCache.set(key, icon);
  return icon;
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
    const animate = () => {
      const shouldRotateLoop = viewMode === 'navigation';
      if (!shouldRotateLoop) {
        smoothedHeadingRef.current = lerpAngle(smoothedHeadingRef.current, 0, 0.08);
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
      smoothedHeadingRef.current = lerpAngle(smoothedHeadingRef.current, targetHeadingRef.current, 0.08);
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
  isSimulating, onCurrentZoomChange, radarZones
}: { 
  position: [number, number], viewMode: string, hasRoute: boolean, speed?: number, 
  routeCoordinates?: [number, number][], customZoom?: number | null, hasLocation?: boolean, 
  centerOverride?: [number, number] | null,
  overviewFitTrigger?: number, radars?: Radar[], aircrafts?: Aircraft[], chargers?: Charger[],
  gasStations?: GasStation[], weatherPoints?: WeatherPoint[], friends?: Friend[],
  distanceToNextInstruction?: number | null, isSimulating?: boolean,
  onCurrentZoomChange?: (zoom: number) => void,
  radarZones?: RadarZone[]
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
    try {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [100, 100], animate: true, maxZoom: 16, duration: 1.5 });
    } catch (e) {
      map.setView(position, 13, { animate: true, duration: 1.5 });
    }
  }, [viewMode, overviewFitTrigger, routeCoordinates, hasRoute, map, position]);

  useEffect(() => {
    if (viewMode !== 'navigation') return;
    let newTargetZoom: number;
    if (customZoom != null) {
      newTargetZoom = customZoom;
    } else {
      if (speed < 50) newTargetZoom = 20; 
      else if (speed < 90) newTargetZoom = 18.5;
      else if (speed < 125) newTargetZoom = 17;
      else newTargetZoom = 16;
      if (hasRoute && typeof distanceToNextInstruction === 'number' && distanceToNextInstruction < 350) {
        newTargetZoom = Math.max(newTargetZoom, 19.5);
      }
    }
    const zoomDiff = Math.abs(newTargetZoom - currentZoomRef.current);
    if (zoomDiff > 0.2) {
      currentZoomRef.current = newTargetZoom;
      map.setView(position, newTargetZoom, { 
        animate: !isSimulating, 
        duration: isSimulating ? 0 : 2, 
        easeLinearity: 0.1 
      });
    } else {
      map.setView(position, currentZoomRef.current, { animate: false });
    }
  }, [position, viewMode, speed, map, customZoom, hasRoute, distanceToNextInstruction, isSimulating]);

  useEffect(() => {
    if (!map || !onCurrentZoomChange) return;
    const handleZoom = () => onCurrentZoomChange(map.getZoom());
    map.on('zoomend', handleZoom);
    map.on('moveend', handleZoom);
    handleZoom();
    return () => { map.off('zoomend', handleZoom); map.off('moveend', handleZoom); };
  }, [map, onCurrentZoomChange]);

  return null;
}

const communityRadarIcon = (isVisible: boolean, isMine: boolean) => L.divIcon({
  html: renderToStaticMarkup(
    <div className={`relative h-12 w-12 flex flex-col items-center counter-rotate transition-all duration-500 ${!isVisible && isMine ? 'opacity-60 scale-90' : 'opacity-100 scale-110'}`}>
      <div className={`h-10 w-10 flex items-center justify-center rounded-full border-2 border-white shadow-xl z-10 ${isVisible ? 'bg-blue-600' : 'bg-gray-600'}`}>
         <img src="/radarpolicia.png" alt="P" className="h-7 w-7 object-contain" />
      </div>
      {!isVisible && isMine && (
        <div className="absolute -top-1 bg-amber-500 border border-white rounded-md px-1 py-0.5 z-20 shadow-sm">
          <span className="text-[8px] font-bold text-white uppercase whitespace-nowrap">Pendiente</span>
        </div>
      )}
    </div>
  ),
  className: 'custom-community-icon',
  iconSize: [48, 48],
  iconAnchor: [24, 24],
});

export default function MapUI({ 
  userPos, heading, carColor, routeCoordinates, radars = [], aircrafts = [], chargers = [],
  gasStations = [], weatherPoints = [], waypoints = [], yachts = [], speed = 0, hasLocation = false,
  viewMode = 'overview', onViewModeChange, customZoom, onZoomChange, onMapClick, onChargerClick,
  onGasStationClick, onYachtClick, onOpenGarage, onCurrentZoomChange, routeSections = [], friends = [], 
  centerOverride = null, overviewFitTrigger = 0, distanceToNextInstruction = null, isSimulating = false,
  mapMode = 'satellite', onMapError, followingFriendId, onUpdateFriendNickname, radarZones = [],
  userId, reportRadar, voteRadar, isReporting, cooldownRemaining = 0
}: MapUIProps) {
  const [showReportSuccess, setShowReportSuccess] = useState(false);
  const [selectedCommunityRadar, setSelectedCommunityRadar] = useState<Radar | null>(null);
  const errorCountRef = useRef(0);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Pre-calculamos distancias acumuladas para lógica de trazada cinemática (GPS Real)
  const routeCumDist = useMemo(() => {
    if (!routeCoordinates || routeCoordinates.length < 2) return [];
    const dists = [0];
    let total = 0;
    for (let i = 0; i < routeCoordinates.length - 1; i++) {
       total += getDistance(routeCoordinates[i], routeCoordinates[i+1]);
       dists.push(total);
    }
    return dists;
  }, [routeCoordinates]);

  // LÓGICA DE NAVEGACIÓN PERFECCIONADA (Carril + Paralelismo)
  const { snappedPos, snappedHeading } = useMemo(() => {
    if (viewMode === 'navigation' && routeCoordinates && routeCoordinates.length > 1 && routeCumDist.length > 0) {
      const snapped = findClosestPointOnPolyline(userPos, routeCoordinates);
      // Solo nos "imantamos" si estamos a menos de 40 metros de la ruta
      if (snapped.distance < 40) {
        const p1 = routeCoordinates[snapped.segmentIndex];
        const p2 = routeCoordinates[snapped.segmentIndex + 1];
        if (p1 && p2) {
          const roadBearing = getBearing(p1, p2);
          // POSICIÓN CENTRADA: Alineado con la línea de la vía
          return { snappedPos: snapped.point, snappedHeading: roadBearing };
        }
      }
    }
    return { snappedPos: userPos, snappedHeading: heading };
  }, [viewMode, userPos, heading, routeCoordinates, routeCumDist]);

  return (
    <div ref={mapContainerRef} className="relative h-full w-full bg-gray-900 overflow-hidden">
      <style jsx global>{`
        .leaflet-container { background: #030712 !important; }
        @keyframes aircraft-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.15); } }
        .counter-rotate { transform: rotate(var(--map-heading, 0deg)); }
        .custom-yacht-icon { 
          pointer-events: auto !important; 
          cursor: pointer !important; 
          z-index: 1000 !important; 
        }
        .yacht-icon-container {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 64px;
          width: 64px;
          pointer-events: auto;
        }
      `}</style>
      <MapContainer center={userPos} zoom={15} className="h-full w-full z-0" zoomControl={false} doubleClickZoom={false}>
        <MapEvents viewMode={viewMode} onViewModeChange={onViewModeChange} onMapClick={onMapClick} />
        <MapRotator heading={snappedHeading} viewMode={viewMode} speed={speed} />
        
        {mapMode === 'satellite' ? (
          <>
            <TileLayer 
              attribution="&copy; Google Maps" 
              url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" 
              eventHandlers={{
                tileerror: () => {
                  errorCountRef.current++;
                  if (errorCountRef.current > 5 && onMapError) {
                    onMapError();
                    errorCountRef.current = 0;
                  }
                },
                tileload: () => {
                  errorCountRef.current = 0; // Reset si algo carga bien
                }
              }}
            />
            <TileLayer attribution="&copy; Google Maps" url="https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}&apistyle=s.t:3|p.v:off|s.t:4|p.v:off" />
          </>
        ) : (
          <TileLayer 
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
        )}

        <RouteFitter routeCoordinates={routeCoordinates} />
        <LocationTracker 
          position={snappedPos} 
          viewMode={viewMode} 
          hasRoute={!!routeCoordinates} 
          speed={speed} 
          routeCoordinates={routeCoordinates} 
          customZoom={customZoom} 
          hasLocation={hasLocation} 
          centerOverride={centerOverride} 
          overviewFitTrigger={overviewFitTrigger} 
          radars={radars} 
          aircrafts={aircrafts} 
          chargers={chargers} 
          gasStations={gasStations} 
          weatherPoints={weatherPoints} 
          friends={friends} 
          radarZones={radarZones}
          distanceToNextInstruction={distanceToNextInstruction} 
          isSimulating={isSimulating}
          onCurrentZoomChange={onCurrentZoomChange}
        />

        
        {(() => {
          if (!routeCoordinates || routeCoordinates.length === 0) return null;
          
          let currentIndex = 0;
          let currentSnappedPoint = userPos;

          if (isSimulating) {
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
                <Polyline 
                  key={`route-seg-${i}`} 
                  positions={p.coords} 
                  pathOptions={{ 
                    color: p.color, 
                    weight: viewMode === 'overview' ? 12 : 8,
                    opacity: 0.95, 
                    lineCap: 'round', 
                    lineJoin: 'round'
                  }} 
                />
              ))}
              {waypoints.map((wp, i) => <Marker key={`waypoint-${i}`} position={wp} icon={endMarkerIcon} />)}
              <Marker position={routeCoordinates[routeCoordinates.length - 1]} icon={endMarkerIcon} />
            </>
          );
        })()}

        {radarZones.map(zone => (
          <Circle 
            key={`zone-${zone.id}`}
            center={[zone.lat, zone.lon]}
            radius={zone.radius}
            pathOptions={{
              color: zone.confidence > 0.7 ? '#f97316' : '#94a3b8',
              fillColor: zone.confidence > 0.7 ? '#fb923c' : '#cbd5e1',
              fillOpacity: 0.2,
              weight: 2,
              dashArray: '5, 10'
            }}
          />
        ))}

        {radars.map((radar) => {
          if (radar.type === 'community_mobile') {
            return (
              <Marker 
                key={`comm-${radar.id}`} 
                position={[radar.lat, radar.lon]} 
                icon={communityRadarIcon(!!radar.is_visible, !!(userId && radar.id.toString().startsWith(userId)))}
                eventHandlers={{
                  click: () => setSelectedCommunityRadar(radar)
                }}
              />
            );
          }
          return <Marker key={`radar-${radar.id}`} position={[radar.lat, radar.lon]} icon={radarIcon(radar.type, radar.speedLimit)} interactive={false} />;
        })}

        {aircrafts.map((aircraft) => (
          <Marker 
            key={`ac-${aircraft.icao24}`} 
            position={[aircraft.lat, aircraft.lon]} 
            icon={aircraftIcon(aircraft.isSuspect, aircraft.track || 0, getDistance(userPos, [aircraft.lat, aircraft.lon]), viewMode, aircraft.altitude, aircraft.velocity, aircraft.callsign)} 
            interactive={false} 
          />
        ))}
        {chargers.map(charger => <Marker key={`charger-${charger.id}`} position={[charger.lat, charger.lon]} icon={chargerIcon} eventHandlers={{ click: () => { if (onChargerClick) onChargerClick(charger); } }} />)}
        {gasStations.map(station => <Marker key={`gas-${station.id}`} position={[station.lat, station.lon]} icon={gasStationIcon} eventHandlers={{ click: () => { if (onGasStationClick) onGasStationClick(station); } }} />)}
        {weatherPoints.map(wp => <Marker key={`weather-${wp.id}`} position={[wp.lat, wp.lon]} icon={createWeatherIcon(wp.temp, wp.condition)} interactive={false} />)}
        
        {/* Amigos (Marcadores con Posición Real) */}
        {friends.filter(f => f.is_online && f.is_sharing_location !== false).map((friend) => {
          const finalLat = friend.last_lat;
          const finalLon = friend.last_lon;
          const finalHeading = (friend.heading != null && !isNaN(friend.heading)) ? friend.heading : 0;

          if (!finalLat || !finalLon) return null;

          return (
            <Marker 
              key={`friend-${friend.id}`} 
              position={[finalLat, finalLon]} 
              icon={getFriendIcon(friend.car_color, friend.car_name, friend.nickname, finalHeading)} 
              zIndexOffset={1000}
              eventHandlers={{
                click: (e) => {
                  e.target.openPopup();
                }
              }}
            >
              <Popup className="tesla-popup" minWidth={220} offset={[0, -20]}>
                <div className="p-3 bg-black/90 backdrop-blur-2xl border border-white/10 rounded-2xl flex flex-col gap-3">
                   <div className="flex flex-col">
                     <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-tight">Contacto Social</span>
                     <span className="text-sm font-bold text-white truncate max-w-[140px]">{friend.nickname || friend.car_name}</span>
                   </div>

                   <div className="h-px bg-white/10 w-full" />

                   <div className="flex flex-col gap-1.5">
                     <button 
                       onClick={() => {
                         const newName = prompt('Introduce el apodo para este amigo:', friend.nickname || '');
                         if (newName !== null) onUpdateFriendNickname?.(friend.id, newName);
                       }}
                       className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all text-[11px] font-bold uppercase"
                     >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                        Editar nombre
                     </button>
                   </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Yates de Lujo */}
        {yachts.map((yacht) => (
          <Marker 
            key={`yacht-${yacht.mmsi}`} 
            position={[yacht.latitude, yacht.longitude]} 
            icon={yachtIcon(yacht.course || yacht.heading || 0, yacht.mmsi)}
            zIndexOffset={25000}

            interactive={true}
            eventHandlers={{
              click: (e) => {
                if (onYachtClick) onYachtClick(yacht);
              },
              mousedown: (e) => {
                // Fallback para dispositivos de escritorio donde el click puede ser interceptado
                if (onYachtClick) onYachtClick(yacht);
              }
            }}
          />
        ))}

        {(() => {
          let pos = userPos;
          let carHeading = heading;
          
          if (viewMode === 'navigation') {
            carHeading = snappedHeading;
            if (!isSimulating && routeCoordinates && routeCoordinates.length > 0) {
              const snapped = findClosestPointOnPolyline(userPos, routeCoordinates);
              if (snapped.distance < 30) {
                pos = snapped.point;
              }
            }
          }
          return <Marker key="user-car-marker" position={pos} icon={getCarIcon(carHeading, carColor, viewMode)} zIndexOffset={1000} interactive={true} eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e as any); if (onOpenGarage) onOpenGarage(); }, mousedown: (e) => { L.DomEvent.stopPropagation(e as any); if (onOpenGarage) onOpenGarage(); } }} />;
        })()}
      </MapContainer>

      {/* Botón Flotante de Reporte (Draggable) */}
      <AnimatePresence>
        <motion.div
          drag
          dragConstraints={mapContainerRef}
          dragElastic={0.1}
          dragMomentum={false}
          initial={{ x: 0, y: 0 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="absolute bottom-32 right-8 z-[1000] cursor-grab active:cursor-grabbing"
        >
          <button
            disabled={cooldownRemaining > 0 || isReporting || !userId}
            onClick={async () => {
              if (reportRadar && userId) {
                try {
                  await reportRadar(userPos[0], userPos[1], userId);
                  setShowReportSuccess(true);
                } catch (e) {
                  // Error
                }
              }
            }}
            className={`h-20 w-20 rounded-3xl flex items-center justify-center border-4 border-white shadow-2xl transition-all active:scale-95 ${
              cooldownRemaining > 0 ? 'bg-gray-600 grayscale opacity-50' : 'bg-blue-600 hover:bg-blue-500 hover:shadow-blue-500/50'
            }`}
          >
            {cooldownRemaining > 0 ? (
              <span className="text-white font-black text-xl">{Math.ceil(cooldownRemaining / 60000)}m</span>
            ) : (
              <img src="/radarpolicia.png" alt="Reportar" className="h-12 w-12 object-contain" />
            )}
          </button>
        </motion.div>
      </AnimatePresence>

      {/* Modal de Confirmación de Reporte */}
      <AnimatePresence>
        {showReportSuccess && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[1100] flex items-center justify-center p-6 pointer-events-none"
          >
            <div className="bg-black/90 backdrop-blur-2xl border-2 border-blue-500 rounded-[2.5rem] p-8 max-w-sm w-full text-center shadow-[0_0_50px_rgba(37,99,235,0.3)] pointer-events-auto">
              <div className="h-20 w-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-white shadow-lg">
                <Check className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">¡Reporte Enviado!</h3>
              <p className="text-white/70 text-sm font-medium leading-relaxed mb-8">
                Has informado de un radar móvil en este punto. Muchas gracias por ayudar a la comunidad.
              </p>
              <button
                onClick={() => setShowReportSuccess(false)}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl transition-all shadow-lg uppercase tracking-widest text-sm"
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Votación Comunitaria */}
      <AnimatePresence>
        {selectedCommunityRadar && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: 50 }}
            className="fixed inset-x-0 bottom-0 z-[1100] p-6 lg:p-12 pointer-events-none flex justify-center"
          >
            <div className="bg-black/90 backdrop-blur-2xl border-2 border-white/20 rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl pointer-events-auto">
              <div className="flex items-center gap-6 mb-8">
                <div className="h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center border-2 border-white shrink-0">
                  <img src="/radarpolicia.png" alt="P" className="h-10 w-10 object-contain" />
                </div>
                <div>
                  <h4 className="text-xl font-black text-white uppercase tracking-tighter">¿Sigue ahí el radar?</h4>
                  <p className="text-white/50 text-xs font-bold uppercase tracking-widest mt-1">
                    {selectedCommunityRadar.confirmations || 1} Confirmaciones · {selectedCommunityRadar.rejections || 0} Negativos
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={async () => {
                    if (voteRadar && userId) {
                      await voteRadar(String(selectedCommunityRadar.id), userId, 'confirm');
                      setSelectedCommunityRadar(null);
                    }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-5 rounded-3xl transition-all shadow-lg flex flex-col items-center gap-1 uppercase tracking-tighter"
                >
                  <Check className="h-6 w-6" />
                  <span>Sí, sigue ahí</span>
                </button>
                <button
                  onClick={async () => {
                    if (voteRadar && userId) {
                      await voteRadar(String(selectedCommunityRadar.id), userId, 'reject');
                      setSelectedCommunityRadar(null);
                    }
                  }}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-black py-5 rounded-3xl transition-all shadow-lg flex flex-col items-center gap-1 uppercase tracking-tighter"
                >
                  <Trash2 className="h-6 w-6" />
                  <span>No, ya no está</span>
                </button>
              </div>
              
              <button 
                onClick={() => setSelectedCommunityRadar(null)}
                className="w-full mt-4 text-white/30 hover:text-white/60 font-bold uppercase text-[10px] tracking-widest transition-colors py-2"
              >
                Ignorar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
