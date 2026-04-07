'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Brain, Users, Zap, Target, Car, ShieldAlert } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AboutModal({ isOpen, onClose }: AboutModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg max-h-[85vh] overflow-hidden rounded-[2.5rem] bg-black/80 backdrop-blur-3xl border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,1)]"
          >
            {/* Cabecera */}
            <div className="flex items-center justify-between p-8 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-blue-600/20 text-blue-500">
                  <Car className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-black italic tracking-tighter text-white uppercase">🚗 NavegaPRO</h2>
              </div>
              <button
                onClick={onClose}
                className="h-10 w-10 flex items-center justify-center rounded-full bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Contenido */}
            <div className="overflow-y-auto p-8 pt-2 space-y-8 custom-scrollbar mb-4">
              <div className="space-y-2">
                <p className="text-lg font-bold text-blue-400 italic">NavegaPRO es una nueva forma de conducir.</p>
                <p className="text-gray-400 text-sm leading-relaxed">
                  No es solo un navegador: es una plataforma social en tiempo real diseñada para conductores que buscan una experiencia más inteligente, más conectada y más eficiente.
                </p>
              </div>

              <div className="h-px bg-white/5" />

              {/* Secciones */}
              <div className="space-y-6">
                <AboutItem 
                  icon={<Brain className="h-5 w-5" />}
                  title="Navegación que piensa por ti"
                  description="Calcula rutas con tráfico en tiempo real y optimiza cada consulta para ofrecer máxima precisión con el mínimo consumo de datos."
                />
                
                <AboutItem 
                  icon={<Users className="h-5 w-5" />}
                  title="Conecta mientras conduces"
                  description="Comparte tu posición con amigos, coordina rutas y crea tu propia red de conducción en tiempo real."
                />

                <AboutItem 
                  icon={<ShieldAlert className="h-5 w-5" />}
                  title="Conduce con anticipación"
                  description="Recibe alertas de radares, helicópteros y condiciones meteorológicas antes de que se conviertan en un problema."
                />

                <AboutItem 
                  icon={<Zap className="h-5 w-5" />}
                  title="Todo lo que necesitas en ruta"
                  description="Encuentra cargadores, gasolineras y puntos clave con información actualizada para ahorrar tiempo y dinero."
                />

                <AboutItem 
                  icon={<Target className="h-5 w-5" />}
                  title="Diseñado para el coche"
                  description="Una interfaz premium, fluida y minimalista, pensada para integrarse de forma natural con la experiencia de conducción."
                />
              </div>

              <div className="h-px bg-white/5" />

              {/* Cierre */}
              <p className="text-center text-sm font-black italic tracking-tighter text-blue-500 uppercase py-4 drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]">
                NavegaPRO no te dice solo cómo llegar.<br />
                Te acompaña durante todo el viaje.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function AboutItem({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 text-blue-500 border border-white/10 group-hover:bg-blue-600/20 transition-all">
        {icon}
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-white tracking-wide">{title}</h3>
        <p className="text-xs text-gray-400 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
