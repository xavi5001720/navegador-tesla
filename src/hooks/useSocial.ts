'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

export interface Friend {
  id: string;
  email: string;
  car_name: string;
  car_color: string;
  is_online: boolean;
  last_lat?: number;
  last_lon?: number;
  is_sharing_location: boolean;
  friendship_status: 'pending' | 'accepted';
  is_incoming: boolean;
}

export interface LivePosition {
  lat: number;
  lon: number;
  timestamp: number;
}

export function useSocial(session: Session | null, userPos: [number, number] | null) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [livePositions, setLivePositions] = useState<Record<string, LivePosition>>({});
  
  const lastDbUpdateRef = useRef<number>(0);
  const channelRef = useRef<any>(null);

  console.info(`[useSocial] 🔄 Hook inicializado para el usuario: ${session?.user?.id || 'Sesión no detectada'}`);

  const fetchFriends = useCallback(async () => {
    console.info('[useSocial] 🔄 Intentando cargar amigos...');
    if (!session?.user) {
      console.info('[useSocial] ⚠️ Sin sesión activa, abortando carga de amigos.');
      return;
    }

    try {
      console.info('[useSocial] 🔍 Cargando amistades para:', session.user.id);
      
      // 1. Obtener todas nuestras amistades (aceptadas y pendientes)
      const { data: friendships, error: fError } = await supabase
        .from('friendships')
        .select('user_id, friend_id, status')
        .or(`user_id.eq.${session.user.id},friend_id.eq.${session.user.id}`);

      if (fError) {
        console.error('[useSocial] Error fetching friendships:', fError);
        throw fError;
      }
      
      console.log('[useSocial] Found friendships:', friendships?.length || 0);

      // 2. Obtener nuestras invitaciones enviadas a emails no registrados
      const { data: invitations, error: iError } = await supabase
        .from('friend_invitations')
        .select('receiver_email')
        .eq('sender_id', session.user.id);

      if (iError) {
        console.error('[useSocial] Error fetching invitations:', iError);
        throw iError;
      }
      
      console.log('[useSocial] Found invitations:', invitations?.length || 0);

      const friendInfo = (friendships || []).map(f => ({
        id: f.user_id === session.user.id ? f.friend_id : f.user_id,
        status: f.status as 'pending' | 'accepted',
        is_incoming: f.friend_id === session.user.id && f.status === 'pending'
      }));

      const friendIds = friendInfo.map(fi => fi.id);

      // 3. Obtener perfiles de los amigos registrados
      let mappedFriends: Friend[] = [];
      if (friendIds.length > 0) {
        console.log('[useSocial] Fetching profiles for IDs:', friendIds);
        const { data: profiles, error: pError } = await supabase
          .from('profiles')
          .select('id, email, car_name, car_color, is_online, last_lat, last_lon, is_sharing_location')
          .in('id', friendIds);

        if (pError) {
          console.error('[useSocial] Error fetching profiles:', pError);
          // No lanzamos error para que al menos las invitaciones funcionen
        } else {
          console.log('[useSocial] Found profiles:', profiles?.length || 0);
          mappedFriends = (profiles || []).map(p => {
            const fi = friendInfo.find(info => info.id === p.id);
            return {
              ...p,
              friendship_status: fi?.status || 'pending',
              is_incoming: fi?.is_incoming || false
            } as Friend;
          });
        }
      }

      // 4. Agregar las invitaciones "en el aire" (a emails no registrados)
      const invitedFriends: Friend[] = (invitations || []).map(inv => ({
        id: `pending-${inv.receiver_email}`,
        email: inv.receiver_email,
        car_name: 'Invitado (Sin cuenta)',
        car_color: 'Desconocido',
        is_online: false,
        is_sharing_location: false,
        friendship_status: 'pending',
        is_incoming: false
      }));

      console.log('[useSocial] Final friends count:', mappedFriends.length + invitedFriends.length);
      setFriends([...mappedFriends, ...invitedFriends]);
    } catch (err) {
      console.error('[useSocial] Final catch error:', err);
    } finally {
      setLoading(false);
    }
  }, [session]);

  // Disparador inicial y por cambio de sesión
  useEffect(() => {
    if (session?.user) {
      fetchFriends();
    }
  }, [session, fetchFriends]);

  // ... [Previous Realtime & Location Persistance logic stays same] ...

  // ── Actions ───────────────────────────────────────────────────────────────

  const addFriend = async (email: string) => {
    if (!session?.user) return { error: 'No hay sesión' };
    const cleanEmail = email.trim().toLowerCase();
    
    if (cleanEmail === session.user.email) return { error: 'No puedes añadirte a ti mismo' };

    // 1. Buscar si el usuario existe
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, car_name')
      .eq('email', cleanEmail)
      .single();

    if (profile) {
      // Caso A: El usuario ya existe en NavegaPRO
      const { data: existing } = await supabase
        .from('friendships')
        .select('*')
        .or(`and(user_id.eq.${session.user.id},friend_id.eq.${profile.id}),and(user_id.eq.${profile.id},friend_id.eq.${session.user.id})`)
        .single();

      if (existing) {
        if (existing.status === 'accepted') return { error: 'Ya sois amigos' };
        if (existing.user_id === session.user.id) return { error: 'Solicitud ya enviada' };
        
        // Si nosotros recibimos la solicitud, la aceptamos
        return acceptFriend(profile.id);
      }

      const { error } = await supabase
        .from('friendships')
        .insert({ user_id: session.user.id, friend_id: profile.id, status: 'pending' });

      await fetchFriends();
      return { success: true, accepted: false, error };
    } else {
      // Caso B: El usuario NO existe, crear invitación y enviar mail
      const { error: invError } = await supabase
        .from('friend_invitations')
        .upsert({ sender_id: session.user.id, receiver_email: cleanEmail });

      if (invError) return { error: 'Error al crear invitación' };

      // Llamar a la Edge Function para avisar al amigo
      try {
        const { data: myProfile } = await supabase
          .from('profiles')
          .select('car_name')
          .eq('id', session.user.id)
          .single();

        await supabase.functions.invoke('invite-friend', {
          body: { 
            senderName: myProfile?.car_name || session.user.email,
            receiverEmail: cleanEmail
          }
        });
      } catch (e) {
        console.warn('No se pudo enviar el mail de invitación:', e);
      }

      await fetchFriends();
      return { success: true, invited: true };
    }
  };

  const acceptFriend = async (friendId: string) => {
    if (!session?.user) return { error: 'No hay sesión' };

    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('user_id', friendId)
      .eq('friend_id', session.user.id);

    await fetchFriends();
    return { success: !error, error };
  };

  const removeFriend = async (friendId: string) => {
    if (!session?.user) return { error: 'No hay sesión' };

    if (friendId.startsWith('pending-')) {
      const email = friendId.replace('pending-', '');
      await supabase.from('friend_invitations').delete().eq('receiver_email', email);
    } else {
      await supabase
        .from('friendships')
        .delete()
        .or(`and(user_id.eq.${session.user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${session.user.id})`);
    }

    await fetchFriends();
    return { success: true };
  };

  // Mapear amigos con su estado "Live"
  // Solo consideramos online si la amistad está aceptada
  const enhancedFriends = friends.map(f => ({
    ...f,
    is_online: f.friendship_status === 'accepted' && onlineUserIds.has(f.id),
    // Usar posición de broadcast si está disponible (más fresca), si no la de DB
    last_lat: livePositions[f.id]?.lat ?? f.last_lat,
    last_lon: livePositions[f.id]?.lon ?? f.last_lon,
  }));

  return { 
    friends: enhancedFriends, 
    loading, 
    addFriend, 
    acceptFriend,
    removeFriend,
    refreshFriends: fetchFriends 
  };
}
