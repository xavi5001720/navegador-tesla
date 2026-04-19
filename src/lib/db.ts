import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface TeslaDB extends DBSchema {
  radars: {
    key: string; // "lat_lon_grid" or "route_chunk_id"
    value: {
      data: any[];
      timestamp: number;
    };
  };
  gas_stations: {
    key: string;
    value: {
      data: any[];
      timestamp: number;
    };
  };
}

const DB_NAME = 'tesla_nav_cache';
const DB_VERSION = 1;
const TTL = 24 * 60 * 60 * 1000; // 24 horas en ms

let dbPromise: Promise<IDBPDatabase<TeslaDB>> | null = null;

const getDB = () => {
  if (typeof window === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB<TeslaDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('radars');
        db.createObjectStore('gas_stations');
      },
    });
  }
  return dbPromise;
};

export const cacheService = {
  async get(store: 'radars' | 'gas_stations', key: string) {
    const db = await getDB();
    if (!db) return null;
    const cached = await db.get(store, key);
    if (!cached) return null;
    
    // Verificar TTL
    if (Date.now() - cached.timestamp > TTL) {
      await db.delete(store, key);
      return null;
    }
    return cached.data;
  },

  async set(store: 'radars' | 'gas_stations', key: string, data: any[]) {
    const db = await getDB();
    if (!db) return;
    await db.put(store, {
      data,
      timestamp: Date.now(),
    }, key);
  },

  async clearOld() {
    const db = await getDB();
    if (!db) return;
    const stores: ('radars' | 'gas_stations')[] = ['radars', 'gas_stations'];
    for (const s of stores) {
      const keys = await db.getAllKeys(s);
      for (const k of keys) {
        const item = await db.get(s, k);
        if (item && Date.now() - item.timestamp > TTL) {
          await db.delete(s, k);
        }
      }
    }
  }
};
