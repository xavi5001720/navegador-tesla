import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutos
const LOCAL_HIDDEN_KEY = 'navegapro_hidden_radars';

export function useCommunityRadars() {
  const [isReporting, setIsReporting] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [lastReportTime, setLastReportTime] = useState<number>(0);

  // Cargar estado inicial
  useEffect(() => {
    const savedHidden = localStorage.getItem(LOCAL_HIDDEN_KEY);
    if (savedHidden) {
      try {
        setHiddenIds(JSON.parse(savedHidden));
      } catch (e) {
        setHiddenIds([]);
      }
    }

    const savedLastReport = localStorage.getItem('navegapro_last_report_time');
    if (savedLastReport) {
      const time = parseInt(savedLastReport);
      setLastReportTime(time);
      
      const now = Date.now();
      const diff = now - time;
      if (diff < COOLDOWN_MS) {
        setCooldownRemaining(COOLDOWN_MS - diff);
      }
    }
  }, []);

  // Timer para el cooldown
  useEffect(() => {
    if (cooldownRemaining <= 0) return;

    const timer = setInterval(() => {
      setCooldownRemaining(prev => {
        if (prev <= 1000) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  /**
   * Reporta un nuevo radar o confirma uno existente
   */
  const reportRadar = useCallback(async (lat: number, lon: number, userId: string) => {
    if (cooldownRemaining > 0) {
      throw new Error(`Debes esperar ${Math.ceil(cooldownRemaining / 60000)} minutos para reportar de nuevo.`);
    }

    setIsReporting(true);
    try {
      const { data, error } = await supabase.rpc('report_community_radar', {
        p_lat: lat,
        p_lon: lon,
        p_user_id: userId
      });

      if (error) throw error;

      // Actualizar cooldown
      const now = Date.now();
      setLastReportTime(now);
      setCooldownRemaining(COOLDOWN_MS);
      localStorage.setItem('navegapro_last_report_time', now.toString());

      return data;
    } catch (err: any) {
      logger.error('Error al reportar radar comunitario:', err);
      throw err;
    } finally {
      setIsReporting(false);
    }
  }, [cooldownRemaining]);

  /**
   * Vota "Sí" o "No" para un radar
   */
  const voteRadar = useCallback(async (radarId: string, userId: string, type: 'confirm' | 'reject') => {
    try {
      const { error } = await supabase.rpc('vote_community_radar', {
        p_radar_id: radarId,
        p_user_id: userId,
        p_vote_type: type
      });

      if (error) throw error;

      if (type === 'reject') {
        const newHidden = [...hiddenIds, radarId];
        setHiddenIds(newHidden);
        localStorage.setItem(LOCAL_HIDDEN_KEY, JSON.stringify(newHidden));
      }
    } catch (err: any) {
      logger.error('Error al votar radar comunitario:', err);
      throw err;
    }
  }, [hiddenIds]);

  return {
    reportRadar,
    voteRadar,
    isReporting,
    cooldownRemaining,
    hiddenIds
  };
}
