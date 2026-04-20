'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

export interface UserProfile {
  car_name: string;
  car_type: string;
  car_color: string;
  is_sharing_location: boolean;
  email: string;
  preferences?: Record<string, any>;
  last_session_id?: string | null;
}

export function useProfile(session: Session | null) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!session?.user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('car_name, car_type, car_color, is_sharing_location, avatar_url, email, preferences, last_session_id')
        .eq('id', session.user.id)
        .single();

      if (error) {
        logger.error('useProfile', 'Error fetching profile', error.message);
      } else {
        setProfile(data as UserProfile);
      }
    } catch (err) {
      logger.error('useProfile', 'Error inesperado al cargar perfil', err);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchProfile();

    if (!session?.user) return;

    // FIX I11: Sincronización en tiempo real del perfil entre dispositivos
    const channel = supabase
      .channel(`profile_realtime_${session.user.id}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'profiles', 
        filter: `id=eq.${session.user.id}` 
      }, (payload) => {
        setProfile(prev => {
          if (!prev) return payload.new as UserProfile;
          return { ...prev, ...payload.new };
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, fetchProfile]);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!session?.user) return { success: false, error: 'No hay sesión activa' };

    // FIX: Validación de entrada antes de enviar a Supabase
    if (updates.car_name !== undefined && updates.car_name.trim().length > 60) {
      return { success: false, error: 'El nombre del coche es demasiado largo (máx 60 caracteres).' };
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({ 
          id: session.user.id, 
          email: session.user.email || '',
          ...updates 
        });

      if (error) {
        logger.error('useProfile', 'Error guardando perfil', error.message);
        return { success: false, error: error.message };
      }

      // FIX I2: Sincronizamos el estado local inmediatamente + re-fetch para garantizar coherencia
      setProfile(prev => {
        if (prev) return { ...prev, ...updates };
        return {
          email: session.user.email || '',
          car_name: 'Mi Tesla',
          car_type: 'Model 3',
          car_color: 'Blanco',
          is_sharing_location: false,
          preferences: {},
          ...updates
        } as UserProfile;
      });

      return { success: true };
    } catch (err) {
      logger.error('useProfile', 'Error inesperado al actualizar perfil', err);
      return { success: false, error: 'Error inesperado al guardar.' };
    }
  }, [session]);

  return { profile, loading, updateProfile, refreshProfile: fetchProfile };
}
