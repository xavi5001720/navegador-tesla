-- ====================================================================
-- NAVEGAPRO: INFRASTRUCTURE HARDENING (RLS)
-- Resolve: Critical security alerts in Supabase
-- Tables: spatial_ref_sys, radar_zones, community_radars
-- ====================================================================

-- 1. ACTIVAR ROW LEVEL SECURITY (RLS)
-- Esto bloquea por defecto todo acceso que no esté explícitamente permitido por una política.
ALTER TABLE IF EXISTS public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.radar_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.community_radars ENABLE ROW LEVEL SECURITY;

-- 2. POLÍTICAS PARA: spatial_ref_sys (Sistema de Referencia Espacial PostGIS)
-- Requisito: Solo lectura pública para que el mapa funcione correctamente.
DROP POLICY IF EXISTS "Public read for spatial_ref_sys" ON public.spatial_ref_sys;
CREATE POLICY "Public read for spatial_ref_sys" 
ON public.spatial_ref_sys 
FOR SELECT 
USING (true);

-- 3. POLÍTICAS PARA: radar_zones (Zonas de radares móviles OSM / Fixed Zones)
-- Requisito: Solo lectura pública. Nadie desde la app puede alterar estas zonas.
DROP POLICY IF EXISTS "Public read for radar_zones" ON public.radar_zones;
CREATE POLICY "Public read for radar_zones" 
ON public.radar_zones 
FOR SELECT 
USING (true);

-- 4. POLÍTICAS PARA: community_radars (Radares reportados por la comunidad)
-- Requisito: Lectura pública, permitir inserción (anon/auth), prohibir edición/borrado.

-- Permitir que todos vean los radares móviles reportados
DROP POLICY IF EXISTS "Public read for community_radars" ON public.community_radars;
CREATE POLICY "Public read for community_radars" 
ON public.community_radars 
FOR SELECT 
USING (true);

-- Permitir que CUALQUIER usuario (incluso con ANON_KEY) pueda reportar un radar
DROP POLICY IF EXISTS "Public insert for community_radars" ON public.community_radars;
CREATE POLICY "Public insert for community_radars" 
ON public.community_radars 
FOR INSERT 
WITH CHECK (true);

-- NOTA IMPORTANTE: Al no crear políticas de UPDATE o DELETE, el sistema RLS
-- denegará automáticamente cualquier intento de modificar o borrar registros 
-- existentes, cumpliendo con el blindaje solicitado.

-- 5. RECARGAR ESQUEMA
-- Notifica a PostgREST que el esquema ha cambiado para que las reglas se apliquen de inmediato.
NOTIFY pgrst, 'reload schema';
