'use client';

import { useState } from 'react';
import { X, Users, ShieldCheck, Search, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Session } from '@supabase/supabase-js';

interface SocialModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session | null;
  onAddFriend: (email: string) => Promise<{ success?: boolean; accepted?: boolean; invited?: boolean; error?: any }>;
}

export default function SocialModal({ isOpen, onClose, session, onAddFriend }: SocialModalProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleInvite = async () => {
    if (!email || !email.includes('@')) {
        setStatus({ type: 'error', message: 'Introduce un email válido' });
        return;
    }

    setLoading(true);
    setStatus(null);
    
    const res = await onAddFriend(email.trim().toLowerCase());
    
    if (res.error) {
      setStatus({ type: 'error', message: res.error });
    } else if (res.accepted) {
      setStatus({ type: 'success', message: '¡Amigo vinculado con éxito!' });
      setEmail('');
    } else if (res.invited) {
      setStatus({ type: 'success', message: 'Invitación enviada por email a tu amigo.' });
      setEmail('');
    } else {
      setStatus({ type: 'success', message: 'Solicitud enviada. Aparecerá en tu lista.' });
      setEmail('');
    }
    
    setLoading(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg overflow-hidden rounded-[40px] bg-gray-900 border border-white/10 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-8 pb-2">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-blue-600/20 flex items-center justify-center border border-blue-500/30">
                  <Users className="h-6 w-6 text-blue-500" />
                </div>
                <h2 className="text-2xl font-black tracking-tight text-white uppercase italic">Viajar con Amigos</h2>
              </div>
              <button 
                onClick={onClose}
                className="rounded-full p-2 text-gray-400 hover:bg-white/10 hover:text-white transition-all outline-none"
              >
                <X className="h-8 w-8" />
              </button>
            </div>

            <div className="p-8 space-y-8">
              {/* Explicación */}
              <div className="space-y-3">
                <p className="text-gray-300 text-sm leading-relaxed">
                  Conéctate con otros conductores para viajar juntos. Podréis ver vuestras ubicaciones en tiempo real sobre el mapa y compartir detalles de la ruta hacia vuestro destino.
                </p>
                <div className="flex items-center gap-2 text-blue-400/60 font-bold text-[10px] uppercase tracking-widest">
                    <ShieldCheck className="h-3 w-3" />
                    Privacidad garantizada bajo demanda
                </div>
              </div>

              {/* Formulario */}
              <div className="space-y-4">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-gray-500 px-1">
                        <Search className="h-3 w-3" />
                        <span className="text-[10px] font-black uppercase tracking-widest leading-none">Invitar por Email</span>
                    </div>
                    <div className="flex gap-2">
                        <input 
                            type="email" 
                            placeholder="amigo@ejemplo.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-sm outline-none focus:border-blue-500/50 transition-all placeholder:text-gray-600"
                        />
                        <button 
                            onClick={handleInvite}
                            disabled={loading}
                            className={`bg-blue-600 px-6 rounded-2xl font-black text-xs uppercase hover:bg-blue-500 transition-all flex items-center gap-2 ${loading ? 'opacity-50' : ''}`}
                        >
                            {loading ? 'Enviando...' : <><Send className="h-4 w-4" /> Enviar</>}
                        </button>
                    </div>
                </div>

                {/* Status Feedback */}
                <AnimatePresence mode="wait">
                    {status && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className={`p-4 rounded-2xl border text-center text-xs font-bold ${status.type === 'success' ? 'bg-green-600/10 border-green-500/20 text-green-400' : 'bg-red-600/10 border-red-500/20 text-red-400'}`}
                        >
                            {status.message}
                        </motion.div>
                    )}
                </AnimatePresence>
              </div>

              {/* Info Adicional */}
              <div className="pt-4 border-t border-white/5 text-center">
                 <p className="text-[10px] text-gray-600 uppercase font-bold tracking-widest">
                    Tu email actual: <span className="text-gray-400">{session?.user?.email}</span>
                 </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
