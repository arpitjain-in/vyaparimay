// ─── Vyaparimay – PostgREST (Supabase Data API) REST client ─────────────────
// Talks directly to Supabase's auto-generated REST API (PostgREST) instead of
// the @supabase/supabase-js query builder. Deliberately a thin set of
// options-bag helpers rather than a fluent builder — db.ts's usage reduces to
// a small fixed set of patterns (eq-filters, one .or() search, one .order(),
// one .range()+count, one .maybeSingle(), one embedded-resource select),
// which this options bag covers directly.
//
// NOTE: the .or() ilike wildcard translation and the maybeSingle() "0 rows"
// error code below are best-effort based on PostgREST's documented behavior
// and have not been checked against the live project's PostgREST version.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';
import { getAccessToken } from './gotrue';

// Plain-object error shape — deliberately NOT an Error subclass, matching
// @supabase/supabase-js's PostgrestError shape that src/store/useStore.ts's
// fmtErr() already special-cases (see its comment at line 18).
export class PostgrestRestError {
  message: string;
  details: string | null;
  hint: string | null;
  code: string | null;
  constructor(body: { message?: string; details?: string; hint?: string; code?: string }, status: number) {
    this.message = body.message ?? `Request failed with status ${status}`;
    this.details = body.details ?? null;
    this.hint = body.hint ?? null;
    this.code = body.code ?? null;
  }
}

const NO_ROWS_CODE = 'PGRST116';

export interface PgOptions {
  select?: string; // default '*'; e.g. '*, invoice_items(*)'
  eq?: Record<string, string | number | boolean>;
  or?: string; // raw PostgREST or-expression, without the surrounding parens
  order?: { column: string; ascending?: boolean };
  range?: { from: number; to: number }; // implies count: 'exact'
  maybeSingle?: boolean;
}

async function buildHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const accessToken = await getAccessToken();
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

function buildUrl(table: string, opts?: PgOptions): string {
  const params = new URLSearchParams();
  params.set('select', opts?.select ?? '*');
  if (opts?.eq) {
    for (const [col, val] of Object.entries(opts.eq)) params.append(col, `eq.${val}`);
  }
  if (opts?.or) {
    params.set('or', `(${opts.or})`);
  }
  if (opts?.order) {
    params.set('order', `${opts.order.column}.${opts.order.ascending === false ? 'desc' : 'asc'}`);
  }
  return `${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`;
}

async function throwIfError(res: Response): Promise<void> {
  if (res.ok) return;
  let body: Record<string, unknown> = {};
  try {
    body = await res.json();
  } catch {
    // non-JSON body (e.g. a network gateway error page) — fall through to generic message
  }
  throw new PostgrestRestError(body, res.status);
}

export async function pgSelect<T>(table: string, opts?: PgOptions): Promise<{ data: T[]; count: number | null }> {
  const url = buildUrl(table, opts);
  const headers = await buildHeaders({
    ...(opts?.maybeSingle ? { Accept: 'application/vnd.pgrst.object+json' } : {}),
    ...(opts?.range ? { 'Range-Unit': 'items', Range: `${opts.range.from}-${opts.range.to}`, Prefer: 'count=exact' } : {}),
  });
  const res = await fetch(url, { method: 'GET', headers });

  if (opts?.maybeSingle && !res.ok) {
    let body: Record<string, unknown> = {};
    try {
      body = await res.json();
    } catch {
      // ignore — fall through to normal error handling below
    }
    if (body.code === NO_ROWS_CODE) return { data: [], count: 0 };
  }
  await throwIfError(res);

  const count = opts?.range ? parseCount(res.headers.get('content-range')) : null;
  const body = await res.json();
  const data = opts?.maybeSingle ? [body as T] : (body as T[]);
  return { data, count };
}

function parseCount(contentRange: string | null): number | null {
  if (!contentRange) return null;
  const total = contentRange.split('/')[1];
  return total === '*' ? null : parseInt(total, 10);
}

export async function pgInsert(table: string, rows: object | object[]): Promise<void> {
  const headers = await buildHeaders({ Prefer: 'return=minimal' });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(rows),
  });
  await throwIfError(res);
}

export async function pgUpsert(
  table: string,
  rows: object | object[],
  opts: { onConflict: string; ignoreDuplicates?: boolean },
): Promise<void> {
  const resolution = opts.ignoreDuplicates ? 'ignore-duplicates' : 'merge-duplicates';
  const headers = await buildHeaders({ Prefer: `resolution=${resolution},return=minimal` });
  const url = `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${encodeURIComponent(opts.onConflict)}`;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(rows) });
  await throwIfError(res);
}

export async function pgUpdate(
  table: string,
  patch: object,
  opts: { eq: Record<string, string | number | boolean> },
): Promise<void> {
  const params = new URLSearchParams();
  for (const [col, val] of Object.entries(opts.eq)) params.append(col, `eq.${val}`);
  const headers = await buildHeaders({ Prefer: 'return=minimal' });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(patch),
  });
  await throwIfError(res);
}

export async function pgDelete(table: string, opts: { eq: Record<string, string | number | boolean> }): Promise<void> {
  const params = new URLSearchParams();
  for (const [col, val] of Object.entries(opts.eq)) params.append(col, `eq.${val}`);
  const headers = await buildHeaders({ Prefer: 'return=minimal' });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`, {
    method: 'DELETE',
    headers,
  });
  await throwIfError(res);
}
