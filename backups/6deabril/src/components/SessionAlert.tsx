'use client';

import { ShieldAlert, LogOut } from 'lucide-react';

interface SessionAlertProps {
  onClose: () => void;
}

export default function SessionAlert({ onClose }: SessionAlertProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-500">
      <div className="bg-gray-900 border border-white/10 rounded-[32px] p-10 max-w-md w-full shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col items-center text-center animate-in zoom-in-95 duration-500">
        
        {/* Icono de Alerta de Seguridad */}
        <div className="h-24 w-24 rounded-full bg-rose-500/10 border-2 border-rose-500/20 flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(244,63,94,0.1)]">
           <ShieldAlert className="h-12 w-12 text-rose-500 animate-pulse" />
        </div>

        <h1 className="text-3xl font-black text-white uppercase tracking-tighter mb-4 leading-none">
          Sesión Duplicada
        </h1>
        
        <p className="text-gray-400 text-lg font-medium mb-8 leading-relaxed">
          Has iniciado sesión en otro dispositivo. Por razones de seguridad, tu sesión en este terminal ha sido cerrada.
        </p>

        <button 
          onClick={onClose}
          className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl bg-white text-black font-black text-lg hover:bg-gray-200 active:scale-[0.98] transition-all shadow-[0_10px_20px_rgba(255,255,255,0.1)]"
        >
          <LogOut className="h-5 w-5" />
          ENTENDIDO
        </button>

        <div className="mt-8 pt-8 border-t border-white/5 w-full">
           <span className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.3em]">
             Seguridad del Perfil • Tesla OS
           </span>
        </div>
      </div>
    </div>
  );
}
