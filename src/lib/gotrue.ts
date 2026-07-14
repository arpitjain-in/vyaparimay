// ─── Vyaparimay – GoTrue (Supabase Auth) REST client ─────────────────────────
// Talks directly to Supabase's Auth REST API (GoTrue) instead of the
// @supabase/supabase-js SDK. Persists the session to localStorage under our
// own key and refreshes it lazily (on-demand, before a request needs it)
// rather than on a background timer, since this app is low-traffic.
//
// NOTE: the exact GoTrue field names below (esp. the /otp request body and
// the error-body field names) are best-effort based on GoTrue's known REST
// surface and have not been checked against a live request. Verify against
// the real Supabase project before relying on wording-sensitive behavior
// (AuthPage.tsx's friendlyError() substring-matches on error .message).

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';

const STORAGE_KEY = 'vyaparimay-auth-session';
const REFRESH_MARGIN_SECONDS = 60;

export interface RestSession {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch seconds
  user: { id: string; email?: string };
}

export class AuthRestError extends Error {
  code?: string;
  status?: number;
  constructor(message: string, opts?: { code?: string; status?: number }) {
    super(message);
    this.name = 'AuthRestError';
    this.code = opts?.code;
    this.status = opts?.status;
  }
}

type AuthChangeEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'INITIAL_SESSION';
type Listener = (event: AuthChangeEvent, session: RestSession | null) => void;

const listeners = new Set<Listener>();
let refreshPromise: Promise<RestSession | null> | null = null;

function readStoredSession(): RestSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RestSession) : null;
  } catch {
    return null;
  }
}

function writeStoredSession(session: RestSession | null): void {
  if (session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function emit(event: AuthChangeEvent, session: RestSession | null): void {
  for (const cb of listeners) cb(event, session);
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    const session = e.newValue ? (JSON.parse(e.newValue) as RestSession) : null;
    emit(session ? 'SIGNED_IN' : 'SIGNED_OUT', session);
  });
}

async function parseErrorBody(res: Response): Promise<AuthRestError> {
  let body: Record<string, unknown> | null = null;
  try {
    body = await res.json();
  } catch {
    // non-JSON body (e.g. an HTML error page) — fall through to generic message
  }
  const message =
    (body?.error_description as string | undefined) ??
    (body?.msg as string | undefined) ??
    (body?.message as string | undefined) ??
    (body?.error as string | undefined) ??
    res.statusText ??
    'Authentication request failed';
  const code = (body?.error_code as string | undefined) ?? (body?.error as string | undefined);
  return new AuthRestError(message, { code, status: res.status });
}

function toSession(body: Record<string, unknown>): RestSession {
  const expiresAt =
    (body.expires_at as number | undefined) ??
    Math.floor(Date.now() / 1000) + ((body.expires_in as number | undefined) ?? 3600);
  return {
    access_token: body.access_token as string,
    refresh_token: body.refresh_token as string,
    expires_at: expiresAt,
    user: body.user as RestSession['user'],
  };
}

async function refreshSession(refreshToken: string): Promise<RestSession | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) {
    // Refresh token itself is dead — treat as signed out rather than throwing.
    writeStoredSession(null);
    emit('SIGNED_OUT', null);
    return null;
  }
  const session = toSession(await res.json());
  writeStoredSession(session);
  emit('TOKEN_REFRESHED', session);
  return session;
}

/** Returns the current session, refreshing it first if it's near expiry. */
export async function getSession(): Promise<RestSession | null> {
  const session = readStoredSession();
  if (!session) return null;

  const nowPlusMargin = Math.floor(Date.now() / 1000) + REFRESH_MARGIN_SECONDS;
  if (session.expires_at > nowPlusMargin) return session;

  if (!refreshPromise) {
    refreshPromise = refreshSession(session.refresh_token).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/** Access token for use in the Authorization header of PostgREST requests. */
export async function getAccessToken(): Promise<string> {
  const session = await getSession();
  return session?.access_token ?? SUPABASE_ANON_KEY;
}

export function onAuthStateChange(cb: Listener): { data: { subscription: { unsubscribe(): void } } } {
  listeners.add(cb);
  return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
}

export async function signInWithOtp(email: string): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/otp?redirect_to=${encodeURIComponent(window.location.origin)}`,
    {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, create_user: true }),
    },
  );
  if (!res.ok) throw await parseErrorBody(res);
}

export async function verifyOtp(email: string, token: string): Promise<RestSession> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'email', email, token }),
  });
  if (!res.ok) throw await parseErrorBody(res);
  const session = toSession(await res.json());
  writeStoredSession(session);
  emit('SIGNED_IN', session);
  return session;
}

export async function signOut(): Promise<void> {
  const session = readStoredSession();
  writeStoredSession(null);
  emit('SIGNED_OUT', null);
  if (!session) return;
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${session.access_token}` },
    });
  } catch {
    // Local session is already cleared; a failed remote logout call isn't actionable here.
  }
}
