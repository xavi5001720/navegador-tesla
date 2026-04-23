-- TABLA DE CARGADORES ELÉCTRICOS (EV)
-- Esta tabla almacena la información base para búsquedas rápidas y visualización en ruta.
-- Los datos dinámicos (disponibilidad) se consultarán vía API bajo demanda.

CREATE TABLE IF NOT EXISTS ev_chargers (
  id INTEGER PRIMARY KEY,           -- ID de OpenChargeMap (OCM)
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  geom GEOMETRY(POINT, 4326),       -- Ubicación PostGIS
  title TEXT,                       -- Nombre del punto
  address TEXT,                     -- Dirección resumida
  operator TEXT,                    -- Red de carga (Tesla, Iberdrola, Ionity...)
  usage_cost TEXT,                  -- Texto informativo del coste
  max_power NUMERIC,                -- Potencia máxima en kW (calculada)
  is_free BOOLEAN DEFAULT FALSE,    -- Flag de gratuidad (pre-calculado por el feeder)
  connections_json JSONB,           -- Datos crudos de conectores para filtros avanzados
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice GIST para consultas espaciales ultra rápidas
CREATE INDEX IF NOT EXISTS idx_ev_chargers_geom ON ev_chargers USING GIST (geom);

-- FUNCIÓN: Obtener cargadores cercanos a una posición con filtros
CREATE OR REPLACE FUNCTION get_chargers_nearby(
  p_lat DOUBLE PRECISION, 
  p_lon DOUBLE PRECISION, 
  p_radius_meters DOUBLE PRECISION DEFAULT 15000,
  p_min_power NUMERIC DEFAULT 0,
  p_only_free BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id INTEGER,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  title TEXT,
  address TEXT,
  operator TEXT,
  usage_cost TEXT,
  max_power NUMERIC,
  is_free BOOLEAN,
  connections JSONB,
  distance_meters DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id, e.lat, e.lon, e.title, e.address, e.operator, e.usage_cost, e.max_power, e.is_free, e.connections_json,
    ST_Distance(e.geom, ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography) AS distance_meters
  FROM ev_chargers e
  WHERE ST_DWithin(e.geom, ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography, p_radius_meters)
    AND (e.max_power >= p_min_power OR p_min_power IS NULL)
    AND (NOT p_only_free OR e.is_free = TRUE)
  ORDER BY distance_meters ASC
  LIMIT 150;
END;
$$ LANGUAGE plpgsql;

-- FUNCIÓN: Obtener cargadores a lo largo de una ruta con filtros
CREATE OR REPLACE FUNCTION get_chargers_in_route(
  p_route_wkt TEXT, 
  p_buffer_meters DOUBLE PRECISION DEFAULT 1000,
  p_min_power NUMERIC DEFAULT 0,
  p_only_free BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id INTEGER,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  title TEXT,
  address TEXT,
  operator TEXT,
  usage_cost TEXT,
  max_power NUMERIC,
  is_free BOOLEAN,
  connections JSONB
) AS $$
DECLARE
  route_geom GEOMETRY;
BEGIN
  route_geom := ST_GeomFromText(p_route_wkt, 4326);
  
  RETURN QUERY
  SELECT 
    e.id, e.lat, e.lon, e.title, e.address, e.operator, e.usage_cost, e.max_power, e.is_free, e.connections_json
  FROM ev_chargers e
  WHERE ST_DWithin(e.geom, route_geom::geography, p_buffer_meters)
    AND (e.max_power >= p_min_power OR p_min_power IS NULL)
    AND (NOT p_only_free OR e.is_free = TRUE)
  ORDER BY e.max_power DESC;
END;
$$ LANGUAGE plpgsql;

-- FUNCIÓN: Upsert para el Feeder (maneja la geometría automáticamente)
CREATE OR REPLACE FUNCTION upsert_ev_chargers(p_chargers JSONB)
RETURNS VOID AS $$
BEGIN
  INSERT INTO ev_chargers (
    id, lat, lon, geom, title, address, operator, usage_cost, max_power, is_free, connections_json
  )
  SELECT 
    (elem->>'id')::INTEGER,
    (elem->>'lat')::DOUBLE PRECISION,
    (elem->>'lon')::DOUBLE PRECISION,
    ST_SetSRID(ST_MakePoint((elem->>'lon')::DOUBLE PRECISION, (elem->>'lat')::DOUBLE PRECISION), 4326),
    elem->>'title',
    elem->>'address',
    elem->>'operator',
    elem->>'usage_cost',
    (elem->>'max_power')::NUMERIC,
    (elem->>'is_free')::BOOLEAN,
    (elem->'connections_json')::JSONB
  FROM jsonb_array_elements(p_chargers) AS elem
  ON CONFLICT (id) DO UPDATE SET
    lat = EXCLUDED.lat,
    lon = EXCLUDED.lon,
    geom = EXCLUDED.geom,
    title = EXCLUDED.title,
    address = EXCLUDED.address,
    operator = EXCLUDED.operator,
    usage_cost = EXCLUDED.usage_cost,
    max_power = EXCLUDED.max_power,
    is_free = EXCLUDED.is_free,
    connections_json = EXCLUDED.connections_json,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- FUNCIÓN: Limpiar la tabla (Truncate)
CREATE OR REPLACE FUNCTION clean_ev_chargers()
RETURNS VOID AS 146699
BEGIN
  TRUNCATE TABLE ev_chargers;
END;
146699 LANGUAGE plpgsql;
