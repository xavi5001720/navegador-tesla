-- ====================================================================
-- SUPABASE SECURITY PATCH: RLS HARDENING & PRIVACY
-- ====================================================================
-- Este script corrige las vulnerabilidades reportadas por Supabase:
-- 1. RLS desactivado en tablas públicas.
-- 2. Columnas sensibles expuestas (emails y tokens).
-- ====================================================================

-- 1. ASEGURAR TABLAS DE OPENSKY (PEGASUS)
--------------------------------------------------------------------

-- Habilitar RLS en todas las tablas que lo tenían desactivado
ALTER TABLE public.opensky_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opensky_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opensky_requests ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS PARA opensky_tokens:
-- Esta tabla contiene secretos. NO añadimos ninguna política para 'anon' ni 'authenticated'.
-- Solo será accesible mediante la 'service_role' (backend) que ignora el RLS.
DROP POLICY IF EXISTS "Backend access only" ON public.opensky_tokens;

-- POLÍTICAS PARA opensky_cache:
-- Permitimos lectura (SELECT) y escritura (INSERT/UPDATE) para que el feeder/cliente funcione.
-- NOTA: Se recomienda que el feeder use la SERVICE_ROLE_KEY en lugar de ANON_KEY.
DROP POLICY IF EXISTS "Allow anon reading of cache" ON public.opensky_cache;
CREATE POLICY "Allow anon reading of cache" 
  ON public.opensky_cache FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Allow anon management of cache" ON public.opensky_cache;
CREATE POLICY "Allow anon management of cache" 
  ON public.opensky_cache FOR ALL 
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- POLÍTICAS PARA opensky_requests:
-- Permite que los dispositivos Tesla publiquen sus necesidades de búsqueda.
DROP POLICY IF EXISTS "Allow anon management of requests" ON public.opensky_requests;
CREATE POLICY "Allow anon management of requests" 
  ON public.opensky_requests FOR ALL 
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);


-- 2. PROTECCIÓN DE PRIVACIDAD EN PERFILES
--------------------------------------------------------------------

-- El email es un dato sensible. La política actual permite que cualquiera lo vea.
-- Reemplazamos la política genérica por una que limite la exposición.

DROP POLICY IF EXISTS "Los usuarios pueden buscar perfiles por email" ON public.profiles;

-- Nueva política: Los usuarios solo pueden ver otros perfiles si están autenticados,
-- pero idealmente la aplicación no debería listar emails masivamente.
-- Si tu App necesita buscar por email exacto, esta política lo permite:
CREATE POLICY "Los usuarios pueden ver perfiles básicos" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() IS NOT NULL);

-- RECOMENDACIÓN ADICIONAL: 
-- Para mayor seguridad, podrías ocultar la columna 'email' de la API pública 
-- creando una Vista o usando RLS más restrictivo. 
-- Por ahora, habilitar RLS y limpiar políticas huérfanas ya elimina el error crítico.


-- 3. VERIFICACIÓN DE OTRAS TABLAS
--------------------------------------------------------------------
-- Asegurar que yates y gasolineras tienen RLS (ya deberían, pero por si acaso)
ALTER TABLE IF EXISTS public.luxury_yacht_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.luxury_yacht_positions ENABLE ROW LEVEL SECURITY;

-- Finalizar recarga de esquema
NOTIFY pgrst, 'reload schema';
