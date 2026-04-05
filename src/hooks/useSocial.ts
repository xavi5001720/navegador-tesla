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

  const fetchFriends = useCallback(async () => {
    if (!session?.user) return;

    try {
      // 1. Obtener todas nuestras amistades (aceptadas y pendientes)
      const { data: friendships, error: fError } = await supabase
        .from('friendships')
        .select('user_id, friend_id, status')
        .or(`user_id.eq.${session.user.id},friend_id.eq.${session.user.id}`);

      if (fError) throw fError;

      const friendInfo = (friendships || []).map(f => ({
        id: f.user_id === session.user.id ? f.friend_id : f.user_id,
        status: f.status as 'pending' | 'accepted'
      }));

      const friendIds = friendInfo.map(fi => fi.id);

      if (friendIds.length === 0) {
        setFriends([]);
        setLoading(false);
        return;
      }

      // 2. Obtener perfiles de esos amigos
      const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('id, email, car_name, car_color, is_online, last_lat, last_lon, is_sharing_location')
        .in('id', friendIds);

      if (pError) throw pError;
      
      const mappedFriends = (profiles || []).map(p => {
        const fi = friendInfo.find(info => info.id === p.id);
        return {
          ...p,
          friendship_status: fi?.status || 'pending'
        } as Friend;
      });

      setFriends(mappedFriends);
    } catch (err) {
      console.error('[useSocial] Error fetching friends:', err);
    } finally {
      setLoading(false);
    }
  }, [session]);

  // ── Gestión de Realtime (Presence & Broadcast) ─────────────────────────────
  useEffect(() => {
    if (!session?.user) return;

    fetchFriends();

    // Crear canal social único para este usuario
    const channel = supabase.channel('social-room', {
      config: {
        presence: { key: session.user.id },
      },
    });

    channelRef.current = channel;

    channel
      // A. Presence: Quién está online
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const onlineIds = new Set(Object.keys(state));
        setOnlineUserIds(onlineIds);
      })
      // B. Broadcast: Posiciones GPS en tiempo real
      .on('broadcast', { event: 'location' }, ({ payload }) => {
        const { userId, lat, lon } = payload;
        // Solo nos interesan posiciones de amigos (podríamos filtrar aquí o en el render)
        setLivePositions(prev => ({
          ...prev,
          [userId]: { lat, lon, timestamp: Date.now() }
        }));
      })
      // C. Cambios en amistades (para refrescar la lista si alguien nos acepta)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friendships'
      }, () => {
        fetchFriends();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Registrarse en Presence
          await channel.track({
            online_at: new Date().toISOString(),
            user_id: session.user.id
          });
        }
      });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [session, fetchFriends]);

  // ── Difusión y Persistencia de Ubicación ──────────────────────────────────
  useEffect(() => {
    if (!session?.user || !userPos || !channelRef.current) return;

    const now = Date.now();
    const [lat, lon] = userPos;

    // 1. BROADCAST: Enviar a mis amigos (Muy ligero, sin DB)
    // Lo enviamos frecuentemente para suavidad en el mapa
    channelRef.current.send({
      type: 'broadcast',
      event: 'location',
      payload: { userId: session.user.id, lat, lon }
    });

    // 2. BASE DE DATOS: Persistencia (Throttled a cada 30 segundos)
    if (now - lastDbUpdateRef.current > 30000) {
      const persistLocation = async () => {
        // Solo si el usuario tiene el permiso activado
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_sharing_location')
          .eq('id', session.user.id)
          .single();

        if (profile?.is_sharing_location) {
          await supabase
            .from('profiles')
            .update({
              last_lat: lat,
              last_lon: lon,
              is_online: true, // Retrocompatibilidad
              updated_at: new Date().toISOString()
            })
            .eq('id', session.user.id);
          
          lastDbUpdateRef.current = now;
        }
      };
      persistLocation();
    }
  }, [session, userPos]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const addFriend = async (friendId: string) => {
    if (!session?.user || friendId === session.user.id) return { error: 'ID inválido' };

    const { data: existing } = await supabase
      .from('friendships')
      .select('*')
      .or(`and(user_id.eq.${session.user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${session.user.id})`)
      .single();

    if (existing) {
      if (existing.status === 'accepted') return { error: 'Ya sois amigos' };
      if (existing.user_id === session.user.id) return { error: 'Solicitud ya enviada' };
      
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('user_id', friendId)
        .eq('friend_id', session.user.id);
        
      await fetchFriends();
      return { success: true, accepted: true, error };
    }

    const { error } = await supabase
      .from('friendships')
      .insert({ user_id: session.user.id, friend_id: friendId, status: 'pending' });

    await fetchFriends();
    return { success: true, accepted: false, error };
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
    refreshFriends: fetchFriends 
  };
}
