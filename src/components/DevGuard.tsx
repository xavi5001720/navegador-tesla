'use client';

import React, { useState, useEffect } from 'react';
import { Settings, ShieldCheck, History, Send, X } from 'lucide-react';
import { useDevMode } from '@/contexts/DevModeContext';
import { motion, AnimatePresence } from 'framer-motion';

interface DevGuardProps {
  moduleId: string;
  children: React.ReactNode;
}

type ModuleStatus = 'gray' | 'green' | 'orange';

export default function DevGuard({ moduleId, children }: DevGuardProps) {
  const { isDevMode } = useDevMode();
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [status, setStatus] = useState<ModuleStatus>('gray');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isDevMode) {
      fetchStatus();
    }
  }, [isDevMode, moduleId]);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`/api/dev/git?moduleId=${encodeURIComponent(moduleId)}`);
      const data = await res.json();
      setHistory(data.history || []);
      setStatus(data.status || 'gray');
    } catch (err) {
      console.error(err);
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
      const data = await res.json();
      if (res.ok) {
        alert(data.message || '✅ Operación completada');
        setMessage('');
        await fetchStatus();
      } else {
        alert(`❌ Error: ${data.error || 'Error desconocido'}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`❌ Error de red: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isDevMode) return <>{children}</>;

  const getStatusColor = () => {
    switch (status) {
      case 'green': return 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]';
      case 'orange': return 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.4)]';
      case 'gray': 
      default: return 'bg-gray-500 shadow-[0_0_10px_rgba(107,114,128,0.4)]';
    }
  };

  return (
    <div className="relative group/dev">
      {children}
      
      {/* Botón Flotante de Configuración (Fijo en DevMode) */}
      <button 
        onClick={(e) => {
          e.stopPropagation();
          setShowModal(true);
          fetchStatus();
        }}
        className={`absolute -top-2 -right-2 z-[999] p-1.5 rounded-full text-white shadow-lg transition-all hover:scale-110 active:scale-90 ${getStatusColor()}`}
        title={`Configurar ${moduleId} - Estado: ${status}`}
      >
        <Settings className="h-3 w-3 animate-[spin_4s_linear_infinite]" />
      </button>

      {/* Modal de Gestión de Checkpoint */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gray-900 border border-white/10 rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center border border-white/10 ${getStatusColor()}`}>
                    <ShieldCheck className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-black uppercase italic tracking-tighter">Módulo Blindado</h3>
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
                      className="bg-blue-600 px-4 rounded-xl text-xs font-black uppercase hover:bg-blue-500 disabled:opacity-50 transition-all text-white"
                    >
                      {loading ? '...' : 'Guardar'}
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
