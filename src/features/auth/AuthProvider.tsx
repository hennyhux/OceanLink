import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { authEvents } from '@/lib/api/authEvents';
import { isNetworkError, isUnauthorized } from '@/lib/api/errors';

import { authApi, authKeys } from './api';
import { AuthContext, type AuthContextValue, type AuthStatus } from './AuthContext';
import type { LoginRequest, SessionResponse } from './types';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [sessionExpired, setSessionExpired] = useState(false);
  const [logoutServerFailed, setLogoutServerFailed] = useState(false);

  const sessionQuery = useQuery<SessionResponse | null, Error>({
    queryKey: authKeys.session,
    queryFn: async ({ signal }) => {
      try {
        return await authApi.session(signal);
      } catch (error) {
        if (isUnauthorized(error)) return null;
        throw error;
      }
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: (count, error) => isNetworkError(error) && count < 1,
  });

  const clearSensitiveData = useCallback(() => {
    // Drop every cached query so the next user cannot see the previous user's data.
    queryClient.clear();
  }, [queryClient]);

  // Any protected request that comes back 401 means the session ended on the server.
  useEffect(() => {
    return authEvents.onUnauthorized(() => {
      const current = queryClient.getQueryData<SessionResponse | null>(authKeys.session);
      if (current) {
        setSessionExpired(true);
        clearSensitiveData();
        queryClient.setQueryData<SessionResponse | null>(authKeys.session, null);
      }
    });
  }, [queryClient, clearSensitiveData]);

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      // A fresh login replaces whatever the previous user may have left in the cache.
      clearSensitiveData();
      setSessionExpired(false);
      setLogoutServerFailed(false);
      queryClient.setQueryData<SessionResponse | null>(authKeys.session, data);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onError: () => setLogoutServerFailed(true),
    onSuccess: () => setLogoutServerFailed(false),
    onSettled: () => {
      // Even if the server call failed, the device is signed out.
      clearSensitiveData();
      setSessionExpired(false);
      queryClient.setQueryData<SessionResponse | null>(authKeys.session, null);
    },
  });

  const { mutateAsync: loginAsync } = loginMutation;
  const { mutateAsync: logoutAsync } = logoutMutation;
  const { refetch: refetchSession } = sessionQuery;

  const login = useCallback(
    async (credentials: LoginRequest) => {
      await loginAsync(credentials);
    },
    [loginAsync],
  );

  const logout = useCallback(async () => {
    await logoutAsync();
  }, [logoutAsync]);

  const recheck = useCallback(async () => {
    await refetchSession();
  }, [refetchSession]);

  const status: AuthStatus = useMemo(() => {
    if (sessionQuery.isPending) return 'checking';
    if (sessionQuery.isError) return 'unavailable';
    return sessionQuery.data ? 'authenticated' : 'unauthenticated';
  }, [sessionQuery.isPending, sessionQuery.isError, sessionQuery.data]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: sessionQuery.data?.user ?? null,
      sessionExpired,
      logoutServerFailed,
      login,
      logout,
      recheck,
      isLoggingOut: logoutMutation.isPending,
    }),
    [
      status,
      sessionQuery.data,
      sessionExpired,
      logoutServerFailed,
      login,
      logout,
      recheck,
      logoutMutation.isPending,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
