import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabase', () => ({
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key-123',
}));

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const STORAGE_KEY = 'vyaparimay-auth-session';

describe('gotrue client', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let gotrue: typeof import('../../lib/gotrue');

  beforeEach(async () => {
    vi.resetModules();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    localStorage.clear();
    gotrue = await import('../../lib/gotrue');
  });

  it('signInWithOtp posts to /auth/v1/otp with create_user and a redirect_to', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    await gotrue.signInWithOtp('user@example.com');
    const [url, init] = fetchMock.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/auth/v1/otp');
    expect(parsed.searchParams.get('redirect_to')).toBeTruthy();
    expect(init.headers.apikey).toBe('anon-key-123');
    expect(JSON.parse(init.body)).toEqual({ email: 'user@example.com', create_user: true });
  });

  it('verifyOtp posts to /auth/v1/verify, persists the session, and emits SIGNED_IN', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, user: { id: 'u1', email: 'user@example.com' } }),
    );
    const listener = vi.fn();
    gotrue.onAuthStateChange(listener);

    const session = await gotrue.verifyOtp('user@example.com', '12345678');

    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url).pathname).toBe('/auth/v1/verify');
    expect(JSON.parse(init.body)).toEqual({ type: 'email', email: 'user@example.com', token: '12345678' });
    expect(session.access_token).toBe('at');
    expect(listener).toHaveBeenCalledWith('SIGNED_IN', expect.objectContaining({ access_token: 'at' }));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).access_token).toBe('at');
  });

  it('getSession returns null when nothing is stored', async () => {
    expect(await gotrue.getSession()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('getSession returns the stored session without refreshing when not near expiry', async () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ access_token: 'at', refresh_token: 'rt', expires_at: future, user: { id: 'u1' } }));

    const session = await gotrue.getSession();

    expect(session?.access_token).toBe('at');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes exactly once when near expiry, even under concurrent callers', async () => {
    const soon = Math.floor(Date.now() / 1000) + 10; // inside the refresh margin
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ access_token: 'old', refresh_token: 'rt', expires_at: soon, user: { id: 'u1' } }));
    fetchMock.mockResolvedValue(jsonResponse({ access_token: 'new', refresh_token: 'rt2', expires_in: 3600, user: { id: 'u1' } }));

    const [a, b] = await Promise.all([gotrue.getSession(), gotrue.getSession()]);

    expect(a?.access_token).toBe('new');
    expect(b?.access_token).toBe('new');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(new URL(url).pathname).toBe('/auth/v1/token');
    expect(new URL(url).searchParams.get('grant_type')).toBe('refresh_token');
  });

  it('treats a failed refresh as signed-out rather than throwing', async () => {
    const expired = Math.floor(Date.now() / 1000) - 10;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ access_token: 'old', refresh_token: 'dead', expires_at: expired, user: { id: 'u1' } }));
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }));
    const listener = vi.fn();
    gotrue.onAuthStateChange(listener);

    const session = await gotrue.getSession();

    expect(session).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(listener).toHaveBeenCalledWith('SIGNED_OUT', null);
  });

  it('getAccessToken falls back to the anon key when there is no session', async () => {
    expect(await gotrue.getAccessToken()).toBe('anon-key-123');
  });

  it('signOut clears the local session, calls /auth/v1/logout, and emits SIGNED_OUT', async () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ access_token: 'at', refresh_token: 'rt', expires_at: future, user: { id: 'u1' } }));
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const listener = vi.fn();
    gotrue.onAuthStateChange(listener);

    await gotrue.signOut();

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(listener).toHaveBeenCalledWith('SIGNED_OUT', null);
    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url).pathname).toBe('/auth/v1/logout');
    expect(init.headers.Authorization).toBe('Bearer at');
  });

  it('onAuthStateChange fires when another tab writes a new session (storage event)', () => {
    const listener = vi.fn();
    gotrue.onAuthStateChange(listener);
    const future = Math.floor(Date.now() / 1000) + 3600;
    const newSession = { access_token: 'at2', refresh_token: 'rt2', expires_at: future, user: { id: 'u2' } };

    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: JSON.stringify(newSession) }));

    expect(listener).toHaveBeenCalledWith('SIGNED_IN', expect.objectContaining({ access_token: 'at2' }));
  });

  it('unsubscribe stops further events from being delivered', async () => {
    const listener = vi.fn();
    const { data } = gotrue.onAuthStateChange(listener);
    data.subscription.unsubscribe();

    await gotrue.signOut();

    expect(listener).not.toHaveBeenCalled();
  });

  it('throws a real Error (AuthRestError) with message from the response body', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ msg: 'Invalid or expired code' }), { status: 400 }));

    await expect(gotrue.verifyOtp('user@example.com', '000000')).rejects.toMatchObject({ message: 'Invalid or expired code' });
    try {
      await gotrue.verifyOtp('user@example.com', '000000');
      throw new Error('expected verifyOtp to reject');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
    }
  });
});
