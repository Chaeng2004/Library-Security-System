import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '')
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // [SESSION-TIMEOUT] persistSession keeps tokens alive across page refreshes;
    // the idle-timeout hook (useIdleTimeout) is responsible for explicit termination.
    persistSession: true,
    autoRefreshToken: true,
  },
})
