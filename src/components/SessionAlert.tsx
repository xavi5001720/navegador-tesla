'use client';

import { ShieldAlert, LogOut, Check, X } from 'lucide-react';

interface SessionAlertProps {
  mode?: 'kickout' | 'warning';
  onConfirm?: () => void;
  onCancel?: () => void;
  onClose?: () => void;
}

export default function SessionAlert({ 
  mode = 'kickout', 
  onConfirm, 
  onCancel, 
  onClose 
}: SessionAlertProps) {
  const isWarning = mode === 'warning';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-500 p-4">
      <div className="bg-gray-900 border border-white/10 rounded-[32px] p-8 md:p-10 max-w-md w-full shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col items-center text-center animate-in zoom-in-95 duration-500">
        
        {/* Icono de Alerta de Seguridad */}
        <div className={`h-24 w-24 rounded-full flex items-center justify-center mb-8 shadow-lg ${
          isWarning ? 'bg-amber-500/10 border-2 border-amber-500/20' : 'bg-rose-500/10 border-2 border-rose-500/20'
        }`}>
           <ShieldAlert className={`h-12 w-12 ${isWarning ? 'text-amber-500' : 'text-rose-500'} animate-pulse`} />
        </div>

        <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter mb-4 leading-tight italic">
          {isWarning ? 'Sesión Activa Detectada' : 'Sesión Duplicada'}
        </h1>
        
        <p className="text-gray-400 text-base md:text-lg font-medium mb-8 leading-relaxed">
          {isWarning 
            ? 'Detectamos que ya tienes una sesión iniciada en otro dispositivo. ¿Deseas cerrar la sesión anterior y continuar aquí?'
            : 'Has iniciado sesión en otro dispositivo. Por razones de seguridad, tu sesión en este terminal ha sido cerrada.'
          }
        </p>

        <div className="flex flex-col gap-3 w-full">
          {isWarning ? (
            <>
              <button 
                onClick={onConfirm}
                className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl bg-white text-black font-black text-lg hover:bg-gray-200 active:scale-[0.98] transition-all shadow-xl"
              >
                <Check className="h-5 w-5" />
                CONTINUAR AQUÍ
              </button>
              <button 
                onClick={onCancel}
                className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-lg hover:bg-white/10 active:scale-[0.98] transition-all"
              >
                <X className="h-5 w-5" />
                CANCELAR
              </button>
            </>
          ) : (
            <button 
              onClick={onClose}
              className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl bg-white text-black font-black text-lg hover:bg-gray-200 active:scale-[0.98] transition-all shadow-xl"
            >
              <LogOut className="h-5 w-5" />
              ENTENDIDO
            </button>
          )}
        </div>

        <div className="mt-8 pt-8 border-t border-white/5 w-full">
           <span className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.3em]">
             Seguridad del Perfil • Tesla OS
           </span>
        </div>
      </div>
    </div>
  );
}
