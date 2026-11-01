import { HttpResponse } from 'msw';

import type { User } from '@/features/auth/types';
import type { ApiErrorBody } from '@/lib/api/errors';
import type { Paged } from '@/lib/api/paging';

import { db, nextRequestId, sessionBody } from '../db';

export const BASE = '/api/v1';
export const SESSION_COOKIE = 'oceanlink_mock_session';

export function fail(
  status: number,
  code: string,
  extra: Partial<Pick<ApiErrorBody, 'field_errors' | 'details'>> = {},
) {
  const body: ApiErrorBody = { code, message: code, request_id: nextRequestId(), ...extra };
  return HttpResponse.json(body, { status });
}

export function fieldError(status: number, code: string, field: string, fieldCode = code) {
  return fail(status, code, { field_errors: { [field]: [fieldCode] } });
}

type Cookies = Record<string, string | undefined>;

export function sessionIdFrom(cookies: Cookies): string | undefined {
  return cookies[SESSION_COOKIE];
}

export function actorFrom(cookies: Cookies): User | undefined {
  const id = sessionIdFrom(cookies);
  return id ? sessionBody(id)?.user : undefined;
}

// Every route except login requires a session, and writes need the CSRF header.
export function guard(
  request: Request,
  cookies: Cookies,
  options: { write?: boolean; admin?: boolean } = {},
): { actor: User } | { response: Response } {
  if (options.write && request.headers.get('x-requested-with') !== 'XMLHttpRequest') {
    return { response: fail(403, 'CSRF_REJECTED') };
  }
  const actor = actorFrom(cookies);
  if (!actor) return { response: fail(401, 'SESSION_EXPIRED') };
  if (options.admin && actor.role !== 'admin') return { response: fail(403, 'ADMIN_REQUIRED') };
  return { actor };
}

export function readIfMatch(request: Request): number | undefined {
  const raw = request.headers.get('if-match');
  if (!raw) return undefined;
  const parsed = Number(raw.replace(/"/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

// Returns an error response when the If-Match header is missing or stale.
export function checkVersion(request: Request, version: number): Response | undefined {
  const expected = readIfMatch(request);
  if (expected === undefined) return fail(428, 'IF_MATCH_REQUIRED');
  if (expected !== version) return fail(412, 'STALE_VERSION');
  return undefined;
}

// Same key and same content replays the first answer. Same key, new content is a conflict.
export async function idempotent(
  request: Request,
  actor: User,
  operation: string,
  body: unknown,
  run: () => Response | Promise<Response>,
): Promise<Response> {
  const key = request.headers.get('idempotency-key');
  if (!key || key.length > 200) return fail(400, 'IDEMPOTENCY_REQUIRED');
  const scoped = `${actor.id}:${operation}:${key}`;
  const fingerprint = JSON.stringify({ body, ifMatch: request.headers.get('if-match') });
  const previous = db.idempotency.get(scoped);
  if (previous) {
    if (previous.fingerprint !== fingerprint) return fail(409, 'IDEMPOTENCY_CONFLICT');
    return HttpResponse.json(previous.body as object, { status: previous.status });
  }
  const response = await run();
  if (response.ok) {
    const copy = response.clone();
    db.idempotency.set(scoped, {
      actor: actor.id,
      fingerprint,
      status: copy.status,
      body: await copy.json(),
    });
  }
  return response;
}

export function paged<T>(items: T[], url: URL): Paged<T> {
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get('page_size') ?? 20) || 20),
  );
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page,
    page_size: pageSize,
    total: items.length,
  };
}

export function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export const isTrue = (url: URL, name: string) => url.searchParams.get(name) === 'true';
