import { useState, useEffect } from 'react';
import { X, Save, Car, Palette, Edit3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserProfile } from '@/hooks/useProfile';
import { getCarFilter, getCarImage } from '@/utils/carStyles';

interface GarageModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  sessionName?: string;
  isLoggedIn: boolean;
  onUpdate: (updates: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
}

const colors = [
  { name: 'Blanco', hex: '#FFFFFF', class: 'bg-white' },
  { name: 'Negro', hex: '#000000', class: 'bg-black' },
  { name: 'Gris', hex: '#808080', class: 'bg-gray-500' },
  { name: 'Azul', hex: '#0000FF', class: 'bg-blue-600' },
  { name: 'Rojo', hex: '#FF0000', class: 'bg-red-600' },
];

export default function GarageModal({ isOpen, onClose, profile, sessionName, isLoggedIn, onUpdate }: GarageModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('Blanco');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(profile?.car_name || sessionName || '');
      setColor(profile?.car_color || 'Blanco');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSave = async () => {
    console.log('--- Intentando guardar garaje ---');
    setError(null);
    setSaving(true);
    
    try {
      const result = await onUpdate({ car_name: name, car_color: color });
      setSaving(false);
      
      if (result && !result.success) {
        setError(result.error || 'Error desconocido');
      } else {
        onClose();
      }
    } catch (e: any) {
      setSaving(false);
      setError(e.message || 'Error de conexión');
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
            className="relative w-full max-w-2xl overflow-hidden rounded-[40px] bg-gray-900 border border-white/10 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-8 pb-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-blue-600/20 flex items-center justify-center border border-blue-500/30">
                  <Car className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-white uppercase italic leading-none">Mi Garaje</h2>
                  <span className="text-[10px] text-gray-500 font-bold tracking-widest uppercase mt-1 block">Sincronización v2.2</span>
                </div>
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
              <div className="relative h-64 w-full flex items-center justify-center">
                <div className="absolute inset-0 rounded-[2rem] overflow-hidden pointer-events-none">
                  <img src="/fondogarajetesla.png" alt="Taller" className="w-full h-full object-cover opacity-70 mix-blend-screen" />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-gray-900/50" />
                </div>
                <motion.div
                  key={color}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative group w-full h-full flex items-center justify-center"
                >
                  <img 
                    src={getCarImage(color)} 
                    alt="Coche Previsualización" 
                    className="h-56 w-auto object-contain drop-shadow-[0_0_50px_rgba(255,255,255,0.1)] transition-all duration-700 rotate-180"
                    style={{ filter: getCarFilter(color) }}
                  />
                  {/* Sombra de suelo con color dinámico */}
                  <div 
                    className={`absolute bottom-4 left-1/2 -translate-x-1/2 h-4 w-48 rounded-full blur-2xl opacity-40 transition-all duration-700 ${
                        color === 'Blanco' ? 'bg-white' : 
                        color === 'Negro' ? 'bg-gray-800' : 
                        color === 'Azul' ? 'bg-blue-600' : 
                        color === 'Rojo' ? 'bg-red-600' : 'bg-gray-400'}`} 
                  />
                </motion.div>
                
                <div className="absolute top-0 right-0 bg-white/5 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none">VEHÍCULO ACTUAL</span>
                  <p className="text-xl font-black text-white italic">TESLA</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                {/* Nombre */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Edit3 className="h-4 w-4" />
                    <span className="text-xs font-black uppercase tracking-widest leading-none">Nombre</span>
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

              {/* Manejo de Errores Visual */}
              <AnimatePresence>
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl"
                  >
                    <p className="text-red-500 text-sm font-bold text-center">
                      ⚠️ ERROR: {error}
                    </p>
                    <p className="text-red-400 text-[10px] text-center mt-1 uppercase font-black tracking-widest">
                      Verifica los permisos SQL en Supabase
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Botón Guardar o Mensaje de Login */}
              {isLoggedIn ? (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-3 bg-white text-black p-5 rounded-2xl font-black text-lg hover:scale-[1.02] active:scale-95 transition-all shadow-2xl disabled:opacity-50"
                >
                  {saving ? (
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                      <span>ENVIANDO...</span>
                    </div>
                  ) : (
                    <>
                      <Save className="h-6 w-6" />
                      GUARDAR CAMBIOS
                    </>
                  )}
                </button>
              ) : (
                <div className="w-full bg-blue-600/10 border border-blue-500/20 p-6 rounded-2xl text-center">
                  <p className="text-blue-400 font-black italic text-lg leading-tight uppercase tracking-tight">
                    Inicia sesión para editar tu Tesla
                  </p>
                  <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mt-2">
                    Tus cambios se guardarán en tu perfil de NavegaPRO
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
