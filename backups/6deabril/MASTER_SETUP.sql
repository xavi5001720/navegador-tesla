-- ==========================================
-- MASTER SETUP: TABLAS DE GARAJE Y SOCIALES
-- ==========================================
-- Este script crea la tabla de perfiles, el garaje y el sistema de amigos.
-- Copia y pega TODO este contenido en el SQL Editor de Supabase y dale a "Run".

-- 1. EXTENSIONES (Opcional pero recomendado)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLA DE PERFILES (GARAJE)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  car_name TEXT DEFAULT 'Mi Tesla',
  car_type TEXT DEFAULT 'Model 3',
  car_color TEXT DEFAULT 'Blanco',
  is_sharing_location BOOLEAN DEFAULT false,
  avatar_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABLA DE AMISTADES (SOCIAL)
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'accepted', -- 'pending', 'accepted'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- 4. HABILITAR SEGURIDAD (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- 5. POLÍTICAS PARA PERFILES
DROP POLICY IF EXISTS "Perfiles: Lectura propia" ON public.profiles;
CREATE POLICY "Perfiles: Lectura propia" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Perfiles: Inserción propia" ON public.profiles;
CREATE POLICY "Perfiles: Inserción propia" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Perfiles: Actualización propia" ON public.profiles;
CREATE POLICY "Perfiles: Actualización propia" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 6. POLÍTICAS PARA AMISTADES
DROP POLICY IF EXISTS "Amigos: Lectura propia" ON public.friendships;
CREATE POLICY "Amigos: Lectura propia" ON public.friendships FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Amigos: Inserción propia" ON public.friendships;
CREATE POLICY "Amigos: Inserción propia" ON public.friendships FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 7. FUNCIÓN Y DISPARADOR PARA PERFIL AUTOMÁTICO
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, car_name, car_type, car_color)
  VALUES (NEW.id, NEW.email, 'Mi Tesla', 'Model 3', 'Blanco')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. REFRESCAR EL CACHE DE ESQUEMA (Solo por si acaso)
NOTIFY pgrst, 'reload schema';
