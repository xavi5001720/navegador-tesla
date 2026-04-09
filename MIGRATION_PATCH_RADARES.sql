-- TABLA DE RADARES (Parche de Migración)
-- Ejecutar este archivo en el Supabase SQL Editor si los radares no aparecen.

CREATE TABLE IF NOT EXISTS public.radars (
  id BIGINT PRIMARY KEY,
  geom GEOMETRY(POINT, 4326),
  radar_type TEXT, 
  speed_limit INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.radars ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read radars" ON public.radars;
CREATE POLICY "Public read radars" ON public.radars FOR SELECT USING (true);

-- Índice espacial
CREATE INDEX IF NOT EXISTS radars_geom_idx ON public.radars USING GIST (geom);

-- Función de búsqueda espacial
CREATE OR REPLACE FUNCTION get_radars_in_radius(user_lat FLOAT, user_lon FLOAT, radius_meters FLOAT)
RETURNS TABLE (
  id BIGINT,
  radar_type TEXT,
  speed_limit INTEGER,
  dist_meters FLOAT,
  geom_text TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id, 
    r.radar_type, 
    r.speed_limit,
    ST_Distance(r.geom, ST_SetSRID(ST_Point(user_lon, user_lat), 4326)::geography) AS dist_meters,
    ST_AsText(r.geom) AS geom_text
  FROM public.radars r
  WHERE ST_DWithin(r.geom, ST_SetSRID(ST_Point(user_lon, user_lat), 4326)::geography, radius_meters)
  ORDER BY dist_meters ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
