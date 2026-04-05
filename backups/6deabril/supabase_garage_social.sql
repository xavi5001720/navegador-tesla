-- Actualizar tabla de perfiles con campos de vehículo y social
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS car_name TEXT DEFAULT 'Mi Tesla',
ADD COLUMN IF NOT EXISTS car_type TEXT DEFAULT 'Model 3',
ADD COLUMN IF NOT EXISTS car_color TEXT DEFAULT 'Blanco',
ADD COLUMN IF NOT EXISTS is_sharing_location BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS last_lon DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;

-- Crear tabla de amistades
CREATE TABLE IF NOT EXISTS public.friendships (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id)
);

-- Apodos y rutas sociales
ALTER TABLE public.friendships ADD COLUMN IF NOT EXISTS nickname TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_destination JSONB;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_waypoints JSONB DEFAULT '[]';

-- Tabla de invitaciones pendientes (para usuarios no registrados aún)
CREATE TABLE IF NOT EXISTS public.friend_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS en invitaciones
ALTER TABLE public.friend_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios pueden crear sus propias invitaciones" 
  ON public.friend_invitations FOR INSERT 
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Usuarios pueden ver sus invitaciones enviadas" 
  ON public.friend_invitations FOR SELECT 
  USING (auth.uid() = sender_id);

CREATE POLICY "Usuarios pueden eliminar sus invitaciones" 
  ON public.friend_invitations FOR DELETE 
  USING (auth.uid() = sender_id);

-- Habilitar RLS en amistades
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Políticas para amistades
CREATE POLICY "Usuarios pueden ver sus propias amistades" 
  ON public.friendships FOR SELECT 
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Los usuarios pueden buscar perfiles por email" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios pueden crear solicitudes de amistad" 
  ON public.friendships FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden actualizar sus amistades" 
  ON public.friendships FOR UPDATE 
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Política para ver ubicación de amigos (solo si aceptado y compartiendo)
CREATE POLICY "Ver ubicación de amigos aceptados" 
  ON public.profiles FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.friendships 
      WHERE status = 'accepted' 
      AND (
        (user_id = auth.uid() AND friend_id = public.profiles.id) OR 
        (friend_id = auth.uid() AND user_id = public.profiles.id)
      )
    )
  );

-- Habilitar Realtime para estas tablas (evitando errores si ya están configuradas)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'friendships') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'friend_invitations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_invitations;
  END IF;
END $$;

-- Función y disparador para convertir invitaciones en amistades al registrarse
CREATE OR REPLACE FUNCTION public.handle_invite_conversion() 
RETURNS TRIGGER AS $$
BEGIN
  -- Buscar si el email que se acaba de registrar tiene invitaciones pendientes
  INSERT INTO public.friendships (user_id, friend_id, status)
  SELECT sender_id, NEW.id, 'pending'
  FROM public.friend_invitations
  WHERE receiver_email = NEW.email
  ON CONFLICT (user_id, friend_id) DO NOTHING;

  -- Limpiar la invitación una vez convertida (o si ya existía la amistad)
  DELETE FROM public.friend_invitations WHERE receiver_email = NEW.email;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created_convert_invite ON public.profiles;
CREATE TRIGGER on_profile_created_convert_invite
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_invite_conversion();
