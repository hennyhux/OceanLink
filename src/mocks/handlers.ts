import { HttpResponse, http, type HttpHandler } from 'msw';

import type { LoginRequest, SessionResponse, User } from '@/features/auth/types';
import type { ApiErrorBody } from '@/lib/api/errors';

import { customerHandlers } from './customerHandlers';
import { vehicleHandlers } from './vehicleHandlers';
import { billingHandlers } from './billingHandlers';
import { vehicleParkingHandlers } from './vehicleParkingHandlers';
import { paymentHandlers } from './paymentHandlers';
import { customerOverviewHandlers } from './customerOverviewHandlers';

// Synthetic staff accounts. Development only. Not real people.
export const MOCK_USERS: ReadonlyArray<User & { password: string }> = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'admin@example.com',
    name: '管理员 (Admin)',
    role: 'admin',
    is_active: true,
    preferred_language: 'zh-CN',
    must_change_password: false,
    password: 'admin-password',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'operator@example.com',
    name: '操作员 (Operator)',
    role: 'operator',
    is_active: true,
    preferred_language: 'zh-CN',
    must_change_password: false,
    password: 'operator-password',
  },
];

const SESSION_COOKIE = 'oceanlink_mock_session';
const BASE = '/api/v1';

let requestCounter = 0;
function requestId(): string {
  requestCounter += 1;
  return `mock-${requestCounter.toString().padStart(4, '0')}`;
}

function errorResponse(status: number, code: string, message: string) {
  const body: ApiErrorBody = { code, message, request_id: requestId() };
  return HttpResponse.json(body, { status });
}

function publicUser(user: User & { password: string }): User {
  const { id, email, name, role, is_active, preferred_language, must_change_password } = user;
  return { id, email, name, role, is_active, preferred_language, must_change_password };
}

function sessionFor(user: User): SessionResponse {
  const now = Date.now();
  return {
    user: { ...user },
    session: {
      idle_expires_at: new Date(now + 30 * 60 * 1000).toISOString(),
      absolute_expires_at: new Date(now + 8 * 60 * 60 * 1000).toISOString(),
    },
  };
}

function parseCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return undefined;
}

function hasCsrfHeader(request: Request): boolean {
  return request.headers.get('x-requested-with') === 'XMLHttpRequest';
}

// Exported so tests can create a signed-in state without going through the login form.
export function mockSessionCookie(userId: string): string {
  return `${SESSION_COOKIE}=${userId}`;
}

export const handlers: HttpHandler[] = [
  ...customerOverviewHandlers,
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    if (!hasCsrfHeader(request)) {
      return errorResponse(403, 'CSRF_REJECTED', 'Missing CSRF header');
    }
    const body = (await request.json()) as Partial<LoginRequest>;
    const user = MOCK_USERS.find(
      (candidate) =>
        candidate.email.toLowerCase() === body.email?.trim().toLowerCase() &&
        candidate.password === body.password,
    );
    if (!user) {
      return errorResponse(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
    }
    if (!user.is_active) {
      return errorResponse(403, 'ACCOUNT_INACTIVE', 'Account is inactive');
    }
    return HttpResponse.json(sessionFor(publicUser(user)), {
      status: 200,
      headers: {
        // Plain cookie name here: __Host- needs HTTPS, which local dev does not have.
        'Set-Cookie': `${SESSION_COOKIE}=${user.id}; Path=/; SameSite=Lax`,
      },
    });
  }),

  http.get(`${BASE}/auth/session`, ({ cookies, request }) => {
    const id =
      cookies[SESSION_COOKIE] ?? parseCookie(request.headers.get('cookie'), SESSION_COOKIE);
    const user = MOCK_USERS.find((candidate) => candidate.id === id);
    if (!user) {
      return errorResponse(401, 'SESSION_EXPIRED', 'Not signed in');
    }
    return HttpResponse.json(sessionFor(publicUser(user)));
  }),

  http.post(`${BASE}/auth/logout`, ({ request }) => {
    if (!hasCsrfHeader(request)) {
      return errorResponse(403, 'CSRF_REJECTED', 'Missing CSRF header');
    }
    return new HttpResponse(null, {
      status: 204,
      headers: {
        'Set-Cookie': `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`,
      },
    });
  }),

  ...customerHandlers,
  ...vehicleHandlers,
  ...billingHandlers,
  ...vehicleParkingHandlers,
  ...paymentHandlers,
];
