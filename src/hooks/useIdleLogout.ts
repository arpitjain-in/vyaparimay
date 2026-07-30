import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;

/** Signs the user out after IDLE_TIMEOUT_MS of no mouse/keyboard/touch activity. */
export function useIdleLogout(enabled: boolean): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        supabase.auth.signOut().catch(() => {
          // Force local sign-out even if the network call fails (e.g. tab was
          // asleep/offline), so the idle logout is never silently swallowed.
          supabase.auth.signOut({ scope: 'local' });
        });
      }, IDLE_TIMEOUT_MS);
    };

    resetTimer();
    ACTIVITY_EVENTS.forEach((event) => document.addEventListener(event, resetTimer));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((event) => document.removeEventListener(event, resetTimer));
    };
  }, [enabled]);
}
