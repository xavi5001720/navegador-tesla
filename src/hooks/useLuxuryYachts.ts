import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface YachtPosition {
  mmsi: string;
  name: string;
  owner: string;
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  heading: number;
  nav_status: string | null;
  last_update: string;
  destination: string | null;
}

const SYNC_INTERVAL_MS = 5 * 60 * 60 * 1000; // 5 horas

export function useLuxuryYachts(isEnabled: boolean = false) {
  const [yachts, setYachts] = useState<YachtPosition[]>([]);
  const [loadingYachts, setLoadingYachts] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);

  const fetchYachtData = useCallback(async (triggerSync: boolean = false) => {
    setLoadingYachts(true);
    try {
      if (triggerSync) {
        console.log('[useLuxuryYachts] Iniciando sincronización con API externa...');
        const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-luxury-yachts');
        if (syncError) console.error('[useLuxuryYachts] Error en sync function:', syncError);
        else console.log('[useLuxuryYachts] Sincronización completada:', syncData);
      }

      // Consulta con Join para traer datos del yate y su posición
      const { data, error } = await supabase
        .from('luxury_yacht_positions')
        .select(`
          mmsi,
          latitude,
          longitude,
          speed,
          course,
          heading,
          nav_status,
          last_update,
          destination,
          luxury_yacht_list (
            name,
            owner
          )
        `);

      if (error) throw error;

      if (data) {
        const mappedYachts: YachtPosition[] = data.map((item: any) => ({
          mmsi: item.mmsi,
          latitude: item.latitude,
          longitude: item.longitude,
          speed: item.speed,
          course: item.course,
          heading: item.heading,
          nav_status: item.nav_status,
          last_update: item.last_update,
          destination: item.destination,
          name: item.luxury_yacht_list?.name || 'Yate Desconocido',
          owner: item.luxury_yacht_list?.owner || 'Privado'
        }));

        setYachts(mappedYachts);
        
        // Encontrar la actualización más reciente para marcar el último sync exitoso
        if (mappedYachts.length > 0) {
          const mostRecent = Math.max(...mappedYachts.map(y => new Date(y.last_update).getTime()));
          setLastSyncTime(mostRecent);
        }
      }
    } catch (err) {
      console.error('[useLuxuryYachts] Error fetching yachts:', err);
    } finally {
      setLoadingYachts(false);
    }
  }, []);

  useEffect(() => {
    if (!isEnabled) {
      if (yachts.length > 0) setYachts([]);
      return;
    }

    const checkAndFetch = async () => {
      // 1. Primero traer lo que hay en DB
      await fetchYachtData(false);

      // 2. Comprobar si necesitamos sincronizar con la API real (ha pasado > 5h)
      const now = Date.now();
      
      // Consultamos el timestamp más reciente directamente de la tabla para estar seguros
      const { data: lastUpdateRecord } = await supabase
        .from('luxury_yacht_positions')
        .select('last_update')
        .order('last_update', { ascending: false })
        .limit(1);

      const lastUpdateDB = lastUpdateRecord?.[0]?.last_update 
        ? new Date(lastUpdateRecord[0].last_update).getTime() 
        : 0;

      if (now - lastUpdateDB > SYNC_INTERVAL_MS) {
        await fetchYachtData(true);
      }
    };

    checkAndFetch();

    // Opcional: Re-comprobar cada 15 minutos mientras esté el toggle activo
    const interval = setInterval(checkAndFetch, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isEnabled, fetchYachtData]);

  return { yachts, loadingYachts };
}
