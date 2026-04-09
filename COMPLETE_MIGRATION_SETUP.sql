-- ====================================================================
-- NAVEGAPRO: COMPLETE BACKEND SETUP (CONSOLIDATED)
-- Project: NavegaPRO (uoejbgifzstyugjsnwkc)
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. CORE TABLES: PROFILES & SOCIAL
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  car_name TEXT DEFAULT 'Mi Tesla',
  car_type TEXT DEFAULT 'Model 3',
  car_color TEXT DEFAULT 'Blanco',
  is_sharing_location BOOLEAN DEFAULT false,
  last_lat DOUBLE PRECISION,
  last_lon DOUBLE PRECISION,
  is_online BOOLEAN DEFAULT false,
  avatar_url TEXT,
  current_destination JSONB,
  current_waypoints JSONB DEFAULT '[]',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.friendships (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id)
);

CREATE TABLE IF NOT EXISTS public.friend_nicknames (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id)
);

CREATE TABLE IF NOT EXISTS public.friend_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. LUXURY YACHTS SYSTEM
CREATE TABLE IF NOT EXISTS public.luxury_yacht_list (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    mmsi text UNIQUE NOT NULL,
    name text NOT NULL,
    owner text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.luxury_yacht_positions (
    mmsi text PRIMARY KEY REFERENCES public.luxury_yacht_list(mmsi) ON DELETE CASCADE,
    latitude float8,
    longitude float8,
    speed float8,
    course float8,
    heading float8,
    nav_status text,
    last_update timestamptz DEFAULT now(),
    destination text
);

-- 4. GAS STATIONS (POSTGIS)
CREATE TABLE IF NOT EXISTS public.gas_stations (
  id INTEGER PRIMARY KEY,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  geom GEOMETRY(POINT, 4326),
  name TEXT,
  address TEXT,
  city TEXT,
  province TEXT,
  schedule TEXT,
  price_g95 NUMERIC,
  price_g98 NUMERIC,
  price_diesel NUMERIC,
  price_glp NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gas_stations_geom ON public.gas_stations USING GIST (geom);

-- 5. OPENSKY (PEGASUS) CACHE
CREATE TABLE IF NOT EXISTS public.opensky_tokens (
    account_id TEXT PRIMARY KEY,
    token TEXT,
    expires_at BIGINT NOT NULL DEFAULT 0,
    cooldown_until BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.opensky_cache (
    bbox_key TEXT PRIMARY KEY,
    states JSONB,
    rate_limited BOOLEAN DEFAULT false,
    account_index INTEGER,
    ts BIGINT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.opensky_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bbox_key TEXT,
    ulat DOUBLE PRECISION,
    ulon DOUBLE PRECISION,
    last_requested_at BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. RLS & SECURITY
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_nicknames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.luxury_yacht_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.luxury_yacht_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gas_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opensky_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opensky_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opensky_requests ENABLE ROW LEVEL SECURITY;

-- Policies: Profiles
DROP POLICY IF EXISTS "Perfiles: Lectura propia" ON public.profiles;
CREATE POLICY "Perfiles: Lectura propia" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Perfiles: Inserción propia" ON public.profiles;
CREATE POLICY "Perfiles: Inserción propia" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Perfiles: Actualización propia" ON public.profiles;
CREATE POLICY "Perfiles: Actualización propia" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Email visibility policy (for search)
DROP POLICY IF EXISTS "Los usuarios pueden ver perfiles básicos" ON public.profiles;
CREATE POLICY "Los usuarios pueden ver perfiles básicos" ON public.profiles FOR SELECT USING (auth.uid() IS NOT NULL);

-- Friends location policy
DROP POLICY IF EXISTS "Ver ubicación de amigos aceptados" ON public.profiles;
CREATE POLICY "Ver ubicación de amigos aceptados" ON public.profiles FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.friendships 
      WHERE status = 'accepted' 
      AND (
        (user_id = auth.uid() AND friend_id = public.profiles.id) OR 
        (friend_id = auth.uid() AND user_id = public.profiles.id)
      )
    )
);

-- Policies: Friendships
DROP POLICY IF EXISTS "Usuarios pueden ver sus propias amistades" ON public.friendships;
CREATE POLICY "Usuarios pueden ver sus propias amistades" ON public.friendships FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Usuarios pueden crear solicitudes de amistad" ON public.friendships;
CREATE POLICY "Usuarios pueden crear solicitudes de amistad" ON public.friendships FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios pueden actualizar sus amistades" ON public.friendships;
CREATE POLICY "Usuarios pueden actualizar sus amistades" ON public.friendships FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Policies: Nicknames
DROP POLICY IF EXISTS "Usuarios pueden gestionar sus propios apodos privados" ON public.friend_nicknames;
CREATE POLICY "Usuarios pueden gestionar sus propios apodos privados" ON public.friend_nicknames FOR ALL USING (auth.uid() = user_id);

-- Policies: Invitations
DROP POLICY IF EXISTS "Usuarios pueden gestionar sus invitaciones" ON public.friend_invitations;
CREATE POLICY "Usuarios pueden gestionar sus invitaciones" ON public.friend_invitations FOR ALL USING (auth.uid() = sender_id);

-- Policies: Yachts & Gas Stations (Public read)
DROP POLICY IF EXISTS "Public select on luxury_yacht_list" ON public.luxury_yacht_list;
CREATE POLICY "Public select on luxury_yacht_list" ON public.luxury_yacht_list FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public select on luxury_yacht_positions" ON public.luxury_yacht_positions;
CREATE POLICY "Public select on luxury_yacht_positions" ON public.luxury_yacht_positions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public select on gas_stations" ON public.gas_stations;
CREATE POLICY "Public select on gas_stations" ON public.gas_stations FOR SELECT USING (true);

-- Policies: OpenSky (Backend managed)
DROP POLICY IF EXISTS "Allow anon reading of cache" ON public.opensky_cache;
CREATE POLICY "Allow anon reading of cache" ON public.opensky_cache FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anon management of cache" ON public.opensky_cache;
CREATE POLICY "Allow anon management of cache" ON public.opensky_cache FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon management of requests" ON public.opensky_requests;
CREATE POLICY "Allow anon management of requests" ON public.opensky_requests FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 7. TRIGGERS & FUNCTIONS
-- Handle new user profile
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

-- Handle invitation conversion
CREATE OR REPLACE FUNCTION public.handle_invite_conversion() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.friendships (user_id, friend_id, status)
  SELECT sender_id, NEW.id, 'pending'
  FROM public.friend_invitations
  WHERE receiver_email = NEW.email
  ON CONFLICT (user_id, friend_id) DO NOTHING;
  DELETE FROM public.friend_invitations WHERE receiver_email = NEW.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created_convert_invite ON public.profiles;
CREATE TRIGGER on_profile_created_convert_invite
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_invite_conversion();

-- 8. NEARBY FUNCTIONS (POSTGIS)
CREATE OR REPLACE FUNCTION get_stations_nearby(p_lat DOUBLE PRECISION, p_lon DOUBLE PRECISION, p_radius_meters DOUBLE PRECISION DEFAULT 15000)
RETURNS TABLE (id INTEGER, lat DOUBLE PRECISION, lon DOUBLE PRECISION, name TEXT, address TEXT, city TEXT, schedule TEXT, price_g95 NUMERIC, price_g98 NUMERIC, price_diesel NUMERIC, price_glp NUMERIC, distance_meters DOUBLE PRECISION) AS $$
BEGIN
  RETURN QUERY
  SELECT g.id, g.lat, g.lon, g.name, g.address, g.city, g.schedule, g.price_g95, g.price_g98, g.price_diesel, g.price_glp,
    ST_Distance(g.geom, ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography) AS distance_meters
  FROM public.gas_stations g
  WHERE ST_DWithin(g.geom, ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography, p_radius_meters)
  ORDER BY distance_meters ASC LIMIT 200;
END;
$$ LANGUAGE plpgsql;

-- 9. DATA SEEDING: LUXURY YACHTS
INSERT INTO public.luxury_yacht_list (name, owner, mmsi) VALUES
('Eclipse', 'Roman Abramovich', '310593000'), ('Dilbar', 'Alisher Usmanov', '319094900'), ('Seven Seas', 'Familia Jobs', '319225300'),
('Serene', 'Mohammed bin Salman', '319021900'), ('Flying Fox', 'Jeff Bezos (Charter)', '319133800'), ('Kismet', 'Shahid Khan', '538071476'),
('Lady S', 'Sergey Brin', '319137200'), ('Nord', 'Alexey Mordashov', '273610820'), ('Venus', 'Steve Jobs', '319327000'),
('Octopus', 'Paul Allen', '319866000'), ('Dream', 'Michael Schumacher (Charter)', '538071581'), ('Aquarius', 'Shakira (Associated)', '319107400'),
('Azzurra II', 'Cristiano Ronaldo (Asociado)', '511100826'), ('Seven (Sealium)', 'David Beckham', '247337500'), ('Sirona III', 'Lewis Hamilton (Asociado)', '538070779'),
('Amphitrite', 'Johnny Depp (Histórico)', '319082100'), ('Plan B', 'Brad Pitt (Asociado)', '319618000'), ('The One', 'N/A (Lurssen)', '538071239'),
('A+ (Topaz)', 'Eddie Murphy (Asociado)', '319043200'), ('Faith', 'Lawrence Stroll / Latifi', '319306200'), ('Boardwalk', 'Tilman Fertitta', '319205400'),
('Vava II', 'Ernesto Bertarelli', '319808000'), ('Utopia IV', 'J.R. Ridinger', '303455000'), ('Archimedes', 'James Simons', '310563000'),
('Nahlin', 'James Dyson', '235075032'), ('Coral Ocean', 'Ian Malouf', '538071163'), ('Skyfall', 'John Risley', '319031100'),
('Eternity', '65m Codecasa', '538072250'), ('Lauren L', '90m Cassens-Werft', '319053200'), ('Triple Seven', 'Alexei Abramov', '319058500'),
('Muse', '37m Palmer Johnson', '319054500'), ('Bliss', '95m Feadship', '538071599'), ('Black Pearl', 'Oleg Burlakov', '319113100'),
('Savannah', 'Lukas Lundin', '538071192'), ('Maltese Falcon', 'Elena Ambrosiadou', '249555000'), ('Adastra', 'Anto Marden', '319327900'),
('Palladium', 'Mikhail Prokhorov', '319030100'), ('Solaris', 'Roman Abramovich', '310815000'), ('Dragonfly (Infinity)', 'Larry Page', '319524000'),
('Alfa', '70m Benetti', '319190400'), ('Vision', '44m Feadship', '339304000'), ('Grand Ocean', '80m Blohm & Voss', '310065000'),
('Serendipity', '40m Perini Navi', '247271900'), ('Euphoria', '29m Mayra', '235011746'), ('Mirage', '53m Feadship', '235057247')
ON CONFLICT (mmsi) DO NOTHING;

-- 10. REALTIME ENABLING
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  
  ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_nicknames;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_invitations;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.luxury_yacht_positions;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Some tables might already be in publication';
END $$;

NOTIFY pgrst, 'reload schema';
