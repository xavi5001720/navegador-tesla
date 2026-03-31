'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Mail, Lock, LogIn, UserPlus, Chrome } from 'lucide-react';

interface AuthModalProps {
  onClose: () => void;
}

export default function AuthModal({ onClose }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignupSuccess, setIsSignupSuccess] = useState(false);

  const translateAuthError = (message: string) => {
    const msg = message.toLowerCase();
    if (msg.includes('rate limit')) return 'Se ha superado el límite de intentos. Por favor, inténtalo de nuevo en unos minutos.';
    if (msg.includes('invalid login credentials')) return 'Email o contraseña incorrectos. Revisa tus datos.';
    if (msg.includes('user already registered')) return 'Este email ya está registrado. Intenta iniciar sesión.';
    if (msg.includes('email not confirmed')) return 'Debes confirmar tu correo electrónico. Revisa tu bandeja de entrada o SPAM.';
    if (msg.includes('signup is disabled')) return 'El registro está desactivado temporalmente.';
    if (msg.includes('invalid email')) return 'Por favor, introduce una dirección de correo válida.';
    if (msg.includes('provide your email')) return 'Por favor, introduce tu email.';
    if (msg.includes('password should be at least 6 characters')) return 'La contraseña debe tener al menos 6 caracteres.';
    return message;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setIsSignupSuccess(false);

    const { data, error } = isLogin
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            emailRedirectTo: window.location.origin
          }
        });

    if (error) {
      setError(translateAuthError(error.message));
      setLoading(false);
    } else {
      if (!isLogin && data?.user && !data.session) {
        // Registro exitoso pero requiere verificación de email
        setIsSignupSuccess(true);
        setLoading(false);
      } else {
        onClose();
      }
    }
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) {
      setError(translateAuthError(error.message));
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      {/* Fondo con desenfoque */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md transition-all duration-500"
        onClick={onClose}
      />
      
      {/* Contenedor del Modal */}
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-gray-900 border border-white/10 shadow-2xl animate-in fade-in zoom-in duration-300">
        
        {/* Cabecera */}
        <div className="flex items-center justify-between p-6 pb-2">
          <h2 className="text-2xl font-black tracking-tight text-white uppercase italic">
            {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </h2>
          <button 
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 hover:bg-white/10 hover:text-white transition-all"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-sm text-rose-500 font-bold">
              {error}
            </div>
          )}

          {isSignupSuccess ? (
            <div className="flex flex-col items-center gap-6 py-8 animate-in fade-in zoom-in duration-500">
              <div className="h-20 w-20 rounded-full bg-blue-600/20 flex items-center justify-center border border-blue-500/30">
                <Mail className="h-10 w-10 text-blue-500" />
              </div>
              <div className="text-center space-y-4">
                <h3 className="text-xl font-black text-white uppercase italic">¡Revisa tu correo!</h3>
                <p className="text-sm text-gray-400 leading-relaxed max-w-[280px]">
                  Hemos enviado un enlace de confirmación a <span className="text-white font-bold">{email}</span>. 
                  Una vez confirmado, ya podrás acceder a tu cuenta.
                </p>
                <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-400 font-medium">
                  Nota: Si no lo recibes, revisa tu carpeta de <b>SPAM</b> o correo no deseado.
                </div>
              </div>
              <button
                onClick={() => { setIsLogin(true); setIsSignupSuccess(false); }}
                className="mt-4 text-xs font-black text-blue-400 hover:underline uppercase tracking-widest"
              >
                Volver al inicio de sesión
              </button>
            </div>
          ) : (
            <>
              {/* Opción de Google — Destacada estilo Tesla */}
              <button
                onClick={signInWithGoogle}
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white p-3.5 text-sm font-black text-black transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              >
                <Chrome className="h-5 w-5" />
                CONTINUAR CON GOOGLE
              </button>

              <div className="my-6 flex items-center gap-4">
                <div className="h-px flex-1 bg-white/10"></div>
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">o usa tu email</span>
                <div className="h-px flex-1 bg-white/10"></div>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="email"
                    placeholder="Email"
                    required
                    className="w-full rounded-2xl bg-gray-800 border border-white/5 p-4 pl-12 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500/50 transition-all"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="password"
                    placeholder="Contraseña"
                    required
                    className="w-full rounded-2xl bg-gray-800 border border-white/5 p-4 pl-12 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500/50 transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 p-4 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                  ) : (
                    isLogin ? <LogIn className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />
                  )}
                  {isLogin ? 'ACCEDER' : 'CREAR MI CUENTA'}
                </button>
              </form>

              <p className="mt-6 text-center text-xs text-gray-500">
                {isLogin ? '¿Aún no tienes cuenta?' : '¿Ya eres usuario?'}
                <button
                  onClick={() => setIsLogin(!isLogin)}
                  className="ml-2 font-black text-blue-400 hover:underline uppercase"
                >
                  {isLogin ? 'Regístrate aquí' : 'Inicia sesión'}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
