CREATE TABLE gas_stations (
  id INTEGER PRIMARY KEY,        -- IDEESS del ministerio
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  geom GEOMETRY(POINT, 4326),    -- Para consultas espaciales
  name TEXT,                     -- Rótulo
  address TEXT,
  city TEXT,
  province TEXT,
  schedule TEXT,
  price_g95 NUMERIC,             -- Gasolina 95 E5
  price_g98 NUMERIC,             -- Gasolina 98 E5
  price_diesel NUMERIC,          -- Gasoleo A
  price_glp NUMERIC,             -- Gases licuados del petróleo (GLP)
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gas_stations_geom ON gas_stations USING GIST (geom);

CREATE OR REPLACE FUNCTION get_stations_nearby(lat DOUBLE PRECISION, lon DOUBLE PRECISION, radius_meters DOUBLE PRECISION DEFAULT 15000)
RETURNS TABLE (
  id INTEGER,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  name TEXT,
  address TEXT,
  city TEXT,
  schedule TEXT,
  price_g95 NUMERIC,
  price_g98 NUMERIC,
  price_diesel NUMERIC,
  price_glp NUMERIC,
  distance_meters DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id, g.lat, g.lon, g.name, g.address, g.city, g.schedule, g.price_g95, g.price_g98, g.price_diesel, g.price_glp,
    ST_Distance(g.geom, ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography) AS distance_meters
  FROM gas_stations g
  WHERE ST_DWithin(g.geom, ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography, radius_meters)
  ORDER BY distance_meters ASC
  LIMIT 200;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_stations_in_route(route_wkt TEXT, buffer_meters DOUBLE PRECISION DEFAULT 1000)
RETURNS TABLE (
  id INTEGER,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  name TEXT,
  address TEXT,
  city TEXT,
  schedule TEXT,
  price_g95 NUMERIC,
  price_g98 NUMERIC,
  price_diesel NUMERIC,
  price_glp NUMERIC
) AS $$
DECLARE
  route_geom GEOMETRY;
BEGIN
  route_geom := ST_GeomFromText(route_wkt, 4326);
  RETURN QUERY
  SELECT g.id, g.lat, g.lon, g.name, g.address, g.city, g.schedule, g.price_g95, g.price_g98, g.price_diesel, g.price_glp
  FROM gas_stations g
  WHERE ST_DWithin(g.geom, route_geom::geography, buffer_meters);
END;
$$ LANGUAGE plpgsql;
