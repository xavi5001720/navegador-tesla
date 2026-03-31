'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

export interface UserProfile {
  car_name: string;
  car_type: string;
  car_color: string;
  is_sharing_location: boolean;
  avatar_url?: string;
  email: string;
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
      .select('car_name, car_type, car_color, is_sharing_location, avatar_url, email')
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
    if (!session?.user) return;

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', session.user.id);

    if (error) {
      console.error('Error updating profile:', error);
      return false;
    }

    setProfile(prev => prev ? { ...prev, ...updates } : null);
    return true;
  };

  return { profile, loading, updateProfile, refreshProfile: fetchProfile };
}
