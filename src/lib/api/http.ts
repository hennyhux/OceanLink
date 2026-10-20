import { config } from '@/lib/config';

import { authEvents } from './authEvents';
import { ApiError, NetworkError, type ApiErrorBody } from './errors';

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface RequestOptions {
  method?: Method;
  body?: unknown;
  signal?: AbortSignal;
  idempotencyKey?: string;
  // Resource version for optimistic concurrency. The backend answers 412 when it is stale.
  ifMatchVersion?: number;
  // Set for the session check itself so a 401 there is not treated as "session expired".
  skipUnauthorizedEvent?: boolean;
}

const STATE_CHANGING: ReadonlySet<Method> = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

async function parseErrorBody(response: Response): Promise<Partial<ApiErrorBody> | undefined> {
  try {
    const text = await response.text();
    if (!text) return undefined;
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === 'object') return parsed as Partial<ApiErrorBody>;
    return undefined;
  } catch {
    return undefined;
  }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (STATE_CHANGING.has(method)) {
    // CSRF check required by the backend on every cookie-authenticated write.
    headers['X-Requested-With'] = 'XMLHttpRequest';
    headers['Content-Type'] = 'application/json';
  }
  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }
  if (options.ifMatchVersion !== undefined) {
    headers['If-Match'] = `"${options.ifMatchVersion}"`;
  }

  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (cause) {
    throw new NetworkError(cause);
  }

  if (!response.ok) {
    const body = await parseErrorBody(response);
    const error = new ApiError(response.status, body);
    if (error.status === 401 && !options.skipUnauthorizedEvent) {
      authEvents.emitUnauthorized();
    }
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const http = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
