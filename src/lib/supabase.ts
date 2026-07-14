// ─── Vyaparimay – Supabase REST configuration ────────────────────────────────
// Shared config for the REST clients in postgrest.ts and gotrue.ts.
//
// In demo mode the app must NEVER reach the production server. We point it at
// a non-routable loopback address so any accidental call fails immediately
// with a network error instead of silently writing to prod.

export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

export const SUPABASE_URL = DEMO_MODE
  ? 'http://127.0.0.1:0'              // non-routable – connection always refused
  : (import.meta.env.VITE_SUPABASE_URL as string);

export const SUPABASE_ANON_KEY = DEMO_MODE
  ? 'demo-mode-no-real-key'
  : (import.meta.env.VITE_SUPABASE_ANON_KEY as string);
