'use client';

import { useState, useEffect, useCallback } from 'react';
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
}

export function useSocial(session: Session | null, userPos: [number, number] | null) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFriends = useCallback(async () => {
    if (!session?.user) return;

    // Obtener amistades aceptadas
    const { data: friendships, error: fError } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .eq('status', 'accepted')
      .or(`user_id.eq.${session.user.id},friend_id.eq.${session.user.id}`);

    if (fError) {
      console.error('Error fetching friendships:', fError);
      return;
    }

    const friendIds = friendships.map(f => f.user_id === session.user.id ? f.friend_id : f.user_id);

    if (friendIds.length === 0) {
      setFriends([]);
      setLoading(false);
      return;
    }

    // Obtener perfiles de los amigos
    const { data: profiles, error: pError } = await supabase
      .from('profiles')
      .select('id, email, car_name, car_color, is_online, last_lat, last_lon, is_sharing_location')
      .in('id', friendIds);

    if (pError) {
      console.error('Error fetching friend profiles:', pError);
    } else {
      setFriends(profiles as Friend[]);
    }
    setLoading(false);
  }, [session]);

  // Actualizar mi propia ubicación en Supabase si estoy compartiendo
  useEffect(() => {
    if (!session?.user || !userPos) return;

    const updateMyLocation = async () => {
      // Primero verificar si el usuario tiene activado "compartir"
      const { data } = await supabase
        .from('profiles')
        .select('is_sharing_location')
        .eq('id', session.user.id)
        .single();

      if (data?.is_sharing_location) {
        await supabase
          .from('profiles')
          .update({
            last_lat: userPos[0],
            last_lon: userPos[1],
            is_online: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', session.user.id);
      }
    };

    const interval = setInterval(updateMyLocation, 10000); // Cada 10 segundos
    updateMyLocation();

    return () => clearInterval(interval);
  }, [session, userPos]);

  // Suscribirse a cambios en tiempo real
  useEffect(() => {
    if (!session?.user) return;

    fetchFriends();

    const channel = supabase
      .channel('social-updates')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'profiles' 
      }, () => {
        fetchFriends(); 
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friendships'
      }, () => {
        fetchFriends();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, fetchFriends]);

  const addFriend = async (friendId: string) => {
    if (!session?.user || friendId === session.user.id) return { error: 'ID inválido' };

    // Verificar si ya existe relación
    const { data: existing } = await supabase
      .from('friendships')
      .select('*')
      .or(`and(user_id.eq.${session.user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${session.user.id})`)
      .single();

    if (existing) {
      if (existing.status === 'accepted') return { error: 'Ya sois amigos' };
      if (existing.user_id === session.user.id) return { error: 'Solicitud ya enviada' };
      
      // Si el otro ya me había mandado solicitud, aceptarla automáticamente
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

  return { friends, loading, addFriend, refreshFriends: fetchFriends };
}
