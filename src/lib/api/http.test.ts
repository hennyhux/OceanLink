import { HttpResponse, http as mswHttp } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '@/mocks/server';

import { authEvents } from './authEvents';
import { ApiError, NetworkError, isUnknownOutcome } from './errors';
import { http } from './http';

describe('http client', () => {
  it('adds the CSRF header, If-Match, and Idempotency-Key to writes only', async () => {
    const seen: Record<string, string | null>[] = [];
    server.use(
      mswHttp.all('/api/v1/probe', ({ request }) => {
        seen.push({
          method: request.method,
          csrf: request.headers.get('x-requested-with'),
          ifMatch: request.headers.get('if-match'),
          key: request.headers.get('idempotency-key'),
        });
        return HttpResponse.json({ ok: true });
      }),
    );
    await http.get('/probe');
    await http.post('/probe', { a: 1 }, { ifMatchVersion: 3, idempotencyKey: 'key-1' });
    expect(seen).toEqual([
      { method: 'GET', csrf: null, ifMatch: null, key: null },
      { method: 'POST', csrf: 'XMLHttpRequest', ifMatch: '"3"', key: 'key-1' },
    ]);
  });

  it('normalizes the error shape and reports 401 to the auth layer', async () => {
    const onUnauthorized = vi.fn();
    const stop = authEvents.onUnauthorized(onUnauthorized);
    server.use(
      mswHttp.get('/api/v1/probe', () =>
        HttpResponse.json(
          { code: 'SESSION_EXPIRED', message: 'x', request_id: 'r-1', field_errors: { a: ['B'] } },
          { status: 401 },
        ),
      ),
    );
    const error = await http.get('/probe').catch((caught: unknown) => caught);
    stop();
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 401,
      code: 'SESSION_EXPIRED',
      requestId: 'r-1',
      fieldErrors: { a: ['B'] },
    });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('treats a timeout on a money write as an unknown result, not a failure', async () => {
    // The test setup strips abort signals from fetch, so stand in for a server that never answers.
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const error = await http
      .post('/probe', {}, { timeoutMs: 20 })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(NetworkError);
    expect((error as NetworkError).timedOut).toBe(true);
    expect(isUnknownOutcome(error)).toBe(true);
    expect(isUnknownOutcome(new ApiError(422, { code: 'VALIDATION_FAILED', message: '' }))).toBe(
      false,
    );
  });
});
