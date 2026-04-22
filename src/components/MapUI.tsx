'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Camera, Map as MapIcon } from 'lucide-react'; 
import { renderToStaticMarkup } from 'react-dom/server';
import { Radar, RadarZone } from '@/hooks/useRadars';
import { useAircraftSimulator } from '@/hooks/useAircraftSimulator';
import { Aircraft } from '@/hooks/usePegasus';
import { Charger } from '@/hooks/useChargers';
import { GasStation } from '@/hooks/useGasStations';
import { Friend } from '@/hooks/useSocial';
import { YachtPosition } from '@/hooks/useLuxuryYachts';
import { RouteSection } from '@/hooks/useRoute';
import { WeatherPoint } from '@/hooks/useWeather';
import { Festival } from '@/hooks/useFestivals';
import { Restaurant } from '@/hooks/useRestaurants';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { Ruler, Radio, Check, Trash2, AlertTriangle, Construction, Package, Car, PawPrint, MapPin, Navigation, X } from 'lucide-react'; 
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
// 1. PRE-GENERACIÓN DE ICONOS ESTÁTICOS (Evita llamar a renderToStaticMarkup en cada render)
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

const festivalIcon = L.divIcon({
  html: renderToStaticMarkup(
    <div className="h-10 w-10 flex items-center justify-center rounded-full bg-amber-500 border-2 border-white shadow-[0_0_20px_rgba(245,158,11,0.8)] counter-rotate animate-bounce-slow">
       <span className="text-xl">🎭</span>
    </div>
  ),
  className: 'custom-festival-icon pointer-events-auto',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

/** Pin estándar: restaurante ya valorado por la comunidad (púrpura) */
const restaurantIcon = L.divIcon({
  html: renderToStaticMarkup(
    <div className="h-10 w-10 flex items-center justify-center rounded-full bg-gray-900 border-2 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.8)] counter-rotate animate-bounce-slow">
       <img src="/burguer.png" alt="R" className="h-6 w-6 object-contain" />
    </div>
  ),
  className: 'custom-restaurant-icon pointer-events-auto',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

/** Pin dorado: restaurante sin valorar (territorio virgen / oportunidad) */
const restaurantVirginIcon = L.divIcon({
  html: renderToStaticMarkup(
    <div className="relative h-11 w-11 flex items-center justify-center rounded-full bg-gray-900 border-2 border-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.9)] counter-rotate animate-bounce-slow">
      <img src="/burguer.png" alt="R" className="h-6 w-6 object-contain" />
      {/* Badge estrella vacía — indica 'nadie ha estado aquí aún' */}
      <span className="absolute -top-1.5 -right-1.5 text-[10px] bg-amber-400 text-gray-900 font-black rounded-full w-4 h-4 flex items-center justify-center shadow-md">★</span>
    </div>
  ),
  className: 'custom-restaurant-virgin-icon pointer-events-auto',
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

const airlineMapping: Record<string, string> = {
  'IBE': 'Iberia', 'VLG': 'Vueling', 'AEA': 'Air Europa', 'RYR': 'Ryanair', 'EZY': 'easyJet',
  'BAW': 'British Airways', 'AFR': 'Air France', 'DLH': 'Lufthansa', 'KLM': 'KLM',
  'SWR': 'Swiss International Air Lines', 'AAL': 'American Airlines', 'DAL': 'Delta Air Lines',
  'UAL': 'United Airlines', 'UAE': 'Emirates', 'QTR': 'Qatar Airways', 'THY': 'Turkish Airlines',
  'SIA': 'Singapore Airlines', 'WZZ': 'Wizz Air', 'EJU': 'easyJet Europe', 'TVF': 'Transavia France',
  'TRA': 'Transavia'
};

const aircraftIconCache = new Map<string, L.DivIcon>();

const aircraftIcon = (isSuspect: boolean, heading: number, distanceToUser: number = Infinity, viewMode: string = 'navigation', altitude?: number, velocity?: number, callsign?: string) => {
  const isThreat = isSuspect && distanceToUser < 10000;
  const colorFilter = isThreat ? 'invert(15%) sepia(100%) saturate(700%) hue-rotate(340deg) brightness(120%) contrast(130%)' : 'none';
  
  const roundedHeading = Math.round(heading / 5) * 5;
  const cacheKey = `ac-icon-${isSuspect}-${viewMode}-${roundedHeading}`;

  if (aircraftIconCache.has(cacheKey)) return aircraftIconCache.get(cacheKey)!;

  let airlineName = 'Vuelo Comercial';
  if (isSuspect) {
    if (/DGT/i.test(callsign || '')) airlineName = '⚠️ Radar DGT Pegasus';
    else if (/POLIC|GUARDIA|SAER|PESG/i.test(callsign || '')) airlineName = '⚠️ Patrulla Policial';
    else airlineName = '⚠️ Aeronave sospechosa (Baja cota)';
  } else if (callsign) {
    const prefix = callsign.trim().substring(0, 3).toUpperCase();
    if (airlineMapping[prefix]) airlineName = `✈️ ${airlineMapping[prefix]}`;
    else if (callsign.trim()) airlineName = `Vuelo ${callsign.trim()}`;
  }

  const labelHtml = (viewMode === 'overview') ? `
    <div class="absolute top-10 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none" style="min-width: 150px;">
      <div class="bg-black/80 backdrop-blur-md border border-${isSuspect ? 'amber' : 'gray'}-500/50 rounded-lg p-2 shadow-2xl text-center">
        <p class="text-[10px] font-black text-${isSuspect ? 'amber' : 'gray'}-400 uppercase tracking-tighter leading-tight whitespace-nowrap">${airlineName}</p>
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

  // Configuración visual basada en amenaza
  const iconSize = isSuspect ? 44 : 32;
  const opacity = 1; // Sólido al 100% para todos
  const finalFilter = isSuspect ? (isThreat ? colorFilter : 'sepia(100%) saturate(300%) hue-rotate(0deg)') : 'none';

  const icon = L.divIcon({
    html: `
      <div class="aircraft-animation-container" style="opacity: ${opacity};">
        <div class="aircraft-rotate-container" style="transform: rotate(${roundedHeading - 45}deg); width: ${iconSize}px; height: ${iconSize}px; ${isThreat ? 'animation: aircraft-pulse 0.8s ease-in-out infinite;' : ''}">
          <img src="${isSuspect ? '/avion-no-identificado.png' : '/avion-comercial.png'}" style="width: 100%; height: 100%; object-fit: contain; filter: ${finalFilter};" />
        </div>
        <div class="aircraft-label-container">
          ${labelHtml}
        </div>
      </div>
    `,
    className: 'custom-aircraft-icon',
    iconSize: [iconSize, iconSize],
    iconAnchor: [iconSize / 2, iconSize / 2],
  });

  aircraftIconCache.set(cacheKey, icon);
  return icon;
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

const ClosePopupButton = () => {
  const map = useMap();
  return (
    <button 
      onClick={() => map.closePopup()}
      className="mt-1 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/60 transition-all active:scale-95 border border-white/5 hover:border-white/10"
    >
      <X className="h-3 w-3" />
      <span className="text-[9px] font-black uppercase tracking-widest">Cerrar</span>
    </button>
  );
};

// El festivalIcon ya está pre-generado arriba

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
   festivals?: Festival[];
   restaurants?: Restaurant[];
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
   voteRadar?: (radarId: string, userId: string, type: 'confirm' | 'reject') => Promise<void>;
   calculateRoute: (origin: [number, number], dest: [number, number], waypoints: [number, number][], isRecalculation: boolean, isTrafficWanted: boolean) => Promise<void>;
   isTrafficWanted: boolean;
   checkCanReview?: (userId: string, fsqId?: string) => Promise<{canReview: boolean, hoursLeft: number, reason?: 'per_restaurant' | 'daily_limit'}>;
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

const communityRadarIcon = (isVisible: boolean, isMine: boolean, category: string = 'mobile_radar') => {
  let bgColor = isVisible ? 'bg-blue-600' : 'bg-gray-600';
  let Icon = null;

  switch (category) {
    case 'accident':
      bgColor = 'bg-rose-600';
      Icon = <AlertTriangle className="h-6 w-6 text-white" />;
      break;
    case 'works':
      bgColor = 'bg-orange-600';
      Icon = <Construction className="h-6 w-6 text-white" />;
      break;
    case 'object':
      bgColor = 'bg-amber-600';
      Icon = <Package className="h-6 w-6 text-white" />;
      break;
    case 'stopped_vehicle':
      bgColor = 'bg-slate-600';
      Icon = <Car className="h-6 w-6 text-white" />;
      break;
    case 'animal':
      bgColor = 'bg-emerald-600';
      Icon = <PawPrint className="h-6 w-6 text-white" />;
      break;
    default:
      Icon = <img src="/radarpolicia.png" alt="P" className="h-7 w-7 object-contain" />;
  }

  return L.divIcon({
    html: renderToStaticMarkup(
      <div className={`relative h-12 w-12 flex flex-col items-center counter-rotate transition-all duration-500 ${!isVisible && isMine ? 'opacity-60 scale-90' : 'opacity-100 scale-110'}`}>
        <div className={`h-10 w-10 flex items-center justify-center rounded-full border-2 border-white shadow-xl z-10 ${bgColor}`}>
           {Icon}
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
};

function lerpAngle(current: number, target: number, alpha: number): number {
  const diff = ((target - current) % 360 + 540) % 360 - 180;
  return current + diff * alpha;
}

// --- COMPONENTES DE MARCADORES MEMOIZADOS ---

const RadarMarker = React.memo(({ radar, userId, onSelect }: { radar: Radar, userId?: string, onSelect: (r: Radar) => void }) => {
  if (radar.type === 'community_mobile') {
    return (
      <Marker 
        position={[radar.lat, radar.lon]} 
        icon={communityRadarIcon(!!radar.is_visible, !!(userId && radar.user_id === userId), radar.category)}
        eventHandlers={{ click: () => onSelect(radar) }}
      />
    );
  }
  return <Marker position={[radar.lat, radar.lon]} icon={radarIcon(radar.type, radar.speedLimit)} interactive={false} />;
});
RadarMarker.displayName = 'RadarMarker';

const AircraftMarker = React.memo(({ aircraft, userPos, viewMode }: { aircraft: Aircraft, userPos: [number, number], viewMode: string }) => {
  const dist = getDistance(userPos, [aircraft.lat, aircraft.lon]);
  return (
    <Marker 
      position={[aircraft.lat, aircraft.lon]} 
      icon={aircraftIcon(aircraft.isSuspect, aircraft.track || 0, dist, viewMode, aircraft.altitude, aircraft.velocity, aircraft.callsign)} 
      interactive={false} 
    />
  );
});
AircraftMarker.displayName = 'AircraftMarker';

const AircraftLayer = React.memo(({ realAircrafts, userPos, viewMode }: { realAircrafts: Aircraft[], userPos: [number, number], viewMode: string }) => {
  const simulatedAircrafts = useAircraftSimulator(realAircrafts);
  
  return (
    <>
      {simulatedAircrafts.map((aircraft) => (
        <AircraftMarker 
          key={`ac-${aircraft.icao24}`} 
          aircraft={aircraft} 
          userPos={userPos} 
          viewMode={viewMode} 
        />
      ))}
    </>
  );
});
AircraftLayer.displayName = 'AircraftLayer';

const FriendMarker = React.memo(({ friend, onUpdateNickname }: { friend: Friend, onUpdateNickname?: (id: string, name: string) => void }) => {
  const finalLat = friend.last_lat;
  const finalLon = friend.last_lon;
  const finalHeading = (friend.heading != null && !isNaN(friend.heading)) ? friend.heading : 0;

  if (!finalLat || !finalLon) return null;

  return (
    <Marker 
      position={[finalLat, finalLon]} 
      icon={getFriendIcon(friend.car_color, friend.car_name, friend.nickname, finalHeading)} 
      zIndexOffset={1000}
      eventHandlers={{ click: (e) => e.target.openPopup() }}
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
                 if (newName !== null) onUpdateNickname?.(friend.id, newName);
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
});
FriendMarker.displayName = 'FriendMarker';

const FestivalMarker = React.memo(({ fest, userPos, isTrafficWanted, onCalculateRoute }: { fest: Festival, userPos: [number, number], isTrafficWanted: boolean, onCalculateRoute: any }) => (
  <Marker position={[fest.lat, fest.lon]} icon={festivalIcon}>
    <Popup className="tesla-popup" minWidth={250} closeButton={false}>
      <div className="p-4 bg-black/90 backdrop-blur-2xl border border-amber-500/30 rounded-2xl flex flex-col gap-3">
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-tight">Fiesta Tradicional</span>
            <span className="text-[10px] font-black text-white bg-amber-600 px-2 py-0.5 rounded-full shadow-lg">{fest.rating}% Rec.</span>
          </div>
          <span className="text-lg font-black text-white tracking-tight">{fest.name}</span>
          <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
            <MapPin className="h-3 w-3" />
            {fest.city}, {fest.country}
          </div>
        </div>
        <div className="h-px bg-white/10 w-full" />
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 p-2 rounded-xl">
            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Fechas:</span>
            <span className="text-[11px] text-white font-black">{fest.dates_approx}</span>
          </div>
          <p className="text-[12px] text-gray-300 leading-relaxed font-medium">{fest.description}</p>
          <div className="mt-1 p-2 bg-white/5 rounded-xl border border-white/10">
            <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest block mb-1">¿Qué la hace única?</span>
            <p className="text-[11px] text-white italic font-medium leading-snug">"{fest.unique_reason}"</p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button 
            onClick={() => {
              if (userPos[0] !== 0) onCalculateRoute(userPos, [fest.lat, fest.lon], [], false, isTrafficWanted);
            }}
            className="mt-1 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white transition-all active:scale-95 shadow-lg shadow-amber-900/20"
          >
            <Navigation className="h-4 w-4" />
            <span className="text-xs font-black uppercase tracking-widest">Ir a la fiesta</span>
          </button>
          <ClosePopupButton />
        </div>
      </div>
    </Popup>
  </Marker>
));
FestivalMarker.displayName = 'FestivalMarker';

const YachtMarker = React.memo(({ yacht, onClick }: { yacht: YachtPosition, onClick: (y: YachtPosition) => void }) => (
  <Marker 
    position={[yacht.latitude, yacht.longitude]} 
    icon={yachtIcon(yacht.course || yacht.heading || 0, yacht.mmsi)}
    zIndexOffset={25000}
    interactive={true}
    eventHandlers={{
      click: () => onClick(yacht),
      mousedown: () => onClick(yacht)
    }}
  />
));
YachtMarker.displayName = 'YachtMarker';

const ChargerMarker = React.memo(({ charger, onClick }: { charger: Charger, onClick: (c: Charger) => void }) => (
  <Marker position={[charger.lat, charger.lon]} icon={chargerIcon} eventHandlers={{ click: () => onClick(charger) }} />
));
ChargerMarker.displayName = 'ChargerMarker';

const GasStationMarker = React.memo(({ station, onClick }: { station: GasStation, onClick: (s: GasStation) => void }) => (
  <Marker position={[station.lat, station.lon]} icon={gasStationIcon} eventHandlers={{ click: () => onClick(station) }} />
));
GasStationMarker.displayName = 'GasStationMarker';

const WeatherMarker = React.memo(({ wp }: { wp: WeatherPoint }) => (
  <Marker position={[wp.lat, wp.lon]} icon={createWeatherIcon(wp.temp, wp.condition)} interactive={false} />
));
WeatherMarker.displayName = 'WeatherMarker';

const SEMANTIC_RATINGS = [
  'Terrible, a evitar',
  'Malo, solo emergencias',
  'Regular, mejorable',
  'Correcto, sin más',
  'Muy bueno, recomendable',
  'Espectacular, parada obligatoria'
];

const HybridRestaurantMarker = React.memo(({ rest, userId, checkCanReview }: { rest: Restaurant, userId?: string, checkCanReview?: (userId: string) => Promise<{canReview: boolean, hoursLeft: number}> }) => {
  const [isRating, setIsRating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [reviews, setReviews] = useState<{puntuacion: number, comentario: string | null, usuario_id: string}[]>([]);
  const [myReview, setMyReview] = useState<{puntuacion: number, comentario: string | null} | null>(null);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);

  // Format rating — null-safe
  const hasRating = rest.rating_combined !== null && rest.rating_combined !== undefined && rest.rating_combined > 0;
  const finalRating = hasRating ? rest.rating_combined!.toFixed(1) : null;
  /** true = nadie ha valorado este sitio aún — dispara el modo 'Descubridor' */
  const isVirgin = !hasRating && (rest.total_reviews ?? 0) === 0;

  // Load reviews from Supabase when popup opens
  const loadReviews = async () => {
    if (reviewsLoaded) return;
    const { data } = await supabase
      .from('resenas_tesla')
      .select('puntuacion, comentario, usuario_id')
      .eq('fsq_id', rest.id)
      .order('created_at', { ascending: false });
    if (data) {
      setReviews(data);
      if (userId) {
        const mine = data.find(r => r.usuario_id === userId);
        if (mine) {
          setMyReview({ puntuacion: mine.puntuacion, comentario: mine.comentario });
          setScore(mine.puntuacion);
          setComment(mine.comentario || '');
        }
      }
    }
    setReviewsLoaded(true);
  };

  const handleOpenRating = async () => {
    if (!userId) { setErrorMsg('Debes iniciar sesión para puntuar.'); return; }
    if (!myReview && checkCanReview) {
      const { canReview, hoursLeft, reason } = await checkCanReview(userId, rest.id);
      if (!canReview) {
        const msg = reason === 'per_restaurant'
          ? `Ya has valorado este restaurante. Podrás editar tu reseña en ${Math.ceil(hoursLeft)}h.`
          : `Has alcanzado el límite de ${5} reseñas diarias. Podrás escribir más en ${Math.ceil(hoursLeft)}h.`;
        setErrorMsg(msg);
        return;
      }
    }
    setIsRating(true);
    setIsEditing(!!myReview);
    setErrorMsg(null);
  };

  const submitRating = async () => {
    if (!userId || score === null) return;
    setIsSubmitting(true);
    // Guardamos si era virgen ANTES de escribir, para el toast de Descubridor
    const wasVirgin = isVirgin;
    try {
      const { error } = await supabase.from('resenas_tesla').upsert(
        { fsq_id: rest.id, usuario_id: userId, puntuacion: score, comentario: comment || null },
        { onConflict: 'usuario_id,fsq_id' }
      );
      if (error) throw error;
      // 🏆 Toast diferenciado: Descubridor vs. valorador estándar
      setSuccessMsg(
        wasVirgin
          ? '🏆 ¡Felicidades! Eres el Descubridor Oficial de este restaurante.'
          : '✅ ¡Reseña guardada! Gracias por contribuir a la comunidad Tesla.'
      );
      setMyReview({ puntuacion: score, comentario: comment || null });
      setIsRating(false);
      setIsEditing(false);
      setReviewsLoaded(false); // force reload
    } catch (err) {
      console.error(err);
      setErrorMsg('Error al guardar reseña.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Marker position={[rest.lat, rest.lon]} icon={isVirgin ? restaurantVirginIcon : restaurantIcon} eventHandlers={{ click: loadReviews }}>
      <Popup className="tesla-popup" minWidth={280} closeButton={false}>
        <div className="p-4 bg-black/95 backdrop-blur-3xl border border-purple-500/30 rounded-2xl flex flex-col gap-3 relative overflow-hidden">
          
          {/* Header */}
          <div className="flex flex-col">
            <div className="flex justify-between items-start mb-1">
              <span className={`text-[10px] font-black uppercase tracking-widest leading-tight ${isVirgin ? 'text-amber-400' : 'text-purple-500'}`}>
                {isVirgin ? '⭐ Territorio Inexplorado' : (rest.cuisine || 'Restaurante')}
              </span>
              {finalRating ? (
                <div className="flex items-center gap-1 bg-purple-600/20 px-2 py-0.5 rounded-full border border-purple-500/30">
                  <span className="text-yellow-400 text-xs">★</span>
                  <span className="text-xs font-black text-white">{finalRating}</span>
                  <span className="text-[9px] text-gray-400 ml-1">/5</span>
                </div>
              ) : (
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${isVirgin ? 'bg-amber-400/10 border-amber-400/30' : 'bg-white/5 border-white/10'}`}>
                  <span className="text-[10px] text-amber-400 italic font-bold">★ Primera vez</span>
                </div>
              )}
            </div>
            <span className="text-lg font-black text-white tracking-tight leading-tight">{rest.name}</span>
            {/* Sub-header: CTA virgen vs. contador normal */}
            {isVirgin ? (
              <div className="mt-1.5 p-2.5 rounded-xl bg-amber-400/10 border border-amber-400/20">
                <p className="text-[11px] text-amber-300 font-bold leading-snug">
                  🗺️ ¡Territorio inexplorado! Sé el primer Tesla en conquistar este lugar y deja tu huella.
                </p>
              </div>
            ) : (
              <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase mt-1">
                <span>{reviews.length || rest.total_reviews || 0} reseñas de conductores</span>
                {rest.distanceToRoute !== undefined && <span>Desvío: {(rest.distanceToRoute / 1000).toFixed(1)} km</span>}
              </div>
            )}
          </div>

          <div className="h-px bg-white/10 w-full" />

          {/* Community Reviews List */}
          {!isRating && reviews.filter(r => r.comentario).length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Reseñas de Conductores</span>
              <div className="max-h-28 overflow-y-auto flex flex-col gap-1.5 pr-1 scrollbar-thin scrollbar-thumb-purple-800/40">
                {reviews.filter(r => r.comentario).map((r, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-2 flex flex-col gap-0.5">
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-400 text-[10px]">{'★'.repeat(r.puntuacion)}{'☆'.repeat(5 - r.puntuacion)}</span>
                      <span className="text-[9px] text-purple-400 font-bold ml-auto">{SEMANTIC_RATINGS[r.puntuacion]}</span>
                    </div>
                    <span className="text-[10px] text-gray-300 leading-snug italic">"{r.comentario}"</span>
                  </div>
                ))}
              </div>
              <div className="h-px bg-white/10 w-full mt-1" />
            </div>
          )}

          {/* Main action area */}
          {!isRating && (
            <div className="flex flex-col gap-2">
              {errorMsg && <div className="text-[10px] text-rose-500 font-bold bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">{errorMsg}</div>}
              {successMsg && <div className="text-[10px] text-green-500 font-bold bg-green-500/10 p-2 rounded-lg border border-green-500/20">{successMsg}</div>}

              {myReview && !successMsg ? (
                // Already voted — show summary + edit button
                <div className="flex flex-col gap-2">
                  <div className="bg-purple-600/10 border border-purple-500/20 rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest">Tu valoración</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-black text-white">{myReview.puntuacion}</span>
                      <span className="text-[10px] text-gray-400 italic">{SEMANTIC_RATINGS[myReview.puntuacion]}</span>
                    </div>
                    {myReview.comentario && <span className="text-[10px] text-gray-300 italic">"{myReview.comentario}"</span>}
                  </div>
                  <button
                    onClick={handleOpenRating}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95"
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest">✏️ Editar mi reseña</span>
                  </button>
                </div>
              ) : (
                // Not voted yet — CTA distinto si es virgen
                <button
                  onClick={handleOpenRating}
                  className={`mt-1 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white transition-all active:scale-95 shadow-lg font-black uppercase tracking-widest text-xs ${
                    isVirgin
                      ? 'bg-amber-500 hover:bg-amber-400 shadow-amber-900/30'
                      : 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/20'
                  }`}
                >
                  {isVirgin ? '🗺️ Ser el Descubridor' : 'Puntuar y Reseñar'}
                </button>
              )}
            </div>
          )}

          {/* Rating / Edit Form */}
          {isRating && (
            <div className="flex flex-col gap-3 animate-fade-in">
              <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">{isEditing ? '✏️ Editar tu reseña' : 'Nueva Reseña'}</span>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Tu Puntuación</span>
                <div className="flex justify-between gap-1">
                  {[0,1,2,3,4,5].map(v => (
                    <button
                      key={v}
                      onClick={() => setScore(v)}
                      className={`flex-1 py-2 rounded-lg border flex flex-col items-center justify-center transition-all ${score === v ? 'bg-purple-600 border-purple-400' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                      title={SEMANTIC_RATINGS[v]}
                    >
                      <span className={`text-sm font-bold ${score === v ? 'text-white' : 'text-gray-400'}`}>{v}</span>
                    </button>
                  ))}
                </div>
                {score !== null && (
                  <span className="text-[10px] font-bold text-purple-400 mt-1 italic text-center">"{SEMANTIC_RATINGS[score]}"</span>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Comentario (Opcional)</span>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-xs text-white resize-none outline-none focus:border-purple-500 h-16"
                  placeholder="¿Qué tal la comida y el parking?"
                />
              </div>

              <div className="flex gap-2 mt-1">
                <button onClick={() => { setIsRating(false); setIsEditing(false); }} className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider transition-all">
                  Cancelar
                </button>
                <button
                  onClick={submitRating}
                  disabled={score === null || isSubmitting}
                  className={`flex-1 py-2 rounded-lg text-white text-[10px] font-bold uppercase tracking-wider transition-all ${score === null ? 'bg-gray-700 cursor-not-allowed opacity-50' : 'bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-900/40'}`}
                >
                  {isSubmitting ? 'Guardando...' : isEditing ? 'Actualizar' : 'Enviar'}
                </button>
              </div>
            </div>
          )}

          <ClosePopupButton />
        </div>
      </Popup>
    </Marker>
  );
});
HybridRestaurantMarker.displayName = 'HybridRestaurantMarker';



function MapRotator({ heading, rawHeading, viewMode, speed = 0 }: { heading: number, rawHeading: number, viewMode: string, speed?: number }) {
  const map = useMap();
  const smoothedHeadingRef = useRef<number>(heading);
  const rafRef = useRef<number | null>(null);
  const targetHeadingRef = useRef<number>(heading);

  // Actualiza el target con el heading efectivo (que ya viene corregido si el snap se ha roto)
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



export default function MapUI({ 
  userPos, heading, carColor, routeCoordinates, radars = [], aircrafts = [], chargers = [],
  gasStations = [], weatherPoints = [], waypoints = [], yachts = [], festivals = [], restaurants = [], speed = 0, hasLocation = false,
  viewMode = 'overview', onViewModeChange, customZoom, onZoomChange, onMapClick, onChargerClick,
  onGasStationClick, onYachtClick, onOpenGarage, onCurrentZoomChange, routeSections = [], friends = [],   centerOverride = null, overviewFitTrigger = 0, distanceToNextInstruction = null, isSimulating = false,
    mapMode = 'satellite', onMapError, followingFriendId, onUpdateFriendNickname, radarZones = [],
    userId, voteRadar, calculateRoute, isTrafficWanted, nextInterval = 30000, checkCanReview
}: MapUIProps) {
  const onlineUserIdsCount = (friends.filter(f => f.is_online).length);
  const [selectedCommunityRadar, setSelectedCommunityRadar] = useState<Radar | null>(null);
  const [currentZoom, setCurrentZoom] = useState(15);
  const errorCountRef = useRef(0);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // --- TELEMETRÍA DE RENDERIZADO ---
  const renderStartTime = useRef<number>(0);
  renderStartTime.current = performance.now();

  useEffect(() => {
    const duration = performance.now() - renderStartTime.current;
    if (duration > 16) { // Si tarda más de 1 frame (16ms), es una alerta de rendimiento
      logger.info('🗺️ MapUI', `Rendimiento: Renderizado pesado detectado (${duration.toFixed(2)}ms)`);
    }
  }, [userPos, radars, aircrafts, chargers, gasStations, yachts, festivals, currentZoom]);

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

  // LÓGICA DE NAVEGACIÓN PERFECCIONADA (Carril + Paralelismo + Ruptura por Desvío Angular)
  const { snappedPos, snappedHeading } = useMemo(() => {
    if (viewMode === 'navigation' && routeCoordinates && routeCoordinates.length > 1 && routeCumDist.length > 0) {
      const snapped = findClosestPointOnPolyline(userPos, routeCoordinates);
      // Condición 1: distancia física < 40m
      if (snapped.distance < 40) {
        const p1 = routeCoordinates[snapped.segmentIndex];
        const p2 = routeCoordinates[snapped.segmentIndex + 1];
        if (p1 && p2) {
          const roadBearing = getBearing(p1, p2);
          // Condición 2 (NUEVA): delta de ángulo entre el GPS real y la carretera < 35°
          // Si el conductor ha girado más de 35°, se suelta inmediatamente el snap
          const headingDelta = Math.abs(((heading - roadBearing) % 360 + 540) % 360 - 180);
          if (headingDelta < 35) {
            // POSICIÓN CENTRADA: Alineado con la línea de la vía
            return { snappedPos: snapped.point, snappedHeading: roadBearing };
          }
          // Se ha girado mucho: suelto snap pero quedo en posición GPS real con heading GPS real
        }
      }
    }
    return { snappedPos: userPos, snappedHeading: heading };
  }, [viewMode, userPos, heading, routeCoordinates, routeCumDist]);

  // Lógica de posición visual final para el marcador del coche
  const carVisualState = useMemo(() => {
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
    return { pos, carHeading };
  }, [userPos, heading, viewMode, snappedHeading, isSimulating, routeCoordinates]);

  return (
    <div ref={mapContainerRef} className="relative h-full w-full bg-gray-900 overflow-hidden">
      <style jsx global>{`
        .leaflet-container { background: #030712 !important; }
        @keyframes aircraft-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.15); } }
        .counter-rotate { transform: rotate(var(--map-heading, 0deg)); }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0) rotate(var(--map-heading, 0deg)); }
          50% { transform: translateY(-5px) rotate(var(--map-heading, 0deg)); }
        }
        .animate-bounce-slow { animation: bounce-slow 2s infinite ease-in-out; }
        .custom-yacht-icon { 
          pointer-events: auto !important; 
          cursor: pointer !important; 
          z-index: 1000 !important; 
        }
        /* 🚀 GPU Accelerated Aircraft Animation */
        .custom-aircraft-icon {
          will-change: transform;
          border: none !important;
          background: none !important;
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
        <MapRotator heading={snappedHeading} rawHeading={heading} viewMode={viewMode} speed={speed} />
        
        {mapMode === 'satellite' ? (
          <TileLayer 
            attribution="&copy; Google Maps" 
            url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" 
            crossOrigin={true}
            eventHandlers={{
              tileerror: () => {
                errorCountRef.current++;
                if (errorCountRef.current > 5 && onMapError) {
                  onMapError();
                  errorCountRef.current = 0;
                }
              },
              tileload: () => {
                errorCountRef.current = 0;
              }
            }}
          />
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
          onCurrentZoomChange={(zoom) => {
            setCurrentZoom(zoom);
            if (onCurrentZoomChange) onCurrentZoomChange(zoom);
          }}
        />

        
        {/* 🛣️ RENDERIZADO DE RUTA OPTIMIZADO (Solo se recalcula si cambiamos de segmento o hay nueva ruta) */}
        {useMemo(() => {
          if (!routeCoordinates || routeCoordinates.length === 0) return null;
          
          const snapped = findClosestPointOnPolyline(userPos, routeCoordinates);
          const currentIndex = snapped.segmentIndex;

          const polylines = [];
          let lastIndex = currentIndex;
          const sortedSections = [...routeSections].sort((a, b) => a.start - b.start);

          sortedSections.forEach((section) => {
            if (section.end <= currentIndex) return;
            const startIdx = Math.max(lastIndex, section.start);
            if (startIdx > lastIndex) {
              polylines.push({ coords: routeCoordinates.slice(lastIndex, startIdx + 1), color: '#3b82f6' });
            }
            polylines.push({ coords: routeCoordinates.slice(startIdx, section.end + 1), color: section.color });
            lastIndex = section.end;
          });

          if (lastIndex < routeCoordinates.length - 1) {
            polylines.push({ coords: routeCoordinates.slice(lastIndex), color: '#3b82f6' });
          }

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
        }, [routeCoordinates, routeSections, waypoints, viewMode, Math.floor(userPos[0] * 10000), Math.floor(userPos[1] * 10000)])}

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

        {/* 📡 RADARES: Memoizados por zoom y datos */}
        {useMemo(() => (currentZoom >= 10 || (routeCoordinates && routeCoordinates.length > 0)) && radars.map((radar) => (
          <RadarMarker key={`radar-${radar.id}`} radar={radar} userId={userId} onSelect={setSelectedCommunityRadar} />
        )), [radars.length, radars[0]?.id, currentZoom, !!routeCoordinates, userId])}

        {/* ✈️ AVIONES: Aislados en AircraftLayer para no forzar re-render de MapUI cada 1s */}
        <AircraftLayer 
          realAircrafts={aircrafts} 
          userPos={userPos} 
          viewMode={viewMode} 
        />

        {/* ⚡ CARGADORES y ⛽ GASOLINERAS: Memoizados */}
        {useMemo(() => (currentZoom >= 10 || (routeCoordinates && routeCoordinates.length > 0)) && (
          <>
            {chargers.map(charger => <ChargerMarker key={`charger-${charger.id}`} charger={charger} onClick={onChargerClick || (() => {})} />)}
            {gasStations.map(station => <GasStationMarker key={`gas-${station.id}`} station={station} onClick={onGasStationClick || (() => {})} />)}
          </>
        ), [chargers.length, gasStations.length, currentZoom, !!routeCoordinates])}

        {useMemo(() => weatherPoints.map(wp => (
          <WeatherMarker key={`weather-${wp.id}`} wp={wp} />
        )), [weatherPoints.length])}
        
        {useMemo(() => festivals.map(fest => (
          <FestivalMarker 
            key={`fest-${fest.id}`} 
            fest={fest} 
            userPos={userPos} 
            isTrafficWanted={isTrafficWanted} 
            onCalculateRoute={calculateRoute} 
          />
        )), [festivals.length, festivals[0]?.id, userPos[0].toFixed(2), isTrafficWanted])}
        
        {/* Restaurantes */}
        {useMemo(() => (restaurants || []).map(rest => (
          <HybridRestaurantMarker 
            key={`rest-${rest.id}`}
            rest={rest}
            userId={userId}
            checkCanReview={checkCanReview}
          />
        )), [(restaurants || []).length, userId, checkCanReview])}
        
        {/* Amigos (Marcadores con Posición Real) */}
        {useMemo(() => friends.filter(f => f.is_online && f.is_sharing_location !== false).map((friend) => (
          <FriendMarker 
            key={`friend-${friend.id}`} 
            friend={friend} 
            onUpdateNickname={onUpdateFriendNickname} 
          />
        )), [friends])}

        {/* Yates de Lujo */}
        {useMemo(() => yachts.map((yacht) => (
          <YachtMarker key={`yacht-${yacht.mmsi}`} yacht={yacht} onClick={onYachtClick || (() => {})} />
        )), [yachts.length, yachts[0]?.mmsi])}

        <Marker 
          key="user-car-marker" 
          position={carVisualState.pos} 
          icon={getCarIcon(carVisualState.carHeading, carColor, viewMode)} 
          zIndexOffset={1000} 
          interactive={true} 
          eventHandlers={{ 
            click: (e: L.LeafletMouseEvent) => { 
              L.DomEvent.stopPropagation(e.originalEvent); 
              if (onOpenGarage) onOpenGarage(); 
            }, 
            mousedown: (e: L.LeafletMouseEvent) => { 
              L.DomEvent.stopPropagation(e.originalEvent); 
              if (onOpenGarage) onOpenGarage(); 
            } 
          }} 
        />
      </MapContainer>

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
