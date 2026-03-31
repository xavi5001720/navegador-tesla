-- Añadir política de inserción que faltaba para crear perfiles desde el cliente
CREATE POLICY "Los usuarios pueden insertar su propio perfil" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Asegurar que las columnas existen (por si acaso no se ejecutó antes)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS car_name TEXT DEFAULT 'Mi Tesla',
ADD COLUMN IF NOT EXISTS car_type TEXT DEFAULT 'Model 3',
ADD COLUMN IF NOT EXISTS car_color TEXT DEFAULT 'Blanco';
