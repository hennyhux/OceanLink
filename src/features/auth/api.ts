import { http } from '@/lib/api/http';

import type { LoginRequest, SessionResponse } from './types';

export const authApi = {
  login: (body: LoginRequest) => http.post<SessionResponse>('/auth/login', body),
  session: (signal?: AbortSignal) =>
    http.get<SessionResponse>('/auth/session', { signal, skipUnauthorizedEvent: true }),
  activity: () => http.post<SessionResponse>('/auth/activity'),
  logout: () => http.post<void>('/auth/logout'),
};
