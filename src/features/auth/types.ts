// Shapes follow REQUIREMENTS.md sections 10 and 11.2. The backend OpenAPI schema
// is the source of truth once it exists. Fields not spelled out there are marked.

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

// Proposed: expiry context returned by GET /auth/session so the UI can warn before idle timeout.
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

// Proposed: login returns the same body as GET /auth/session.
export type LoginResponse = SessionResponse;
