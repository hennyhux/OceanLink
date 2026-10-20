import { http } from '@/lib/api/http';

import type { LoginRequest, LoginResponse, SessionResponse } from './types';

export const authApi = {
  // A 401 here is a wrong password, not an expired session.
  login: (body: LoginRequest) =>
    http.post<LoginResponse>('/auth/login', body, { skipUnauthorizedEvent: true }),
  // skipUnauthorizedEvent: a 401 here just means "not signed in", not "session expired".
  session: (signal?: AbortSignal) =>
    http.get<SessionResponse>('/auth/session', { signal, skipUnauthorizedEvent: true }),
  logout: () => http.post<void>('/auth/logout', undefined, { skipUnauthorizedEvent: true }),
};

export const authKeys = {
  all: ['auth'] as const,
  session: ['auth', 'session'] as const,
};
