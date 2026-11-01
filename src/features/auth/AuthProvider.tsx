import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { authEvents } from '@/lib/api/authEvents';
import { hasStatus } from '@/lib/api/errors';
import { changeLanguage, hasStoredLanguage, isLanguage } from '@/lib/i18n';

import { authApi } from './api';
import { AuthContext, type AuthState } from './AuthContext';
import type { LoginRequest, SessionResponse } from './types';

const SESSION_KEY = ['auth', 'session'] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [signedOutReason, setSignedOutReason] = useState<'expired' | null>(null);

  const query = useQuery({
    queryKey: SESSION_KEY,
    queryFn: async ({ signal }) => {
      try {
        return await authApi.session(signal);
      } catch (error) {
        if (hasStatus(error, 401)) return null;
        throw error;
      }
    },
    staleTime: Infinity,
    retry: false,
  });

  // Signing out drops every cached customer and money record.
  const clearToSignedOut = useCallback(
    (reason: 'expired' | null) => {
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth' });
      client.setQueryData<SessionResponse | null>(SESSION_KEY, null);
      setSignedOutReason(reason);
    },
    [client],
  );

  useEffect(
    () =>
      authEvents.onUnauthorized(() => {
        if (client.getQueryData(SESSION_KEY)) clearToSignedOut('expired');
      }),
    [client, clearToSignedOut],
  );

  const login = useCallback(
    async (body: LoginRequest) => {
      const session = await authApi.login(body);
      client.setQueryData(SESSION_KEY, session);
      setSignedOutReason(null);
      const preferred = session.user.preferred_language;
      if (isLanguage(preferred) && !hasStoredLanguage()) {
        await changeLanguage(preferred);
      }
    },
    [client],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearToSignedOut(null);
    }
  }, [clearToSignedOut]);

  const keepAlive = useCallback(async () => {
    const session = await authApi.activity();
    client.setQueryData(SESSION_KEY, session);
  }, [client]);

  const expire = useCallback(() => clearToSignedOut('expired'), [clearToSignedOut]);
  const { data, isPending, isError, refetch } = query;

  const value = useMemo<AuthState>(() => {
    const status = isPending
      ? 'loading'
      : isError && !data
        ? 'error'
        : data
          ? 'signedIn'
          : 'signedOut';
    return {
      status,
      user: data?.user ?? null,
      session: data?.session ?? null,
      signedOutReason,
      login,
      logout,
      keepAlive,
      expire,
      retry: () => void refetch(),
    };
  }, [data, isPending, isError, refetch, signedOutReason, login, logout, keepAlive, expire]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
