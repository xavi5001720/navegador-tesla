-- 1. Crear tabla de yates de lujo (Metadatos)
CREATE TABLE IF NOT EXISTS luxury_yacht_list (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    mmsi text UNIQUE NOT NULL,
    name text NOT NULL,
    owner text,
    created_at timestamptz DEFAULT now()
);

-- 2. Crear tabla de posiciones (Caché en tiempo real)
CREATE TABLE IF NOT EXISTS luxury_yacht_positions (
    mmsi text PRIMARY KEY REFERENCES luxury_yacht_list(mmsi) ON DELETE CASCADE,
    latitude float8,
    longitude float8,
    speed float8, -- SOG (knots)
    course float8, -- COG (degrees)
    heading float8, -- True heading
    nav_status text,
    last_update timestamptz DEFAULT now(),
    destination text
);

-- 3. Habilitar RLS (Seguridad)
ALTER TABLE luxury_yacht_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE luxury_yacht_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select on yachts list" ON luxury_yacht_list FOR SELECT USING (true);
CREATE POLICY "Allow public select on yachts positions" ON luxury_yacht_positions FOR SELECT USING (true);

-- 4. Población inicial de yates famosos
INSERT INTO luxury_yacht_list (name, owner, mmsi) VALUES
('Eclipse', 'Roman Abramovich', '310593000'),
('Dilbar', 'Alisher Usmanov', '319094900'),
('Seven Seas', 'Familia Jobs', '319225300'),
('Serene', 'Mohammed bin Salman', '319021900'),
('Flying Fox', 'Jeff Bezos (Charter)', '319133800'),
('Kismet', 'Shahid Khan', '538071476'),
('Lady S', 'Sergey Brin', '319137200'),
('Nord', 'Alexey Mordashov', '273610820'),
('Venus', 'Steve Jobs', '319327000'),
('Octopus', 'Paul Allen', '319866000'),
('Dream', 'Michael Schumacher (Charter)', '538071581'),
('Aquarius', 'Shakira (Associated)', '319107400'),
('Azzurra II', 'Cristiano Ronaldo (Asociado)', '511100826'),
('Seven (Sealium)', 'David Beckham', '247337500'),
('Sirona III', 'Lewis Hamilton (Asociado)', '538070779'),
('Amphitrite', 'Johnny Depp (Histórico)', '319082100'),
('Plan B', 'Brad Pitt (Asociado)', '319618000'),
('The One', 'N/A (Lurssen)', '538071239'),
('A+ (Topaz)', 'Eddie Murphy (Asociado)', '319043200'),
('Faith', 'Lawrence Stroll / Latifi', '319306200'),
('Boardwalk', 'Tilman Fertitta', '319205400'),
('Vava II', 'Ernesto Bertarelli', '319808000'),
('Utopia IV', 'J.R. Ridinger', '303455000'),
('Archimedes', 'James Simons', '310563000'),
('Nahlin', 'James Dyson', '235075032'),
('Coral Ocean', 'Ian Malouf', '538071163'),
('Skyfall', 'John Risley', '319031100'),
('Eternity', '65m Codecasa', '538072250'),
('Lauren L', '90m Cassens-Werft', '319053200'),
('Triple Seven', 'Alexei Abramov', '319058500'),
('Muse', '37m Palmer Johnson', '319054500'),
('Bliss', '95m Feadship', '538071599'),
('Black Pearl', 'Oleg Burlakov', '319113100'),
('Savannah', 'Lukas Lundin', '538071192'),
('Maltese Falcon', 'Elena Ambrosiadou', '249555000'),
('Adastra', 'Anto Marden', '319327900'),
('Palladium', 'Mikhail Prokhorov', '319030100'),
('Solaris', 'Roman Abramovich', '310815000'),
('Dragonfly (Infinity)', 'Larry Page', '319524000'),
('Alfa', '70m Benetti', '319190400'),
('Vision', '44m Feadship', '339304000'),
('Grand Ocean', '80m Blohm & Voss', '310065000'),
('Serendipity', '40m Perini Navi', '247271900'),
('Euphoria', '29m Mayra', '235011746'),
('Mirage', '53m Feadship', '235057247')
ON CONFLICT (mmsi) DO NOTHING;
