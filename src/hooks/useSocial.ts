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
  nickname?: string;
  current_destination?: any;
  current_waypoints?: any[];
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
        .select('user_id, friend_id, status, nickname')
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

      // 3. Procesar amistades (Deduplicando y priorizando 'accepted')
      const friendInfoMap: Record<string, { status: 'pending' | 'accepted', is_incoming: boolean, nickname?: string }> = {};
      
      (friendships || []).forEach(f => {
        const friendId = f.user_id === session.user.id ? f.friend_id : f.user_id;
        const status = f.status as 'pending' | 'accepted';
        const isIncoming = f.friend_id === session.user.id && status === 'pending';
        
        // Priorizar aceptado si ya existe el ID
        if (!friendInfoMap[friendId] || status === 'accepted') {
          friendInfoMap[friendId] = { status, is_incoming: isIncoming, nickname: f.nickname || undefined };
        }
      });

      const friendIds = Object.keys(friendInfoMap);

      // 4. Obtener perfiles de los amigos registrados
      let mappedFriends: Friend[] = [];
      if (friendIds.length > 0) {
        console.log('[useSocial] Fetching profiles for IDs:', friendIds);
        const { data: profiles, error: pError } = await supabase
          .from('profiles')
          .select('id, email, car_name, car_color, is_online, last_lat, last_lon, is_sharing_location, current_destination, current_waypoints')
          .in('id', friendIds);

        if (pError) {
          console.error('[useSocial] Error fetching profiles:', pError);
        } else {
          console.log('[useSocial] Found profiles:', profiles?.length || 0);
          mappedFriends = (profiles || []).map(p => {
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

      // 5. Agregar las invitaciones "en el aire"
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

  // ── Sincronización Realtime ──────────────────────────────────────────────
  useEffect(() => {
    if (!session?.user) return;

    // 1. Canal de presencia para estados online y posiciones live
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
      .on('broadcast', { event: 'location' }, ({ payload }) => {
        setLivePositions(prev => ({
          ...prev,
          [payload.userId]: {
            lat: payload.lat,
            lon: payload.lon,
            timestamp: Date.now()
          }
        }));
      })
      .on('broadcast', { event: 'convoy_join' }, ({ payload }) => {
        // Solo nos interesa si nosotros somos el líder (o si queremos enterarnos de quién se une a quién)
        if (payload.leaderId === session.user.id) {
          console.info(`[Convoy] ${payload.userName} se ha unido a tu viaje.`);
          // Disparar evento global para UI
          window.dispatchEvent(new CustomEvent('tesla-convoy-notification', { 
            detail: { type: 'join', userName: payload.userName } 
          }));
        }
      })
      .on('broadcast', { event: 'convoy_leave' }, ({ payload }) => {
        if (payload.leaderId === session.user.id) {
          console.info(`[Convoy] Un amigo ha dejado tu viaje.`);
          window.dispatchEvent(new CustomEvent('tesla-convoy-notification', { 
            detail: { type: 'leave' } 
          }));
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ key: session.user.id, online_at: new Date().toISOString() });
        }
      });

    channelRef.current = channel;

    // 2. Escuchar cambios en la base de datos (Realtime)
    const dbChannel = supabase.channel('garage_db_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => fetchFriends())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_invitations' }, () => fetchFriends())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(dbChannel);
    };
  }, [session, fetchFriends]);

  const lastBroadcastPosRef = useRef<[number, number] | null>(null);
  const lastBroadcastTimeRef = useRef<number>(0);

  // 3. Persistencia de ubicación y Broadcast (Bajo Consumo)
  useEffect(() => {
    if (!session?.user || !userPos) return;

    const now = Date.now();
    
    // A. Actualización en Base de Datos (Persistencia cada 30-45s)
    if (now - lastDbUpdateRef.current > 45000) {
      supabase.from('profiles').update({
        last_lat: userPos[0],
        last_lon: userPos[1],
        is_online: true
      }).eq('id', session.user.id).then();
      lastDbUpdateRef.current = now;
    }

    // B. Broadcast Realtime (Frecuente pero optimizado)
    if (channelRef.current && channelRef.current.state === 'joined') {
      let shouldBroadcast = false;

      if (!lastBroadcastPosRef.current) {
        shouldBroadcast = true;
      } else {
        // Cálculo de distancia aproximada (euclídea simple para eficiencia)
        const latDiff = userPos[0] - lastBroadcastPosRef.current[0];
        const lonDiff = userPos[1] - lastBroadcastPosRef.current[1];
        // ~111,320 metros por grado de latitud
        const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff) * 111320;
        
        // Solo emitir si:
        // 1. Se ha movido > 15 metros
        // 2. O si han pasado > 10 segundos desde el último broadcast
        if (distance > 15 || (now - lastBroadcastTimeRef.current > 10000)) {
          shouldBroadcast = true;
        }
      }

      if (shouldBroadcast) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'location',
          payload: { userId: session.user.id, lat: userPos[0], lon: userPos[1] }
        });
        lastBroadcastPosRef.current = userPos;
        lastBroadcastTimeRef.current = now;
      }
    }
  }, [userPos, session]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const addFriend = async (email: string): Promise<{ success?: boolean; accepted?: boolean; invited?: boolean; error?: any }> => {
    if (!session?.user) return { error: 'No hay sesión activa' };
    
    console.log(`[useSocial] Intentando invitar/añadir: ${email}`);
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
      return { success: !error, accepted: false, error };
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
    // ... (existing code)
  };

  const removeFriend = async (friendId: string) => {
    // ... (existing code)
  };

  const updateFriendNickname = async (friendId: string, nickname: string) => {
    if (!session?.user) return { error: 'No hay sesión' };
    
    console.log(`[useSocial] Actualizando apodo para ${friendId}: ${nickname}`);
    const { error } = await supabase
      .from('friendships')
      .update({ nickname: nickname || null })
      .or(`and(user_id.eq.${session.user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${session.user.id})`);

    await fetchFriends();
    return { success: !error, error };
  };

  const joinConvoy = async (friendId: string) => {
    if (!session?.user || !channelRef.current) return;
    
    console.log(`[useSocial] Notificando unión al convoy de ${friendId}`);
    channelRef.current.send({
      type: 'broadcast',
      event: 'convoy_join',
      payload: { 
        userId: session.user.id, 
        leaderId: friendId,
        userName: (await supabase.from('profiles').select('car_name').eq('id', session.user.id).single()).data?.car_name || session.user.email
      }
    });
  };

  const leaveConvoy = async (friendId: string) => {
    if (!session?.user || !channelRef.current) return;
    
    console.log(`[useSocial] Notificando salida del convoy de ${friendId}`);
    channelRef.current.send({
      type: 'broadcast',
      event: 'convoy_leave',
      payload: { userId: session.user.id, leaderId: friendId }
    });
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
    updateFriendNickname,
    joinConvoy,
    leaveConvoy,
    refreshFriends: fetchFriends 
  };
}
