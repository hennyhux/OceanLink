import { config } from '@/lib/config';

import { authEvents } from './authEvents';
import { ApiError, NetworkError, type ApiErrorBody } from './errors';

type Method = 'GET' | 'POST' | 'PATCH';

export interface RequestOptions {
  signal?: AbortSignal;
  idempotencyKey?: string;
  // Record version. The backend answers 412 when someone else saved first.
  ifMatchVersion?: number;
  timeoutMs?: number;
  // The session check itself should not count as "session expired".
  skipUnauthorizedEvent?: boolean;
}

async function readErrorBody(response: Response): Promise<Partial<ApiErrorBody> | undefined> {
  try {
    const text = await response.text();
    if (!text) return undefined;
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? (parsed as Partial<ApiErrorBody>) : undefined;
  } catch {
    return undefined;
  }
}

async function request<T>(
  method: Method,
  path: string,
  body: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (method !== 'GET') {
    // CSRF check the backend requires on every write.
    headers['X-Requested-With'] = 'XMLHttpRequest';
    headers['Content-Type'] = 'application/json';
  }
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
  if (options.ifMatchVersion !== undefined) headers['If-Match'] = `"${options.ifMatchVersion}"`;

  const controller = new AbortController();
  let timedOut = false;
  const timer = options.timeoutMs
    ? setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, options.timeoutMs)
    : undefined;
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener('abort', abortFromCaller);

  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (cause) {
    throw new NetworkError(cause, timedOut);
  } finally {
    if (timer) clearTimeout(timer);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }

  if (!response.ok) {
    const error = new ApiError(response.status, await readErrorBody(response));
    if (error.status === 401 && !options.skipUnauthorizedEvent) authEvents.emitUnauthorized();
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const http = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, body, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, body, options),
};
