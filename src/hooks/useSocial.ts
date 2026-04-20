// src/hooks/useSocial.ts
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  _speed: number = 0, // speed no se usa pero se mantiene en la firma por compatibilidad
  isSharingLocation: boolean = true, 
  hasLocation: boolean = false
) {
  const [rawFriends, setRawFriends] = useState<Friend[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [livePositions, setLivePositions] = useState<Record<string, LivePosition>>({});
  const [loading, setLoading] = useState(true);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null);
  const isMountedRef = useRef(true);
  const lastSeenRef = useRef<Record<string, number>>({});

  // Refs para telemetría: Evitan que el cambio de posición destruya y recree el canal WebSocket
  const userPosRef = useRef(userPos);
  const headingRef = useRef(heading);
  const isSharingLocationRef = useRef(isSharingLocation);
  const hasLocationRef = useRef(hasLocation);

  // Actualización de refs: Se hace antes de los effects para evitar stale closures
  useEffect(() => {
    userPosRef.current = userPos;
    headingRef.current = heading;
    isSharingLocationRef.current = isSharingLocation;
    hasLocationRef.current = hasLocation;
  }, [userPos, heading, isSharingLocation, hasLocation]);

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
        setRawFriends([...mappedFriends, ...invitedFriends]);
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
  // 3. Función de Sincronización de Ubicación
  const syncLocation = useCallback(async (isInitial = false) => {
    // Leemos de las refs para asegurar que la función sea estable
    const currentPos = userPosRef.current;
    const currentHeading = headingRef.current;
    const currentIsSharing = isSharingLocationRef.current;
    const currentHasLocation = hasLocationRef.current;

    // FIX I10: Comprobación robusta de requisitos para compartir
    if (!session?.user || !currentIsSharing || !currentHasLocation || !currentPos) return;

    // FIX C5: Guard para canal nulo o no conectado
    if (!channelRef.current || channelRef.current.state !== 'joined') {
      // Si estamos en medio de una reconexión, no inundamos el log con warnings.
      // Solo logueamos si ha pasado tiempo desde el último intento exitoso.
      return;
    }
    
    const [lat, lon] = currentPos;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      logger.warn('useSocial', 'Coordenadas inválidas, no se envían.', { lat, lon });
      return;
    }
    
    const now = Date.now();
    
    // Broadcast a amigos conectados
    channelRef.current.send({
      type: 'broadcast',
      event: 'SOCIAL_LOCATION_UPDATE',
      payload: { 
        user_id: session.user.id, 
        lat,
        lon,
        heading: isNaN(currentHeading) ? 0 : currentHeading,
        timestamp: now 
      }
    });

    // Aseguramos que el estado de compartir también se envíe en el broadcast
    channelRef.current.send({
      type: 'broadcast',
      event: 'SOCIAL_STATUS_UPDATE',
      payload: { user_id: session.user.id, is_sharing_location: true }
    });

    logger.info('useSocial', `Ubicación sincronizada (${isInitial ? 'Inicio/Toggle' : 'Bucle'}).`);

    // Persistencia en base de datos
    const { error } = await supabase.from('profiles').update({
      last_lat: lat,
      last_lon: lon,
      is_online: true,
      is_sharing_location: true
    }).eq('id', session.user.id);

    if (error) logger.error('useSocial', 'Error guardando posición en DB', error.message);
  }, [session]); // Dependencia estable: solo cambia si cambia el usuario

  // 4. Ciclo de Vida del Canal Social
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
          const now = Date.now();
          
          Object.keys(state).forEach((key: string) => {
            (state[key] as { key: string }[]).forEach((p: { key: string }) => {
              onlineIds.add(p.key);
              lastSeenRef.current[p.key] = now;
            });
          });
          setOnlineUserIds(onlineIds);
        })
        .on('broadcast', { event: 'SOCIAL_LOCATION_UPDATE' }, ({ payload }) => {
          if (!isMountedRef.current || payload.user_id === session.user.id) return;
          
          // Actualizar lastSeen al recibir broadcast de ubicación
          lastSeenRef.current[payload.user_id] = Date.now();
          
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
          setRawFriends(prev => prev.map(f => 
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
            // FIX I10: Sincronización instantánea tras suscripción exitosa
            syncLocation(true);
          } else if (status === 'CHANNEL_ERROR') {
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
  }, [session, fetchFriends, syncLocation]);

  // 4.5. DERIVACIÓN REACTIVA: Amigos procesados con estado LIVE
  const friends = useMemo(() => {
    return rawFriends.map(f => {
      const isOnline = onlineUserIds.has(f.id);
      const livePos = livePositions[f.id];
      
      // Si tenemos datos en vivo, los priorizamos sobre los de la DB
      return {
        ...f,
        is_online: isOnline,
        last_lat: livePos?.lat ?? f.last_lat,
        last_lon: livePos?.lon ?? f.last_lon,
        heading: livePos?.heading ?? f.heading,
        updated_at: livePos?.timestamp ? new Date(livePos.timestamp).toISOString() : f.updated_at
      } as Friend;
    });
  }, [rawFriends, onlineUserIds, livePositions]);

  // 5. Emisión de Posición Periódica (Cada 5 minutos)
  // FIX: El intervalo NO debe depender de userPos/heading, 
  // de lo contrario se destruye y recrea 3 veces por segundo y nunca llega a dispararse.
  useEffect(() => {
    if (!session?.user) return;

    const senderLoop = setInterval(() => {
      syncLocation();
    }, 300000);

    return () => clearInterval(senderLoop);
  }, [session, syncLocation]);

  // 6. GESTIÓN DE PRIVACIDAD: Reacción instantánea al interruptor (Toggle)
  useEffect(() => {
    if (!session?.user || !isMountedRef.current) return;

    if (isSharingLocation) {
      if (hasLocation) {
        logger.info('useSocial', 'Privacidad: Compartir ACTIVADO. Sincronizando...');
        syncLocation(true);
      }
    } else {
      logger.info('useSocial', 'Privacidad: Compartir DESACTIVADO. Notificando a red...');
      
      // Notificar apagado instantáneo vía Broadcast (si hay canal)
      if (channelRef.current && channelRef.current.state === 'joined') {
        channelRef.current.send({
          type: 'broadcast',
          event: 'SOCIAL_STATUS_UPDATE',
          payload: { user_id: session.user.id, is_sharing_location: false }
        });
      }

      // Asegurar que la DB también refleja el apagado (por si el broadcast falla o no hay nadie)
      supabase.from('profiles')
        .update({ is_sharing_location: false })
        .eq('id', session.user.id)
        .then(({ error }) => {
          if (error) logger.error('useSocial', 'Error al apagar sharing en DB', error.message);
        });
    }
  }, [isSharingLocation, hasLocation, session?.user, syncLocation]);


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
        const { error } = await supabase.from('friendships').insert({ user_id: session.user.id, friend_id: profile.id, status: 'pending' });
        await fetchFriends();
        return { success: !error, error };
      } else {
        // Registrar la invitación en la base de datos
        // NOTA: Si este paso falla, asegúrate de haber ejecutado el SQL del parche.
        const { error: invError } = await supabase.from('friend_invitations').upsert({ 
          sender_id: session.user.id, 
          receiver_email: cleanEmail 
        }, { onConflict: 'sender_id, receiver_email' });

        if (invError) {
          console.warn('[useSocial] Aviso/Error en upsert invitación:', invError.message);
          // Continuamos de todos modos por si la invitación ya existía
        }
        
        // Disparar el envío de correo mediante la Edge Function
        const senderName = session.user.user_metadata?.nickname 
          || session.user.user_metadata?.full_name 
          || session.user.email?.split('@')[0] 
          || 'Un amigo';
          
        console.log('[useSocial] Invocando invite-friend para:', cleanEmail, 'Remitente:', senderName);
        
        try {
          await supabase.functions.invoke('invite-friend', {
            body: { senderName, receiverEmail: cleanEmail }
          });
        } catch (err) {
          console.warn('[useSocial] Error invocando invite-friend (Edge Function):', err);
        }

        await fetchFriends();
        return { success: true, invited: true };
      }
    } catch (err) {
      console.error('[useSocial] Error general en addFriend:', err);
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

  // Mapeo final para el mapa con GRACE PERIOD (Evita parpadeo por micro-desconexiones)
  const enhancedFriends = friends.map(f => {
    const isActuallyInPresence = onlineUserIds.has(f.id);
    const lastSeen = lastSeenRef.current[f.id] || 0;
    const isSeenRecently = (Date.now() - lastSeen) < 15000; // 15 segundos de gracia
    
    return {
      ...f,
      is_online: f.friendship_status === 'accepted' && (isActuallyInPresence || isSeenRecently),
      last_lat: livePositions[f.id]?.lat ?? f.last_lat,
      last_lon: livePositions[f.id]?.lon ?? f.last_lon,
      heading: livePositions[f.id]?.heading ?? 0
    };
  });

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
