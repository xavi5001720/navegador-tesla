import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uhvwptagewswfiluqgmc.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVodndwdGFnZXdzd2ZpbHVxZ21jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MDI4NTEsImV4cCI6MjA5MDM3ODg1MX0.LEygUxMX0zzrkRVv8MJivhPDmy6yp2KIlaU3oICjyAk'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
