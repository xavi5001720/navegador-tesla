-- 1. Crear tabla de apodos privados (Agenda Personal)
CREATE TABLE IF NOT EXISTS public.friend_nicknames (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id)
);

-- 2. Habilitar seguridad (RLS) para que NADIE vea tus apodos
ALTER TABLE public.friend_nicknames ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios pueden gestionar sus propios apodos privados" ON public.friend_nicknames;
CREATE POLICY "Usuarios pueden gestionar sus propios apodos privados" 
  ON public.friend_nicknames FOR ALL 
  USING (auth.uid() = user_id);

-- 3. Habilitar Realtime para actualizaciones instantáneas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'friend_nicknames') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_nicknames;
  END IF;
END $$;

-- 4. Opcional: Limpiar el campo nickname antiguo de friendships (aunque no molesta)
-- ALTER TABLE public.friendships DROP COLUMN IF EXISTS nickname;
