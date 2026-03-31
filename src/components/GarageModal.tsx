'use client';

import { useState } from 'react';
import { X, Save, Car, Palette, Edit3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserProfile } from '@/hooks/useProfile';

interface GarageModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  onUpdate: (updates: Partial<UserProfile>) => Promise<boolean | undefined>;
}

const colors = [
  { name: 'Blanco', hex: '#FFFFFF', class: 'bg-white' },
  { name: 'Negro', hex: '#000000', class: 'bg-black' },
  { name: 'Gris', hex: '#808080', class: 'bg-gray-500' },
  { name: 'Azul', hex: '#0000FF', class: 'bg-blue-600' },
  { name: 'Rojo', hex: '#FF0000', class: 'bg-red-600' },
];

export default function GarageModal({ isOpen, onClose, profile, onUpdate }: GarageModalProps) {
  const [name, setName] = useState(profile?.car_name || '');
  const [color, setColor] = useState(profile?.car_color || 'Blanco');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onUpdate({ car_name: name, car_color: color });
    setSaving(false);
    onClose();
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
            className="relative w-full max-w-2xl overflow-hidden rounded-[40px] bg-gray-900 border border-white/10 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-8 pb-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-blue-600/20 flex items-center justify-center border border-blue-500/30">
                  <Car className="h-6 w-6 text-blue-500" />
                </div>
                <h2 className="text-3xl font-black tracking-tight text-white uppercase italic">Mi Garaje</h2>
              </div>
              <button 
                onClick={onClose}
                className="rounded-full p-2 text-gray-400 hover:bg-white/10 hover:text-white transition-all outline-none"
              >
                <X className="h-8 w-8" />
              </button>
            </div>

            <div className="p-8 space-y-12">
              {/* Visualización del Coche */}
              <div className="relative h-64 w-full bg-radial-gradient from-blue-500/10 to-transparent flex items-center justify-center">
                <motion.div
                  key={color}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="relative group"
                >
                  <Car className="h-48 w-48 text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]" />
                  <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 h-2 w-32 rounded-full blur-xl opacity-50 ${colors.find(c => c.name === color)?.class || 'bg-white'}`} />
                </motion.div>
                
                <div className="absolute top-0 right-0 bg-white/5 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none">VEHÍCULO ACTUAL</span>
                  <p className="text-xl font-black text-white italic">{profile?.car_type || 'Tesla Model 3'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                {/* Nombre */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Edit3 className="h-4 w-4" />
                    <span className="text-xs font-black uppercase tracking-widest leading-none">Nombre Personalizado</span>
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Halcón Milenario"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-lg font-bold focus:border-blue-500/50 outline-none transition-all"
                  />
                </div>

                {/* Color */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Palette className="h-4 w-4" />
                    <span className="text-xs font-black uppercase tracking-widest leading-none">Color de Carrocería</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {colors.map((c) => (
                      <button
                        key={c.name}
                        onClick={() => setColor(c.name)}
                        className={`h-10 w-10 rounded-full border-2 transition-all hover:scale-110 ${c.class} ${color === c.name ? 'border-blue-500 scale-125' : 'border-white/20'}`}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Botón Guardar */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-3 bg-white text-black p-5 rounded-2xl font-black text-lg hover:scale-[1.02] active:scale-95 transition-all shadow-2xl disabled:opacity-50"
              >
                {saving ? (
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                ) : (
                  <>
                    <Save className="h-6 w-6" />
                    GUARDAR CAMBIOS EN EL GARAJE
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
