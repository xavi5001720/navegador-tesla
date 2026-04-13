// Supabase Connection V3.0 - Auth Hardened
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist the session in localStorage (default) but always validate it on load
    persistSession: true,
    // Automatically refresh the token before it expires
    autoRefreshToken: true,
    // Detect session from URL (needed for OAuth/magic link callbacks)
    detectSessionInUrl: true,
    // Storage key used in localStorage - explicit so we can clear it if needed
    storageKey: 'navegapro-auth-token',
  }
})

/**
 * Wipes all Supabase auth data from localStorage.
 * Call this when a session appears corrupted or invalid.
 */
export function clearSupabaseAuthStorage() {
  if (typeof window === 'undefined') return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('navegapro-auth-token') || key.startsWith('sb-'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
  console.log('[Auth] Limpieza de localStorage completada:', keysToRemove);
}
