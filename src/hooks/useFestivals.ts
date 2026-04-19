import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface Festival {
  id: string;
  name: string;
  country: string;
  region: string;
  city: string;
  description: string;
  dates_approx: string;
  rating: number;
  unique_reason: string;
  lat: number;
  lon: number;
  start_month: number;
  start_day: number;
  end_month: number;
  end_day: number;
}

export function useFestivals(enabled: boolean) {
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setFestivals([]);
      return;
    }

    const fetchFestivals = async () => {
      setLoading(true);
      try {
        const now = new Date();
        const currentMonth = now.getMonth() + 1; // 1-12
        const nextMonth = (currentMonth % 12) + 1;

        // Fetch festivals for the current month and the next one
        const { data, error } = await supabase
          .from('festivals')
          .select('*')
          .or(`start_month.eq.${currentMonth},start_month.eq.${nextMonth}`);

        if (error) throw error;
        setFestivals(data || []);
      } catch (err) {
        console.error('Error fetching festivals:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFestivals();
  }, [enabled]);

  return { festivals, loading };
}
