export type StaffRole = 'operator' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
  is_active: boolean;
  preferred_language: 'zh-CN' | 'en' | null;
  must_change_password: boolean;
}

export interface SessionInfo {
  idle_expires_at: string;
  absolute_expires_at: string;
}

export interface SessionResponse {
  user: User;
  session: SessionInfo;
}

export interface LoginRequest {
  email: string;
  password: string;
}
