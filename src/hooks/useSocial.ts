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

export function useSocial(session: Session | null, userPos: [number, number], isSharingLocation: boolean = true, hasLocation: boolean = false) {
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
      
      // 1.1. Obtener nuestros apodos privados (Agenda Personal)
      const { data: privateNicknames } = await supabase
        .from('friend_nicknames')
        .select('friend_id, nickname')
        .eq('user_id', session.user.id);

      const nicknamesMap: Record<string, string> = {};
      (privateNicknames || []).forEach(n => {
        nicknamesMap[n.friend_id] = n.nickname;
      });
      
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
          // El apodo viene de nuestra tabla privada, no de friendships
          friendInfoMap[friendId] = { 
            status, 
            is_incoming: isIncoming, 
            nickname: nicknamesMap[friendId] || undefined 
          };
        }
      });

      const friendIds = Object.keys(friendInfoMap);

      // 4. Obtener perfiles de los amigos registrados
      let mappedFriends: Friend[] = [];
      if (friendIds.length > 0) {
        console.log('[useSocial] Fetching profiles for IDs:', friendIds);
        const { data: profiles, error: pError } = await supabase
          .from('profiles')
          .select('id, email, car_name, car_color, is_online, last_lat, last_lon, avatar_url, full_name, preferences, last_session_id, is_sharing_location, current_destination, current_waypoints')
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
        car_name: `Invitado (${inv.receiver_email})`,
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
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ key: session.user.id, online_at: new Date().toISOString() });
        }
      });

    channelRef.current = channel;

    // 2. Escuchar cambios en la base de datos (Realtime - Debounced)
    let fetchTimeout: NodeJS.Timeout;
    const debouncedFetch = () => {
      clearTimeout(fetchTimeout);
      fetchTimeout = setTimeout(() => fetchFriends(), 5000); // Debounce de 5s
    };

    const dbChannel = supabase.channel('garage_db_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => debouncedFetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_invitations' }, () => debouncedFetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_nicknames' }, () => debouncedFetch())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(dbChannel);
      clearTimeout(fetchTimeout);
    };
  }, [session, fetchFriends]);

  const lastBroadcastPosRef = useRef<[number, number] | null>(null);
  const lastBroadcastTimeRef = useRef<number>(0);

  // 3. Persistencia de ubicación y Broadcast (Bajo Consumo)
  useEffect(() => {
    if (!session?.user || !userPos) return;
    
    // SEGURIDAD: Si no tenemos ubicación confirmada (GPS/WiFi), no mandamos NADA.
    // Esto evita que tus amigos te vean en Madrid por error al arrancar.
    if (!hasLocation) return;

    // SI EL USUARIO NO COMPARTE EXPLICITAMENTE, NO MANDAMOS NADA (Ahorro total de créditos y privacidad)
    if (isSharingLocation === false) return;

    // Ahorro de datos: Si la pestaña no es visible, NO gastamos créditos de Supabase
    if (document.visibilityState !== 'visible') return;

    const now = Date.now();
    
    // A. Actualización en Base de Datos (Persistencia inmediata al inicio o cada 30 seg)
    // Reducimos de 120s a 30s para que la sincronización inicial sea infalible.
    if (lastDbUpdateRef.current === 0 || now - lastDbUpdateRef.current > 30000) {
      console.log(`[useSocial] 🛰️ Sincronizando posición en DB de forma prioritaria: ${userPos[0]}, ${userPos[1]}`);
      
      supabase.from('profiles').update({
        last_lat: userPos[0],
        last_lon: userPos[1],
        is_online: true
      }).eq('id', session.user.id)
      .then(({ error }) => {
        if (!error) console.log('[useSocial] ✅ DB actualizada con Gerona.');
      });
      
      lastDbUpdateRef.current = now;
    }

    // B. Broadcast Realtime (Frecuencia de emergencia)
    if (channelRef.current && channelRef.current.state === 'joined') {
      let shouldBroadcast = false;

      if (!lastBroadcastPosRef.current) {
        shouldBroadcast = true;
      } else {
        const latDiff = userPos[0] - lastBroadcastPosRef.current[0];
        const lonDiff = userPos[1] - lastBroadcastPosRef.current[1];
        const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff) * 111320;
        
        // --- AJUSTE DE RESPUESTA ---
        // 1. Se ha movido > 10 metros (Antes eran 250m, demasiado para una ciudad)
        // 2. O si han pasado > 20 segundos (Heartbeat activo para evitar que el teléfono pierda la señal)
        if (distance > 10 || (now - lastBroadcastTimeRef.current > 20000)) {
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
    
    // Nueva verificación: ¿Ya está en nuestra lista local de amigos (pendiente o aceptado)?
    const alreadyInList = friends.find(f => f.email?.toLowerCase() === cleanEmail);
    if (alreadyInList) {
      return { error: 'Tu amigo ya estaba en la lista de amigos' };
    }

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
        return await acceptFriend(profile.id);
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

  const acceptFriend = async (friendId: string): Promise<{ success: boolean; error?: any }> => {
    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .match({ user_id: friendId, friend_id: session?.user?.id });
      
      await fetchFriends();
      return { success: !error, error };
    } catch (err) {
      return { success: false, error: err };
    }
  };

  const removeFriend = async (friendId: string): Promise<{ success: boolean; error?: any }> => {
    if (!session?.user) return { success: false, error: 'No hay sesión' };

    try {
      if (friendId.startsWith('pending-')) {
        // Invitación a mail no registrado
        const email = friendId.replace('pending-', '');
        const { error } = await supabase
          .from('friend_invitations')
          .delete()
          .match({ sender_id: session.user.id, receiver_email: email });
        
        await fetchFriends();
        return { success: !error, error };
      }

      // Amistad o solicitud entre usuarios registrados
      const { error } = await supabase
        .from('friendships')
        .delete()
        .or(`and(user_id.eq.${session.user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${session.user.id})`);
      
      await fetchFriends();
      return { success: !error, error };
    } catch (err) {
      return { success: false, error: err };
    }
  };

  const updateFriendNickname = async (friendId: string, nickname: string): Promise<{ success: boolean; error?: any }> => {
    if (!session?.user) return { success: false, error: 'No hay sesión' };
    
    console.log(`[useSocial] Guardando apodo privado para ${friendId}: ${nickname}`);
    
    // Usamos upsert en nuestra propia tabla de apodos
    const { error } = await supabase
      .from('friend_nicknames')
      .upsert({ 
        user_id: session.user.id, 
        friend_id: friendId, 
        nickname: nickname || null 
      }, { onConflict: 'user_id,friend_id' });

    await fetchFriends();
    return { success: !error, error };
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
    refreshFriends: fetchFriends 
  };
}
