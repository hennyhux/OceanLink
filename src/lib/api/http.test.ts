import { HttpResponse, http as mswHttp } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '@/mocks/server';

import { authEvents } from './authEvents';
import { ApiError, NetworkError } from './errors';
import { http } from './http';

const BASE = '/api/v1';

describe('http client', () => {
  it('sends the CSRF header and credentials on writes', async () => {
    let seenHeader: string | null = null;
    let seenCredentials: RequestCredentials | undefined;
    server.use(
      mswHttp.post(`${BASE}/things`, ({ request }) => {
        seenHeader = request.headers.get('x-requested-with');
        seenCredentials = request.credentials;
        return HttpResponse.json({ ok: true });
      }),
    );

    await http.post('/things', { a: 1 });
    expect(seenHeader).toBe('XMLHttpRequest');
    expect(seenCredentials).toBe('include');
  });

  it('normalizes error bodies into ApiError', async () => {
    server.use(
      mswHttp.get(`${BASE}/things`, () =>
        HttpResponse.json(
          { code: 'LOT_SETUP_REQUIRED', message: 'Set up the lot first', request_id: 'r-1' },
          { status: 409 },
        ),
      ),
    );

    const error = await http.get('/things').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'LOT_SETUP_REQUIRED', requestId: 'r-1' });
  });

  it('wraps fetch failures in NetworkError', async () => {
    server.use(mswHttp.get(`${BASE}/things`, () => HttpResponse.error()));
    await expect(http.get('/things')).rejects.toBeInstanceOf(NetworkError);
  });

  it('emits an unauthorized event on 401 unless told not to', async () => {
    const listener = vi.fn();
    const unsubscribe = authEvents.onUnauthorized(listener);
    server.use(mswHttp.get(`${BASE}/things`, () => new HttpResponse(null, { status: 401 })));

    await expect(http.get('/things')).rejects.toBeInstanceOf(ApiError);
    expect(listener).toHaveBeenCalledTimes(1);

    await expect(http.get('/things', { skipUnauthorizedEvent: true })).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('returns undefined for 204 responses', async () => {
    server.use(mswHttp.delete(`${BASE}/things/1`, () => new HttpResponse(null, { status: 204 })));
    await expect(http.delete('/things/1')).resolves.toBeUndefined();
  });
});
