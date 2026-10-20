import { HttpResponse, http } from 'msw';

import { server } from '@/mocks/server';

const adminSession = {
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'admin@example.com',
    name: 'Ada Admin',
    role: 'admin',
    is_active: true,
    preferred_language: 'en',
    must_change_password: false,
  },
  session: {
    idle_expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
    absolute_expires_at: new Date(Date.now() + 8 * 3_600_000).toISOString(),
  },
};

// Makes the next requests look like an admin is signed in.
export function signedIn(): void {
  server.use(http.get('/api/v1/auth/session', () => HttpResponse.json(adminSession)));
}
