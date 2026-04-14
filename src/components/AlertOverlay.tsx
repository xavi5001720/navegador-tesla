import { AlertTriangle, MapPin, Ruler } from 'lucide-react';
import { Radar } from '@/hooks/useRadars';

interface AlertOverlayProps {
  radar: Radar;
  distance: number;
  alertType: 'safe' | 'danger';
  currentSpeed: number;
  inSectionRadar?: boolean;
  sectionAverageSpeed?: number | null;
}

export default function AlertOverlay({ 
  radar, distance, alertType, currentSpeed, inSectionRadar, sectionAverageSpeed 
}: AlertOverlayProps) {
  const isDanger = alertType === 'danger';
  
  return (
    <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[1000] w-[90%] max-w-sm">
      <div className={`backdrop-blur-xl border-2 rounded-3xl p-6 shadow-2xl transition-all duration-500 ${
        isDanger 
          ? 'bg-rose-600/90 border-white/40 animate-bounce' 
          : 'bg-blue-600/90 border-white/20'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`h-16 w-16 rounded-full bg-white flex items-center justify-center shadow-lg ${isDanger ? 'animate-pulse' : ''}`}>
             {inSectionRadar 
               ? <Ruler className={`h-8 w-8 ${isDanger ? 'text-rose-600' : 'text-blue-600'}`} />
               : (isDanger 
                 ? <AlertTriangle className="h-8 w-8 text-rose-600" />
                 : <MapPin className="h-8 w-8 text-blue-600" />
               )
             }
          </div>
          <div className="flex-1 text-white">
            <h2 className="text-xl font-black uppercase tracking-tighter">
              {inSectionRadar ? 'Radar de Tramo' : (isDanger ? '¡ALERTA VELOCIDAD!' : 'Radar Próximo')}
            </h2>
            {radar.road && (
              <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest -mt-1 block">
                {radar.road} {radar.pk ? `· PK ${radar.pk}` : ''}
              </span>
            )}
            <div className="flex flex-col gap-0.5 mt-1">
               <div className="flex items-center gap-2">
                 <span className="font-bold">{Math.round(distance)} metros</span>
                 <span className="opacity-60">|</span>
                 <span className="font-medium text-xs">Vas a {Math.round(currentSpeed)} km/h</span>
               </div>
               {inSectionRadar && typeof sectionAverageSpeed === 'number' && (
                 <div className="flex items-center gap-2 mt-1 px-3 py-1 bg-black/30 rounded-full w-fit border border-white/20">
                   <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">Media:</span>
                   <span className={`text-sm font-black ${sectionAverageSpeed > (radar.speedLimit || 120) ? 'text-rose-400' : 'text-emerald-400'}`}>
                     {sectionAverageSpeed} km/h
                   </span>
                 </div>
               )}
            </div>
          </div>
          {radar.speedLimit && (
            <div className={`h-16 w-16 rounded-full border-4 flex items-center justify-center bg-white ${
              isDanger ? 'border-rose-300' : 'border-blue-300'
            }`}>
              <span className="text-2xl font-black text-black leading-none">{radar.speedLimit}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
