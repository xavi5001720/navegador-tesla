'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Users, QrCode, Scan, ShieldCheck, Share2, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Session } from '@supabase/supabase-js';

interface SocialModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session | null;
  onAddFriend: (friendId: string) => Promise<{ success?: boolean; accepted?: boolean; error?: any }>;
}

export default function SocialModal({ isOpen, onClose, session, onAddFriend }: SocialModalProps) {
  const [activeTab, setActiveTab] = useState<'invite' | 'scan'>('invite');
  const [scannerActive, setScannerActive] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // Detectar si es móvil para mostrar/ocultar pestaña de escaneo
    const checkMobile = () => {
      setIsMobile(window.matchMedia("(max-width: 768px)").matches || /Android|iPhone|iPad/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (activeTab === 'scan' && isOpen && !scannerRef.current) {
      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          videoConstraints: { facingMode: "environment" } 
        },
        /* verbose= */ false
      );
      
      scanner.render((decodedText) => {
        handleScan(decodedText);
        scanner.clear();
      }, (error) => {
        // Ignorar errores de escaneo continuo
      });

      scannerRef.current = scanner;
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    };
  }, [activeTab, isOpen]);

  const handleScan = async (email: string) => {
    setResult(email);
    setStatus('Vinculando...');
    const res = await onAddFriend(email.trim().toLowerCase());
    if (res.error) {
      setStatus(`Error: ${res.error}`);
    } else if (res.accepted) {
      setStatus('¡Amigo vinculado con éxito!');
    } else if ((res as any).invited) {
      setStatus('Amigo invitado. Recibirá un mail para unirse.');
    } else {
      setStatus('Solicitud enviada. Pendiente de respuesta.');
    }
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
            className="relative w-full max-w-xl overflow-hidden rounded-[40px] bg-gray-900 border border-white/10 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-8 pb-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-amber-600/20 flex items-center justify-center border border-amber-500/30">
                  <Users className="h-6 w-6 text-amber-500" />
                </div>
                <h2 className="text-3xl font-black tracking-tight text-white uppercase italic">Viajar con Amigos</h2>
              </div>
              <button 
                onClick={onClose}
                className="rounded-full p-2 text-gray-400 hover:bg-white/10 hover:text-white transition-all outline-none"
              >
                <X className="h-8 w-8" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex bg-white/5 mx-8 rounded-2xl p-1">
              <button
                onClick={() => setActiveTab('invite')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${activeTab === 'invite' ? 'bg-white text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
              >
                <QrCode className="h-4 w-4" />
                MI CÓDIGO QR
              </button>
              {isMobile && (
                <button
                  onClick={() => setActiveTab('scan')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${activeTab === 'scan' ? 'bg-white text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                  <Scan className="h-4 w-4" />
                  ESCANEAR AMIGO
                </button>
              )}
            </div>

            <div className="p-8">
              {activeTab === 'invite' ? (
                <div className="flex flex-col items-center gap-8 py-4">
                  <div className="relative p-6 bg-white rounded-3xl shadow-[0_0_50px_rgba(255,255,255,0.1)]">
                    <QRCodeSVG 
                      value={session?.user?.email || ''} 
                      size={200}
                      level="H"
                      includeMargin={false}
                    />
                    <div className="absolute -top-4 -right-4 h-12 w-12 bg-amber-500 rounded-2xl flex items-center justify-center border-4 border-gray-900">
                      <ShieldCheck className="h-6 w-6 text-white" />
                    </div>
                  </div>

                  <div className="text-center space-y-2">
                    <p className="text-sm text-gray-400">Escaneen este código para vincularse contigo</p>
                    <div className="flex items-center gap-2 justify-center bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                      <span className="text-[10px] font-black text-amber-500 uppercase">TU EMAIL</span>
                      <code className="text-xs text-white opacity-50 break-all select-all">{session?.user?.email}</code>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                        const shareUrl = `${window.location.origin}?invite=${session?.user?.email}`;
                        navigator.clipboard.writeText(shareUrl);
                        setStatus('Enlace copiado al portapapeles');
                        setTimeout(() => setStatus(null), 3000);
                    }}
                    className="flex items-center gap-2 text-white/50 hover:text-white text-sm transition-all"
                  >
                    <Share2 className="h-4 w-4" />
                    COMPARTIR ENLACE DE INVITACIÓN
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-6 py-4">
                  <div className="w-full max-w-[320px] aspect-square bg-black border-2 border-dashed border-white/20 rounded-3xl overflow-hidden flex items-center justify-center relative">
                    <div id="qr-reader" className="w-full h-full" />
                    {status && (
                      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-300">
                        <p className="text-white font-bold text-lg mb-4">{status}</p>
                        <button 
                          onClick={() => { setStatus(null); setActiveTab('invite'); setTimeout(() => setActiveTab('scan'), 100); }}
                          className="px-4 py-2 bg-white text-black font-black rounded-xl text-xs uppercase"
                        >
                          REINTENTAR ESCANEO
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-center space-y-2">
                    <p className="text-sm text-gray-400">Apunta la cámara al código QR de tu amigo</p>
                  </div>

                  <div className="w-full h-px bg-white/5 my-2" />
                  
                  {/* Mock/Manual Entry Backup */}
                  <div className="w-full space-y-4">
                    <div className="flex items-center gap-2 text-gray-500">
                      <Search className="h-3 w-3" />
                      <span className="text-[10px] font-black uppercase tracking-widest leading-none">O introduce su Email manualmente</span>
                    </div>
                    <div className="flex gap-2">
                      <input 
                        id="manual-email"
                        type="email" 
                        placeholder="Email de tu amigo"
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-amber-500/50"
                      />
                      <button 
                        onClick={() => {
                          const val = (document.getElementById('manual-email') as HTMLInputElement).value;
                          if (val) handleScan(val);
                        }}
                        className="bg-amber-600 px-4 rounded-xl font-bold text-xs uppercase hover:bg-amber-500 transition-all"
                      >
                        Añadir
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Notificación temporal interna del modal */}
              {status && activeTab === 'invite' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 bg-blue-600/20 border border-blue-500/30 p-3 rounded-xl text-center"
                >
                    <p className="text-blue-400 text-xs font-bold">{status}</p>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
