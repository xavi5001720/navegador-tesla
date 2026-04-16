-- ====================================================================
-- PATCH: SOCIAL SYSTEM FIX
-- Permite múltiples invitaciones al mismo email (por diferentes usuarios)
-- y asegura visibilidad de perfiles para búsqueda.
-- ====================================================================

-- 1. CORREGIR RESTRICCIONES EN FRIEND_INVITATIONS
-- Cambiamos UNIQUE(receiver_email) por UNIQUE(sender_id, receiver_email)
-- para que un mismo amigo pueda ser invitado por diferentes personas.

DO $$
BEGIN
    -- Eliminar la restricción UNIQUE antigua si existe
    -- PostgREST/Supabase suele nombrarla 'friend_invitations_receiver_email_key'
    ALTER TABLE public.friend_invitations DROP CONSTRAINT IF EXISTS friend_invitations_receiver_email_key;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'No se pudo eliminar la restricción; es posible que tenga otro nombre.';
END $$;

-- Aseguramos que el email NO sea único globalmente pero SÍ por remitente
ALTER TABLE public.friend_invitations 
DROP CONSTRAINT IF EXISTS friend_invitations_sender_receiver_key,
ADD CONSTRAINT friend_invitations_sender_receiver_key UNIQUE (sender_id, receiver_email);


-- 2. ASEGURAR POLÍTICAS DE PERFILES PARA BÚSQUEDA
-- La política "Los usuarios pueden ver perfiles básicos" debe permitir
-- que cualquier usuario autenticado busque a otro por email EXACTO.

DROP POLICY IF EXISTS "Los usuarios pueden ver perfiles básicos" ON public.profiles;
CREATE POLICY "Los usuarios pueden ver perfiles básicos" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() IS NOT NULL);

-- NOTA: Si el error 406 persiste, podría ser por el uso de .single() en el cliente.
-- Se recomienda usar .maybeSingle() como se hará en el patch del frontend.


-- 3. RECARGAR ESQUEMA
NOTIFY pgrst, 'reload schema';
