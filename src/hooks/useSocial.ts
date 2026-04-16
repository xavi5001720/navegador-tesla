// src/hooks/useSocial.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

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
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

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

      if (isMountedRef.current) {
        setFriends([...mappedFriends, ...invitedFriends]);
      }
    } catch (err) {
      logger.error('useSocial', 'Error loading friends', err);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session?.user) fetchFriends();
  }, [session, fetchFriends]);

  // 2. Canal Realtime (Broadcast y Presencia) — FIX C5: guard isMountedRef + FIX I6: reconexión
  useEffect(() => {
    if (!session?.user) return;

    const setupChannel = () => {
      const channel = supabase.channel('garage_social_live', {
        config: { presence: { key: session.user.id } }
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          if (!isMountedRef.current) return;
          const state = channel.presenceState();
          const onlineIds = new Set<string>();
          Object.keys(state).forEach((key: any) => {
            (state[key] as any[]).forEach((p: any) => onlineIds.add(p.key));
          });
          setOnlineUserIds(onlineIds);
        })
        .on('broadcast', { event: 'SOCIAL_LOCATION_UPDATE' }, ({ payload }) => {
          if (!isMountedRef.current || payload.user_id === session.user.id) return;
          
          setLivePositions(prev => ({
            ...prev,
            [payload.user_id]: {
              lat: payload.lat,
              lon: payload.lon,
              heading: payload.heading ?? 0,
              timestamp: payload.timestamp
            }
          }));
        })
        .on('broadcast', { event: 'SOCIAL_STATUS_UPDATE' }, ({ payload }) => {
          if (!isMountedRef.current) return;
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
            logger.info('useSocial', 'Canal Realtime conectado.');
            await channel.track({ key: session.user.id, online_at: new Date().toISOString() });
          } else if (status === 'CHANNEL_ERROR') {
            // FIX I6: Reconexión automática tras error del canal
            logger.warn('useSocial', 'Canal Realtime error. Reconectando en 5s...');
            setTimeout(() => {
              if (isMountedRef.current) {
                supabase.removeChannel(channel);
                channelRef.current = setupChannel();
              }
            }, 5000);
          } else if (status === 'TIMED_OUT') {
            logger.warn('useSocial', 'Canal Realtime timeout. Reconectando...');
            setTimeout(() => {
              if (isMountedRef.current) {
                supabase.removeChannel(channel);
                channelRef.current = setupChannel();
              }
            }, 5000);
          }
        });

      channelRef.current = channel;
      return channel;
    };

    const channel = setupChannel();

    const dbChannel = supabase.channel('garage_db_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => fetchFriends())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_invitations' }, () => fetchFriends())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_nicknames' }, () => fetchFriends())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(dbChannel);
      channelRef.current = null;
    };
  }, [session, fetchFriends]);

  // 3. Emisión de Posición (Cada 5 minutos)
  useEffect(() => {
    if (!session?.user || !isSharingLocation || !hasLocation || !userPos) return;

    const syncLocation = () => {
      // FIX C5: Guard para canal nulo
      if (!channelRef.current || channelRef.current.state !== 'joined') {
        logger.warn('useSocial', 'Canal no disponible para sync de posición, saltando.');
        return;
      }
      
      // Validación de coordenadas antes de enviar
      const [lat, lon] = userPos;
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        logger.warn('useSocial', 'Coordenadas inválidas, no se envían.', { lat, lon });
        return;
      }
      
      const now = Date.now();
      channelRef.current.send({
        type: 'broadcast',
        event: 'SOCIAL_LOCATION_UPDATE',
        payload: { 
          user_id: session.user.id, 
          lat,
          lon,
          heading: isNaN(heading) ? 0 : heading,
          timestamp: now 
        }
      });
      logger.info('useSocial', 'Ubicación sincronizada con amigos conectados.');

      // Persistencia en base de datos
      supabase.from('profiles').update({
        last_lat: lat,
        last_lon: lon,
        is_online: true,
        is_sharing_location: true
      }).eq('id', session.user.id).then(({ error }) => {
        if (error) logger.error('useSocial', 'Error guardando posición en DB', error.message);
      });
    };

    // Posición inicial tras conectar (espera 3s para que el canal esté listo)
    const initTimer = setTimeout(syncLocation, 3000);
    // Intervalo de 5 minutos
    const senderLoop = setInterval(syncLocation, 300000);

    return () => {
      clearInterval(senderLoop);
      clearTimeout(initTimer);
    };
  }, [session, userPos, heading, isSharingLocation, hasLocation]);

  // 4. Señal instantánea al desactivar privacidad
  useEffect(() => {
    // FIX C5: Guard para canal nulo — este effect puede ejecutarse antes de que el canal esté listo
    if (!session?.user || !channelRef.current) return;

    if (!isSharingLocation) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'SOCIAL_STATUS_UPDATE',
        payload: { user_id: session.user.id, is_sharing_location: false }
      });
      supabase.from('profiles')
        .update({ is_sharing_location: false })
        .eq('id', session.user.id)
        .then(({ error }) => {
          if (error) logger.error('useSocial', 'Error actualizando is_sharing_location en DB', error.message);
        });
    }
  }, [isSharingLocation, session?.user]);

  // 5. Acciones CRUD
  const addFriend = async (email: string) => {
    if (!session?.user) return { error: 'No hay sesión' };
    const cleanEmail = email.trim().toLowerCase();
    // FIX: Validación de formato de email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return { error: 'Email no válido.' };
    if (cleanEmail === session.user.email) return { error: 'No puedes añadirte a ti mismo' };

    try {
      // FIX: Evitamos .single()/.maybeSingle() que a veces causa error 406 (Not Acceptable)
      // Usamos .select().limit(1) para una respuesta JSON estándar.
      console.log('[useSocial] Buscando perfil para:', cleanEmail);
      const { data, error: pError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', cleanEmail)
        .limit(1);
      
      if (pError) {
        console.error('[useSocial] Error buscando perfil:', pError);
        // Si hay error de permisos (406 u otro), seguimos el flujo para invitar
      }

      const profile = data && data.length > 0 ? data[0] : null;
      
      if (profile) {
        console.log('[useSocial] Perfil encontrado:', profile.id);
        const { error } = await supabase.from('friendships').insert({ user_id: session.user.id, friend_id: profile.id, status: 'pending' });
        await fetchFriends();
        return { success: !error, error };
      } else {
        console.log('[useSocial] Perfil no encontrado, enviando invitación a:', cleanEmail);
        // Registrar la invitación en la base de datos
        const { error: invError } = await supabase.from('friend_invitations').upsert({ 
          sender_id: session.user.id, 
          receiver_email: cleanEmail 
        }, { onConflict: 'sender_id, receiver_email' });

        if (invError) {
          console.error('[useSocial] Error al registrar invitación:', invError);
          // Si el error es 409 (Conflicto), probablemente ya existe, pero intentamos enviar el mail igual
        }
        
        // Disparar el envío de correo mediante la Edge Function
        const senderName = session.user.user_metadata?.nickname 
          || session.user.user_metadata?.full_name 
          || session.user.email?.split('@')[0] 
          || 'Un amigo';
          
        logger.info('useSocial', 'Invocando invite-friend para:', cleanEmail);
        
        const { error: fnError } = await supabase.functions.invoke('invite-friend', {
          body: { senderName, receiverEmail: cleanEmail }
        });

        if (fnError) {
          logger.error('useSocial', 'Error al invocar invite-friend', fnError);
        }

        await fetchFriends();
        return { success: true, invited: true };
      }
    } catch (err) {
      logger.error('useSocial', 'Error en addFriend', err);
      return { error: 'Error al añadir amigo.' };
    }
  };

  const removeFriend = async (friendId: string) => {
    if (!session?.user) return { success: false };
    try {
      if (friendId.startsWith('pending-')) {
        await supabase.from('friend_invitations').delete().match({ sender_id: session.user.id, receiver_email: friendId.replace('pending-', '') });
      } else {
        await supabase.from('friendships').delete().or(`and(user_id.eq.${session.user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${session.user.id})`);
      }
      await fetchFriends();
      return { success: true };
    } catch (err) {
      logger.error('useSocial', 'Error en removeFriend', err);
      return { success: false };
    }
  };

  const updateFriendNickname = async (friendId: string, nickname: string) => {
    if (!session?.user) return { success: false };
    // Validación de longitud de apodo
    if (nickname.length > 30) return { success: false, error: 'El apodo no puede tener más de 30 caracteres.' };
    try {
      await supabase.from('friend_nicknames').upsert({ user_id: session.user.id, friend_id: friendId, nickname: nickname.trim() || null });
      await fetchFriends();
      return { success: true };
    } catch (err) {
      logger.error('useSocial', 'Error en updateFriendNickname', err);
      return { success: false };
    }
  };

  const acceptFriend = async (friendId: string) => {
    try {
      await supabase.from('friendships').update({ status: 'accepted' }).match({ user_id: friendId, friend_id: session?.user?.id });
      await fetchFriends();
      return { success: true };
    } catch (err) {
      logger.error('useSocial', 'Error en acceptFriend', err);
      return { success: false };
    }
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
