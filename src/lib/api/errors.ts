// Error contract from REQUIREMENTS.md section 12.3.
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
  readonly details: Record<string, unknown> | undefined;

  constructor(status: number, body: Partial<ApiErrorBody> | undefined) {
    super(body?.message ?? `Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.code ?? `HTTP_${status}`;
    this.requestId = body?.request_id;
    this.fieldErrors = body?.field_errors;
    this.details = body?.details;
  }
}

// The request never reached the server or no response came back.
export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super('Network request failed');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

export function isUnauthorized(error: unknown): boolean {
  return isApiError(error) && error.status === 401;
}

export function isForbidden(error: unknown): boolean {
  return isApiError(error) && error.status === 403;
}

export function isNotFound(error: unknown): boolean {
  return isApiError(error) && error.status === 404;
}

// Someone else saved this record first. Reload before trying again.
export function isStaleVersion(error: unknown): boolean {
  return isApiError(error) && error.status === 412;
}

export function isValidationError(error: unknown): error is ApiError & {
  fieldErrors: Record<string, string[]>;
} {
  return isApiError(error) && error.status === 422 && error.fieldErrors !== undefined;
}
