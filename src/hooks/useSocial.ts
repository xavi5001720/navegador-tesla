// src/hooks/useSocial.ts
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
  heading?: number;
  is_sharing_location: boolean;
  friendship_status: 'pending' | 'accepted';
  is_incoming: boolean;
  nickname?: string;
}

export interface LivePosition {
  lat: number;
  lon: number;
  heading: number;
  timestamp: number;
}

export function useSocial(
  session: Session | null, 
  userPos: [number, number], 
  heading: number = 0,
  speed: number = 0,
  isSharingLocation: boolean = true, 
  hasLocation: boolean = false
) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [livePositions, setLivePositions] = useState<Record<string, LivePosition>>({});
  
  const channelRef = useRef<any>(null);

  // 1. Cargar lista de amigos
  const fetchFriends = useCallback(async () => {
    if (!session?.user) return;

    try {
      const { data: friendships, error: fError } = await supabase
        .from('friendships')
        .select('user_id, friend_id, status')
        .or(`user_id.eq.${session.user.id},friend_id.eq.${session.user.id}`);

      if (fError) throw fError;
      
      const { data: privateNicknames } = await supabase
        .from('friend_nicknames')
        .select('friend_id, nickname')
        .eq('user_id', session.user.id);

      const nicknamesMap: Record<string, string> = {};
      (privateNicknames || []).forEach(n => { nicknamesMap[n.friend_id] = n.nickname; });
      
      const { data: invitations } = await supabase
        .from('friend_invitations')
        .select('receiver_email')
        .eq('sender_id', session.user.id);

      const friendInfoMap: Record<string, { status: 'pending' | 'accepted', is_incoming: boolean, nickname?: string }> = {};
      (friendships || []).forEach(f => {
        const friendId = f.user_id === session.user.id ? f.friend_id : f.user_id;
        const status = f.status as 'pending' | 'accepted';
        const isIncoming = f.friend_id === session.user.id && status === 'pending';
        
        if (!friendInfoMap[friendId] || status === 'accepted') {
          friendInfoMap[friendId] = { 
            status, 
            is_incoming: isIncoming, 
            nickname: nicknamesMap[friendId] || undefined 
          };
        }
      });

      const friendIds = Object.keys(friendInfoMap);
      let mappedFriends: Friend[] = [];

      if (friendIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email, car_name, car_color, is_online, last_lat, last_lon, is_sharing_location')
          .in('id', friendIds);

        if (profiles) {
          mappedFriends = profiles.map(p => {
            const info = friendInfoMap[p.id];
            return {
              ...p,
              friendship_status: info.status,
              is_incoming: info.is_incoming,
              nickname: info.nickname
            } as Friend;
          });
        }
      }

      const invitedFriends: Friend[] = (invitations || []).map(inv => ({
        id: `pending-${inv.receiver_email}`,
        email: inv.receiver_email,
        car_name: `Invitado (${inv.receiver_email})`,
        car_color: 'Desconocido',
        is_online: false,
        is_sharing_location: false,
        friendship_status: 'pending',
        is_incoming: false
      }));

      setFriends([...mappedFriends, ...invitedFriends]);
    } catch (err) {
      console.error('[useSocial] Error loading friends:', err);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session?.user) fetchFriends();
  }, [session, fetchFriends]);

  // 2. Canal Realtime (Braodcast y Presencia)
  useEffect(() => {
    if (!session?.user) return;

    const channel = supabase.channel('garage_social_live', {
      config: { presence: { key: session.user.id } }
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const onlineIds = new Set<string>();
        Object.keys(state).forEach((key: any) => {
          (state[key] as any[]).forEach((p: any) => onlineIds.add(p.key));
        });
        setOnlineUserIds(onlineIds);
      })
      .on('broadcast', { event: 'SOCIAL_LOCATION_UPDATE' }, ({ payload }) => {
        if (payload.user_id === session.user.id) return;
        
        setLivePositions(prev => ({
          ...prev,
          [payload.user_id]: {
            lat: payload.lat,
            lon: payload.lon,
            heading: payload.heading,
            timestamp: payload.timestamp
          }
        }));
      })
      .on('broadcast', { event: 'SOCIAL_STATUS_UPDATE' }, ({ payload }) => {
        setFriends(prev => prev.map(f => 
          f.id === payload.user_id 
            ? { ...f, is_sharing_location: payload.is_sharing_location } 
            : f
        ));

        if (payload.is_sharing_location === false) {
          setLivePositions(prev => {
            const next = { ...prev };
            delete next[payload.user_id];
            return next;
          });
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ key: session.user.id, online_at: new Date().toISOString() });
        }
      });

    channelRef.current = channel;

    const dbChannel = supabase.channel('garage_db_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => fetchFriends())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_invitations' }, () => fetchFriends())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_nicknames' }, () => fetchFriends())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(dbChannel);
    };
  }, [session, fetchFriends]);

  // 3. Emisión de Posición (Cada 5 minutos)
  useEffect(() => {
    if (!session?.user || !isSharingLocation || !hasLocation || !userPos) return;

    // Función para enviar y persistir ubicación
    const syncLocation = () => {
      if (!channelRef.current || channelRef.current.state !== 'joined') return;
      
      const now = Date.now();
      
      // 1. Broadcast instantáneo a amigos conectados
      channelRef.current.send({
        type: 'broadcast',
        event: 'SOCIAL_LOCATION_UPDATE',
        payload: { 
          user_id: session.user.id, 
          lat: userPos[0],
          lon: userPos[1],
          heading: heading,
          timestamp: now 
        }
      });
      console.log(`[Social] Enviando ubicación en vivo a amigos conectados.`);

      // 2. Persistencia en base de datos
      supabase.from('profiles').update({
        last_lat: userPos[0],
        last_lon: userPos[1],
        is_online: true,
        is_sharing_location: true
      }).eq('id', session.user.id).then();
    };

    // Al montar (o re-habilitar), enviamos una posición inicial pasados un par de segundos
    // para dar tiempo a que se una al canal
    const initTimer = setTimeout(syncLocation, 3000);

    // Intervalo de 5 minutos (300,000 milisegundos)
    const senderLoop = setInterval(syncLocation, 300000);

    return () => {
      clearInterval(senderLoop);
      clearTimeout(initTimer);
    };
  }, [session, userPos, heading, isSharingLocation, hasLocation]);

  // Señal Instantánea al desactivar Privacidad
  useEffect(() => {
    if (!session?.user || !channelRef.current) return;

    // Si desactivamos explícitamente compartir
    if (!isSharingLocation) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'SOCIAL_STATUS_UPDATE',
        payload: { 
          user_id: session.user.id, 
          is_sharing_location: false 
        }
      });
      // Marcar en la db
      supabase.from('profiles').update({
        is_sharing_location: false
      }).eq('id', session.user.id).then();
    }
  }, [isSharingLocation, session?.user]);

  // Acciones (addFriend, removeFriend, etc. se mantienen igual ya que son DB)

  // 4. Acciones
  const addFriend = async (email: string) => {
    if (!session?.user) return { error: 'No hay sesión' };
    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail === session.user.email) return { error: 'No puedes añadirte a ti mismo' };

    const { data: profile } = await supabase.from('profiles').select('id').eq('email', cleanEmail).single();

    if (profile) {
      const { error } = await supabase.from('friendships').insert({ user_id: session.user.id, friend_id: profile.id, status: 'pending' });
      await fetchFriends();
      return { success: !error, error };
    } else {
      await supabase.from('friend_invitations').upsert({ sender_id: session.user.id, receiver_email: cleanEmail });
      await fetchFriends();
      return { success: true, invited: true };
    }
  };

  const removeFriend = async (friendId: string) => {
    if (!session?.user) return { success: false };
    if (friendId.startsWith('pending-')) {
      await supabase.from('friend_invitations').delete().match({ sender_id: session.user.id, receiver_email: friendId.replace('pending-', '') });
    } else {
      await supabase.from('friendships').delete().or(`and(user_id.eq.${session.user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${session.user.id})`);
    }
    await fetchFriends();
    return { success: true };
  };

  const updateFriendNickname = async (friendId: string, nickname: string) => {
    if (!session?.user) return { success: false };
    await supabase.from('friend_nicknames').upsert({ user_id: session.user.id, friend_id: friendId, nickname: nickname || null });
    await fetchFriends();
    return { success: true };
  };

  const acceptFriend = async (friendId: string) => {
    await supabase.from('friendships').update({ status: 'accepted' }).match({ user_id: friendId, friend_id: session?.user?.id });
    await fetchFriends();
    return { success: true };
  };

  // Mapeo final para el mapa
  const enhancedFriends = friends.map(f => ({
    ...f,
    is_online: f.friendship_status === 'accepted' && onlineUserIds.has(f.id),
    last_lat: livePositions[f.id]?.lat ?? f.last_lat,
    last_lon: livePositions[f.id]?.lon ?? f.last_lon,
    heading: livePositions[f.id]?.heading ?? 0
  }));

  return { 
    friends: enhancedFriends, 
    loading, 
    addFriend, 
    removeFriend, 
    acceptFriend, 
    updateFriendNickname, 
    refreshFriends: fetchFriends
  };
}
