import { HttpResponse, http } from 'msw';

import type { LoginRequest } from '@/features/auth/types';

import { createSession, db, LOT, publicUser, sessionBody, touchSession, USERS } from '../db';
import { BASE, SESSION_COOKIE, fail, guard, sessionIdFrom } from './util';

// Plain cookie name in mocks: __Host- cookies need HTTPS, which local development lacks.
const setCookie = (value: string, maxAge?: number) =>
  `${SESSION_COOKIE}=${value}; Path=/; SameSite=Lax${maxAge === undefined ? '' : `; Max-Age=${maxAge}`}`;

export const authHandlers = [
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    if (request.headers.get('x-requested-with') !== 'XMLHttpRequest') {
      return fail(403, 'CSRF_REJECTED');
    }
    const body = (await request.json()) as Partial<LoginRequest>;
    const user = USERS.find(
      (candidate) =>
        candidate.email === body.email?.trim().toLowerCase() &&
        candidate.password === body.password,
    );
    if (!user) return fail(401, 'INVALID_CREDENTIALS');
    if (!user.is_active) return fail(403, 'ACCOUNT_INACTIVE');
    const sessionId = createSession(user.id);
    return HttpResponse.json(sessionBody(sessionId) ?? { user: publicUser(user) }, {
      headers: { 'Set-Cookie': setCookie(sessionId) },
    });
  }),

  http.get(`${BASE}/auth/session`, ({ cookies }) => {
    const id = sessionIdFrom(cookies);
    const body = id ? sessionBody(id) : undefined;
    return body ? HttpResponse.json(body) : fail(401, 'SESSION_EXPIRED');
  }),

  http.post(`${BASE}/auth/activity`, ({ request, cookies }) => {
    const result = guard(request, cookies, { write: true });
    if ('response' in result) return result.response;
    const id = sessionIdFrom(cookies)!;
    touchSession(id);
    return HttpResponse.json(sessionBody(id));
  }),

  http.post(`${BASE}/auth/logout`, ({ request, cookies }) => {
    if (request.headers.get('x-requested-with') !== 'XMLHttpRequest') {
      return fail(403, 'CSRF_REJECTED');
    }
    const id = sessionIdFrom(cookies);
    if (id) db.sessions.delete(id);
    return new HttpResponse(null, { status: 204, headers: { 'Set-Cookie': setCookie('', 0) } });
  }),

  http.get(`${BASE}/lots/current`, ({ request, cookies }) => {
    const result = guard(request, cookies);
    if ('response' in result) return result.response;
    return HttpResponse.json(LOT);
  }),
];
