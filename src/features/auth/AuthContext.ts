import { createContext } from 'react';

import type { LoginRequest, SessionResponse, User } from './types';

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut' | 'error';

export interface AuthState {
  status: AuthStatus;
  user: User | null;
  session: SessionResponse['session'] | null;
  // Why the person was signed out, shown on the sign-in screen.
  signedOutReason: 'expired' | null;
  login: (body: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  retry: () => void;
  keepAlive: () => Promise<void>;
  // Ends the session locally after the idle limit passes.
  expire: () => void;
}

export const AuthContext = createContext<AuthState | null>(null);
