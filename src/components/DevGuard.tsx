'use client';

import React, { useState } from 'react';
import { Settings, ShieldCheck, History, Send, X } from 'lucide-react';
import { useDevMode } from '@/contexts/DevModeContext';
import { motion, AnimatePresence } from 'framer-motion';

interface DevGuardProps {
  moduleId: string;
  children: React.ReactNode;
}

export default function DevGuard({ moduleId, children }: DevGuardProps) {
  const { isDevMode } = useDevMode();
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  if (!isDevMode) return <>{children}</>;

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dev/git?moduleId=${encodeURIComponent(moduleId)}`);
      const data = await res.json();
      setHistory(data.history || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createCheckpoint = async () => {
    if (!message) return;
    setLoading(true);
    try {
      const res = await fetch('/api/dev/git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId, message })
      });
      if (res.ok) {
        setMessage('');
        fetchHistory();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative group/dev">
      {children}
      
      {/* Botón Flotante de Configuración (Solo en DevMode) */}
      <button 
        onClick={() => {
          setShowModal(true);
          fetchHistory();
        }}
        className="absolute -top-2 -right-2 z-[999] p-1.5 bg-blue-600 rounded-full text-white shadow-lg scale-0 group-hover/dev:scale-100 transition-transform hover:bg-blue-500 active:scale-90"
        title={`Configurar ${moduleId}`}
      >
        <Settings className="h-3 w-3" />
      </button>

      {/* Modal de Gestión de Checkpoint */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gray-900 border border-white/10 rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-blue-600/20 rounded-xl flex items-center justify-center border border-blue-500/30">
                    <ShieldCheck className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-black uppercase italic tracking-tighter">Checkpoint Blindado</h3>
                    <p className="text-[10px] text-blue-400/60 font-bold uppercase tracking-widest">{moduleId}</p>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Formulario de Checkpoint */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                    <Send className="h-3 w-3" /> Nuevo Checkpoint
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Ej: Fix de renderizado..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-blue-500/50"
                    />
                    <button 
                      onClick={createCheckpoint}
                      disabled={loading || !message}
                      className="bg-blue-600 px-4 rounded-xl text-xs font-black uppercase hover:bg-blue-500 disabled:opacity-50 transition-all"
                    >
                      Guardar
                    </button>
                  </div>
                </div>

                {/* Historial */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                    <History className="h-3 w-3" /> Historial Blindado
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                    {loading && history.length === 0 ? (
                      <div className="text-center py-4 text-gray-600 text-xs animate-pulse">Consultando Git...</div>
                    ) : history.length === 0 ? (
                      <div className="text-center py-4 text-gray-600 text-xs italic">Sin checkpoints previos</div>
                    ) : (
                      history.map((item, i) => (
                        <div key={i} className="p-3 bg-white/5 border border-white/5 rounded-xl flex flex-col gap-1">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-mono text-blue-400">{item.hash}</span>
                            <span className="text-[9px] text-gray-500 font-bold">{item.date}</span>
                          </div>
                          <p className="text-xs text-gray-300 font-medium">{item.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
