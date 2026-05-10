import { createClient } from '@supabase/supabase-js';

// In demo mode the Supabase client must NEVER reach the production server.
// We point it at a non-routable loopback address so any accidental call fails
// immediately with a network error instead of silently writing to prod.
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

const supabaseUrl = DEMO_MODE
  ? 'http://127.0.0.1:0'              // non-routable – connection always refused
  : (import.meta.env.VITE_SUPABASE_URL as string);

const supabaseAnonKey = DEMO_MODE
  ? 'demo-mode-no-real-key'
  : (import.meta.env.VITE_SUPABASE_ANON_KEY as string);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Disable auto session refresh so the demo client never attempts a network
    // call to restore or refresh an existing Supabase session.
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});
