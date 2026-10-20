import { createContext } from 'react';

import type { LoginRequest, User } from './types';

export type AuthStatus =
  | 'checking' // first session check in flight
  | 'authenticated'
  | 'unauthenticated'
  | 'unavailable'; // session check failed for a reason other than 401, user may still be signed in

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  // Set when the user was signed in and the backend later said 401.
  sessionExpired: boolean;
  // Set when the last sign-out could not reach the server. The device is still signed out.
  logoutServerFailed: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  recheck: () => Promise<void>;
  isLoggingOut: boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
