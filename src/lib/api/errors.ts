// Error shape from REQUIREMENTS.md section 12.3.
export interface ApiErrorBody {
  code: string;
  message: string;
  request_id?: string;
  field_errors?: Record<string, string[]>;
  details?: Record<string, unknown>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | undefined;
  readonly fieldErrors: Record<string, string[]> | undefined;

  constructor(status: number, body: Partial<ApiErrorBody> | undefined) {
    super(body?.message ?? `Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.code ?? `HTTP_${status}`;
    this.requestId = body?.request_id;
    this.fieldErrors = body?.field_errors;
  }
}

// The request never reached the server, timed out, or no response came back.
export class NetworkError extends Error {
  readonly timedOut: boolean;

  constructor(cause?: unknown, timedOut = false) {
    super(timedOut ? 'Request timed out' : 'Network request failed');
    this.name = 'NetworkError';
    this.cause = cause;
    this.timedOut = timedOut;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

export function hasStatus(error: unknown, status: number): boolean {
  return isApiError(error) && error.status === status;
}

export function hasCode(error: unknown, ...codes: string[]): boolean {
  return isApiError(error) && codes.includes(error.code);
}

// For money writes: no answer, or a server crash, means we do not know if it was saved.
export function isUnknownOutcome(error: unknown): boolean {
  return isNetworkError(error) || (isApiError(error) && error.status >= 500);
}

export function requestIdOf(error: unknown): string | undefined {
  return isApiError(error) ? error.requestId : undefined;
}
