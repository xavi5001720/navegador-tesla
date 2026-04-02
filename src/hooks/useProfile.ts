'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

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

    const { data, error } = await supabase
      .from('profiles')
      .select('car_name, car_type, car_color, is_sharing_location, avatar_url, email, preferences, last_session_id')
      .eq('id', session.user.id)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
    } else {
      setProfile(data as UserProfile);
    }
    setLoading(false);
  }, [session]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!session?.user) return { success: false, error: 'No hay sesión activa' };

    const { error } = await supabase
      .from('profiles')
      .upsert({ 
        id: session.user.id, 
        email: session.user.email || '',
        ...updates 
      });

    if (error) {
      console.error('Error saving profile to Supabase:', error.message);
      return { success: false, error: error.message };
    }

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
  };

  return { profile, loading, updateProfile, refreshProfile: fetchProfile };
}
