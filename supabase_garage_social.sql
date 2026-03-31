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

-- Habilitar RLS en amistades
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Políticas para amistades
CREATE POLICY "Usuarios pueden ver sus propias amistades" 
  ON public.friendships FOR SELECT 
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

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

-- Habilitar Realtime para estas tablas
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
