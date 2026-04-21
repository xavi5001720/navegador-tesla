-- ==============================================================================
-- 🚗 TESLA NAVIGATION SYSTEM - RESTAURANTS HYBRID MODULE (Foursquare + Supabase)
-- ==============================================================================
-- Tabla para almacenar las puntuaciones y reseñas semánticas de la comunidad.
-- Escala de puntuación: 0 a 5.

CREATE TABLE IF NOT EXISTS public.resenas_tesla (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fsq_id TEXT NOT NULL,
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    puntuacion SMALLINT NOT NULL CHECK (puntuacion >= 0 AND puntuacion <= 5),
    comentario TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    -- Regla de integridad: 1 restaurante = 1 review por usuario.
    CONSTRAINT unique_user_fsq_review UNIQUE (usuario_id, fsq_id)
);

-- ==============================================================================
-- 🔒 POLÍTICAS DE SEGURIDAD (RLS - Row Level Security)
-- ==============================================================================

-- 1. Habilitar RLS en la tabla
ALTER TABLE public.resenas_tesla ENABLE ROW LEVEL SECURITY;

-- 2. Lectura Pública: Todos los usuarios (incluso anónimos) pueden leer las reseñas
CREATE POLICY "Permitir lectura publica de reseñas" 
ON public.resenas_tesla 
FOR SELECT 
USING (true);

-- 3. Inserción Autenticada: Solo usuarios logueados pueden crear su propia reseña
CREATE POLICY "Usuarios autenticados pueden crear reseñas" 
ON public.resenas_tesla 
FOR INSERT 
WITH CHECK (auth.uid() = usuario_id);

-- 4. Actualización Autenticada: Los usuarios pueden editar *solo sus propias* reseñas
CREATE POLICY "Usuarios pueden actualizar sus propias reseñas" 
ON public.resenas_tesla 
FOR UPDATE 
USING (auth.uid() = usuario_id) 
WITH CHECK (auth.uid() = usuario_id);

-- ==============================================================================
-- 🚀 ÍNDICES DE RENDIMIENTO (Performance Tuning)
-- ==============================================================================
-- Índice para optimizar el fetch de todas las reseñas de un restaurante específico
CREATE INDEX IF NOT EXISTS idx_resenas_tesla_fsq_id ON public.resenas_tesla(fsq_id);

-- Índice para optimizar la consulta del "Rate Limiting" (última reseña de un usuario)
CREATE INDEX IF NOT EXISTS idx_resenas_tesla_usuario_id_created ON public.resenas_tesla(usuario_id, created_at DESC);
