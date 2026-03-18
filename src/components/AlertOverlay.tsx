import { AlertTriangle, MapPin } from 'lucide-react';
import { Radar } from '@/hooks/useRadars';

interface AlertOverlayProps {
  radar: Radar;
  distance: number;
}

export default function AlertOverlay({ radar, distance }: AlertOverlayProps) {
  return (
    <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[1000] w-[90%] max-w-sm">
      <div className="bg-rose-600/90 backdrop-blur-xl border-2 border-white/20 rounded-3xl p-6 shadow-2xl animate-bounce duration-1000">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-white flex items-center justify-center shadow-lg">
            <AlertTriangle className="h-8 w-8 text-rose-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-black text-white uppercase tracking-tighter">Radar Próximo</h2>
            <div className="flex items-center gap-2 mt-1">
               <MapPin className="h-4 w-4 text-white/70" />
               <span className="text-white font-bold">{Math.round(distance)} metros</span>
            </div>
          </div>
          {radar.speedLimit && (
            <div className="h-16 w-16 rounded-full border-8 border-white bg-white flex items-center justify-center">
              <span className="text-2xl font-black text-black leading-none">{radar.speedLimit}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
