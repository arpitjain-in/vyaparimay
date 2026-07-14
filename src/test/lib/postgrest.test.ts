import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabase', () => ({
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key-123',
}));

vi.mock('../../lib/gotrue', () => ({
  getAccessToken: vi.fn().mockResolvedValue('user-access-token'),
}));

import { pgSelect, pgInsert, pgUpsert, pgUpdate, pgDelete, PostgrestRestError } from '../../lib/postgrest';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('postgrest client', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('sends apikey/Authorization headers on every request', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));
    await pgSelect('customers');
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.apikey).toBe('anon-key-123');
    expect(init.headers.Authorization).toBe('Bearer user-access-token');
  });

  it('builds a plain eq-filtered select', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ id: 'CUST-1' }]));
    const { data } = await pgSelect('customers', { eq: { org_id: 'org1', active: true } });
    const [url] = fetchMock.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/rest/v1/customers');
    expect(parsed.searchParams.get('select')).toBe('*');
    expect(parsed.searchParams.get('org_id')).toBe('eq.org1');
    expect(parsed.searchParams.get('active')).toBe('eq.true');
    expect(data).toEqual([{ id: 'CUST-1' }]);
  });

  it('builds an ordered select', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));
    await pgSelect('invoices', { order: { column: 'invoice_date', ascending: false } });
    const parsed = new URL(fetchMock.mock.calls[0][0]);
    expect(parsed.searchParams.get('order')).toBe('invoice_date.desc');
  });

  it('builds an embedded-resource select', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));
    await pgSelect('invoices', { select: '*, invoice_items(*)' });
    const parsed = new URL(fetchMock.mock.calls[0][0]);
    expect(parsed.searchParams.get('select')).toBe('*, invoice_items(*)');
  });

  it('builds an or() ilike search combined with range + count', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([{ id: 'CUST-1' }], { headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/117' } }),
    );
    const { data, count } = await pgSelect('customers', {
      or: 'name.ilike.%test%,mobile.ilike.%test%',
      range: { from: 0, to: 24 },
    });
    const [url, init] = fetchMock.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.searchParams.get('or')).toBe('(name.ilike.%test%,mobile.ilike.%test%)');
    expect(init.headers['Range-Unit']).toBe('items');
    expect(init.headers.Range).toBe('0-24');
    expect(init.headers.Prefer).toBe('count=exact');
    expect(count).toBe(117);
    expect(data).toEqual([{ id: 'CUST-1' }]);
  });

  it('treats an unparseable Content-Range total as null count', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([], { headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/*' } }),
    );
    const { count } = await pgSelect('customers', { range: { from: 0, to: 24 } });
    expect(count).toBeNull();
  });

  it('maybeSingle returns the row wrapped in an array on a hit', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ org_id: 'org1', name: 'Test Mill' }));
    const { data } = await pgSelect('business_profiles', { eq: { org_id: 'org1' }, maybeSingle: true });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Accept).toBe('application/vnd.pgrst.object+json');
    expect(data).toEqual([{ org_id: 'org1', name: 'Test Mill' }]);
  });

  it('maybeSingle returns empty data on a 0-row PGRST116 response instead of throwing', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }), {
        status: 406,
      }),
    );
    const { data } = await pgSelect('business_profiles', { eq: { org_id: 'org1' }, maybeSingle: true });
    expect(data).toEqual([]);
  });

  it('sends insert as POST with return=minimal', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 201 }));
    await pgInsert('customers', { id: 'CUST-1', name: 'Test' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url).pathname).toBe('/rest/v1/customers');
    expect(init.method).toBe('POST');
    expect(init.headers.Prefer).toBe('return=minimal');
    expect(JSON.parse(init.body)).toEqual({ id: 'CUST-1', name: 'Test' });
  });

  it('sends upsert with merge-duplicates resolution and on_conflict param', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 201 }));
    await pgUpsert('price_list', { org_id: 'org1', sku_id: 'SKU-1', rate: 100 }, { onConflict: 'org_id,sku_id' });
    const [url, init] = fetchMock.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.searchParams.get('on_conflict')).toBe('org_id,sku_id');
    expect(init.headers.Prefer).toBe('resolution=merge-duplicates,return=minimal');
  });

  it('sends upsert with ignore-duplicates resolution when requested', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 201 }));
    await pgUpsert('product_skus', [{ id: 'SKU-1' }], { onConflict: 'id', ignoreDuplicates: true });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Prefer).toBe('resolution=ignore-duplicates,return=minimal');
  });

  it('sends update as PATCH with eq filters and only the patch fields in the body', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await pgUpdate('customers', { name: 'New Name' }, { eq: { id: 'CUST-1', org_id: 'org1' } });
    const [url, init] = fetchMock.mock.calls[0];
    const parsed = new URL(url);
    expect(init.method).toBe('PATCH');
    expect(parsed.searchParams.get('id')).toBe('eq.CUST-1');
    expect(parsed.searchParams.get('org_id')).toBe('eq.org1');
    expect(JSON.parse(init.body)).toEqual({ name: 'New Name' });
  });

  it('sends delete as DELETE with eq filters and no body', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await pgDelete('expenses', { eq: { id: 'EXP-1' } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('DELETE');
    expect(new URL(url).searchParams.get('id')).toBe('eq.EXP-1');
    expect(init.body).toBeUndefined();
  });

  it('throws a plain-object PostgrestRestError (not an Error instance) on a JSON error body', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'duplicate key', details: 'Key (id)=(1) exists', hint: 'try another id', code: '23505' }), {
        status: 409,
      }),
    );
    await expect(pgInsert('customers', { id: '1' })).rejects.toMatchObject({
      message: 'duplicate key',
      details: 'Key (id)=(1) exists',
      hint: 'try another id',
      code: '23505',
    });
    try {
      await pgInsert('customers', { id: '1' });
    } catch (err) {
      expect(err).toBeInstanceOf(PostgrestRestError);
      expect(err).not.toBeInstanceOf(Error);
    }
  });

  it('falls back to a generic message when the error body is not valid JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad Gateway</html>', { status: 502, statusText: 'Bad Gateway' }));
    await expect(pgDelete('expenses', { eq: { id: '1' } })).rejects.toMatchObject({
      message: 'Request failed with status 502',
    });
  });
});
