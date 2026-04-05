'use client';

interface SpeedometerProps {
  speed: number;
  zoom?: number;
}

export default function Speedometer({ speed, zoom }: SpeedometerProps) {
  return (
    <div className="flex flex-col items-center justify-center bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl min-w-[140px]">
      {zoom !== undefined && (
        <span className="text-[10px] font-black text-gray-500/80 uppercase tracking-widest mb-1 animate-pulse">
          ZOOM {zoom.toFixed(1)}
        </span>
      )}
      <span className="text-6xl font-black text-white tabular-nums tracking-tighter">
        {speed}
      </span>
      <span className="text-xs font-bold text-blue-500 uppercase tracking-widest mt-1">
        km/h
      </span>
    </div>
  );
}
