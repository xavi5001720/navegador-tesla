// src/hooks/useSocial.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { getDistance } from '@/utils/geo';

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

export interface Breadcrumb {
  lat: number;
  lon: number;
  t: number;      // Timestamp
  h?: number;     // Heading (opcional)
  s?: number;     // Speed (opcional)
}

export interface LivePosition {
  lat: number;
  lon: number;
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
  const [friendBatches, setFriendBatches] = useState<Record<string, Breadcrumb[]>>({});
  
  // Refs para el sistema adaptativo
  const lastDbUpdateRef = useRef<number>(0);
  const channelRef = useRef<any>(null);
  const lastBroadcastTimeRef = useRef<number>(0);
  const trajectoryBufferRef = useRef<Breadcrumb[]>([]);
  const lastCapturedPosRef = useRef<[number, number] | null>(null);

  // Estadísticas de observabilidad (desarrollo)
  const messageCounterRef = useRef({ total: 0, z1: 0, z3: 0 });

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
      .on('broadcast', { event: 'PATH_BATCH' }, ({ payload }) => {
        if (payload.user_id === session.user.id) return;
        
        if (payload.points && payload.points.length > 0) {
          setFriendBatches(prev => {
            const current = prev[payload.user_id] || [];
            const lastT = current.length > 0 ? current[current.length - 1].t : 0;
            
            // Solo añadimos los puntos que sean nuevos (timestamp mayor que el último)
            const newPoints = payload.points.filter((p: Breadcrumb) => p.t > lastT);
            
            if (newPoints.length === 0) return prev;

            const next = [...current, ...newPoints];
            
            // Limitamos a los últimos 60 segundos de datos recibidos para el buffer de reproducción
            const now = Date.now();
            return {
              ...prev,
              [payload.user_id]: next.filter(p => p.t > now - 60000)
            };
          });

          // Compatibilidad básica
          const lastPoint = payload.points[payload.points.length - 1];
          setLivePositions(prev => ({
            ...prev,
            [payload.user_id]: {
              lat: lastPoint.lat,
              lon: lastPoint.lon,
              timestamp: lastPoint.t
            }
          }));
        }
      })
      .on('broadcast', { event: 'location' }, ({ payload }) => {
        // Compatibilidad con versiones antiguas o control de visibilidad
        if (payload.is_sharing === false) {
          setFriends(prev => prev.map(f => f.id === payload.user_id ? { ...f, is_sharing_location: false } : f));
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

  // 3. Captura continua de Trayectoria (Buffer)
  useEffect(() => {
    if (!hasLocation || !userPos) return;

    const now = Date.now();
    
    // Capturamos un punto si ha pasado al menos 1 segundo o nos hemos movido algo
    const lastPos = lastCapturedPosRef.current;
    const dist = lastPos ? getDistance(userPos, lastPos) : Infinity;

    if (dist > 1 || !lastPos) {
      trajectoryBufferRef.current.push({
        lat: userPos[0],
        lon: userPos[1],
        t: now,
        h: heading,
        s: speed
      });
      lastCapturedPosRef.current = userPos;

      // Limmitamos el buffer local a los últimos 2 minutos para no saturar memoria
      if (trajectoryBufferRef.current.length > 120) {
        trajectoryBufferRef.current = trajectoryBufferRef.current.slice(-120);
      }
    }
  }, [userPos, heading, speed, hasLocation]);

  // 4. Emisión Adaptativa (Frecuencia por Zona Dominante)
  useEffect(() => {
    if (!session?.user || !isSharingLocation || !hasLocation || !userPos) return;

    const senderLoop = setInterval(() => {
      const now = Date.now();
      const onlineFriends = friends.filter(f => onlineUserIds.has(f.id));
      
      // Si no hay amigos online, mandamos cada 60s forzado para actualizar presencia en DB
      if (onlineFriends.length === 0) {
        if (now - lastBroadcastTimeRef.current > 60000) {
          flushBatch(60000, 'Z3 (Idle)');
        }
        return;
      }

      // 1. Encontrar la zona dominante (amigo más cercano)
      let minDist = Infinity;
      onlineFriends.forEach(f => {
        if (f.last_lat && f.last_lon) {
          const d = getDistance(userPos, [f.last_lat, f.last_lon]);
          if (d < minDist) minDist = d;
        }
      });

      // 2. Determinar intervalo
      let interval = 20000; // Zona 3 por defecto
      let zoneLabel = 'Z3';
      
      if (minDist < 200) {
        interval = 4000;
        zoneLabel = 'Z1';
      } else if (minDist < 2000) {
        interval = 12000;
        zoneLabel = 'Z2';
      }

      // 3. Verificar si toca enviar
      if (now - lastBroadcastTimeRef.current >= interval) {
        flushBatch(interval, zoneLabel);
      }

    }, 1000);

    function flushBatch(interval: number, zone: string) {
      if (!channelRef.current || channelRef.current.state !== 'joined') return;
      
      const now = Date.now();
      // Ventana: desde el último envío menos 5 segundos de solapamiento
      const windowStart = lastBroadcastTimeRef.current - 5000;
      const batch = trajectoryBufferRef.current.filter(p => p.t >= windowStart);

      if (batch.length > 0) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'PATH_BATCH',
          payload: { 
            user_id: session?.user?.id, 
            points: batch, 
            zone: zone,
            timestamp: now 
          }
        });

        // Telemetría
        messageCounterRef.current.total++;
        if (zone === 'Z1') messageCounterRef.current.z1++;
        else messageCounterRef.current.z3++;
        console.log(`[Realtime Opt] Batch ${zone} enviado (${batch.length} pts). Total msgs: ${messageCounterRef.current.total}`);
        
        lastBroadcastTimeRef.current = now;

        // Persistencia lenta en DB (cada 2 minutos)
        if (now - lastDbUpdateRef.current > 120000) {
          supabase.from('profiles').update({
            last_lat: userPos[0],
            last_lon: userPos[1],
            is_online: true,
            is_sharing_location: true
          }).eq('id', session?.user?.id).then();
          lastDbUpdateRef.current = now;
        }
      }
    }

    return () => clearInterval(senderLoop);
  }, [session, friends, onlineUserIds, userPos, isSharingLocation, hasLocation]);

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
  }));

  return { 
    friends: enhancedFriends, 
    loading, 
    addFriend, 
    removeFriend, 
    acceptFriend, 
    updateFriendNickname, 
    refreshFriends: fetchFriends,
    friendBatches 
  };
}
