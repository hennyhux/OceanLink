import { http, HttpResponse } from 'msw';
import { z } from 'zod';
import { paymentWriteSchema, PAYMENT_METHODS } from '@/features/payments/model';
import { isBusinessDate, todayInTimeZone } from '@/lib/dates';
import { findMockCustomer } from './customerHandlers';
import {
  createMockPayment,
  mockPayment,
  mockPayments,
  paymentRequests,
  reverseMockPayment,
  type PaymentActor,
} from './paymentStore';

const base = '/api/v1';
const error = (status: number, code: string) =>
  HttpResponse.json({ code, message: code, request_id: crypto.randomUUID() }, { status });
const response = (body: Parameters<typeof HttpResponse.json>[0], status = 200) =>
  HttpResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

function staff(cookies: Record<string, string | undefined>): PaymentActor | undefined {
  if (cookies.oceanlink_mock_session === '11111111-1111-4111-8111-111111111111')
    return { id: cookies.oceanlink_mock_session, name: 'Demo administrator', role: 'admin' };
  if (cookies.oceanlink_mock_session === '22222222-2222-4222-8222-222222222222')
    return { id: cookies.oceanlink_mock_session, name: 'Demo operator', role: 'operator' };
  return undefined;
}

function replay(actor: PaymentActor, key: string, fingerprint: string): Response | undefined {
  const cached = paymentRequests.get(`${actor.id}:${key}`);
  if (!cached) return undefined;
  if (Date.now() - cached.recorded_at > 30 * 86400000) {
    paymentRequests.delete(`${actor.id}:${key}`);
    return undefined;
  }
  if (cached.fingerprint !== fingerprint) return error(409, 'IDEMPOTENCY_CONFLICT');
  return response(mockPayment(cached.payment_id), cached.status);
}

export const paymentHandlers = [
  http.get(`${base}/lots/current`, () =>
    response({ id: '80000000-0000-4000-8000-000000000001', time_zone: 'UTC', currency: 'USD' }),
  ),
  http.get(`${base}/payments`, ({ request }) => {
    const params = new URL(request.url).searchParams;
    const from = params.get('from');
    const to = params.get('to');
    const method = params.get('method');
    const status = params.get('status');
    if (
      (from && !isBusinessDate(from)) ||
      (to && !isBusinessDate(to)) ||
      (from && to && from > to) ||
      (method && !PAYMENT_METHODS.some((item) => item === method)) ||
      (status && !['received', 'reversed'].includes(status))
    )
      return error(422, 'INVALID_FILTERS');
    const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
    const pageSize = Math.max(
      1,
      Math.min(100, Number.parseInt(params.get('page_size') ?? '20', 10) || 20),
    );
    const query = (params.get('q') ?? '').trim().toLowerCase();
    const records = mockPayments()
      .filter(
        (payment) =>
          (!params.get('customer_id') || payment.customer_id === params.get('customer_id')) &&
          (!from || payment.effective_on >= from) &&
          (!to || payment.effective_on <= to) &&
          (!method || payment.method === method) &&
          (!status || payment.status === status) &&
          (!query ||
            [payment.customer_name, payment.reference ?? ''].some((text) =>
              text.toLowerCase().includes(query),
            )),
      )
      .sort(
        (left, right) =>
          right.effective_on.localeCompare(left.effective_on) ||
          right.created_at.localeCompare(left.created_at) ||
          right.id.localeCompare(left.id),
      );
    return response({
      items: records.slice((page - 1) * pageSize, page * pageSize),
      total: records.length,
      page,
      page_size: pageSize,
    });
  }),
  http.get(`${base}/payments/:id`, ({ params }) => {
    const payment = mockPayment(String(params.id));
    return payment ? response(payment) : error(404, 'PAYMENT_NOT_FOUND');
  }),
  http.post(`${base}/payments`, async ({ request, cookies }) => {
    const actor = staff(cookies);
    if (!actor) return error(401, 'SESSION_EXPIRED');
    if (request.headers.get('x-requested-with') !== 'XMLHttpRequest')
      return error(403, 'CSRF_REJECTED');
    const key = request.headers.get('idempotency-key');
    if (!key || key.length > 200) return error(400, 'IDEMPOTENCY_REQUIRED');
    const parsed = paymentWriteSchema.safeParse(await request.json());
    if (!parsed.success || parsed.data.effective_on > todayInTimeZone('UTC'))
      return error(422, 'INVALID_PAYMENT');
    const fingerprint = JSON.stringify({ operation: 'record', body: parsed.data });
    const cached = replay(actor, key, fingerprint);
    if (cached) return cached;
    if (!findMockCustomer(parsed.data.customer_id)) return error(404, 'CUSTOMER_NOT_FOUND');
    const payment = createMockPayment(parsed.data, actor);
    paymentRequests.set(`${actor.id}:${key}`, {
      fingerprint,
      payment_id: payment.id,
      status: 201,
      recorded_at: Date.now(),
    });
    return response(payment, 201);
  }),
  http.post(`${base}/payments/:id/reverse`, async ({ request, cookies, params }) => {
    const actor = staff(cookies);
    if (!actor) return error(401, 'SESSION_EXPIRED');
    if (actor.role !== 'admin') return error(403, 'FORBIDDEN');
    if (request.headers.get('x-requested-with') !== 'XMLHttpRequest')
      return error(403, 'CSRF_REJECTED');
    const key = request.headers.get('idempotency-key');
    if (!key || key.length > 200) return error(400, 'IDEMPOTENCY_REQUIRED');
    const parsed = z
      .object({ reason: z.string().trim().min(1).max(1000) })
      .strict()
      .safeParse(await request.json());
    if (!parsed.success) return error(422, 'REASON_REQUIRED');
    const fingerprint = JSON.stringify({
      operation: 'reverse',
      id: params.id,
      body: parsed.data,
      version: request.headers.get('if-match'),
    });
    const cached = replay(actor, key, fingerprint);
    if (cached) return cached;
    const payment = mockPayment(String(params.id));
    if (!payment) return error(404, 'PAYMENT_NOT_FOUND');
    if (request.headers.get('if-match') !== `"${payment.version}"`)
      return error(412, 'STALE_VERSION');
    if (payment.status !== 'received') return error(409, 'PAYMENT_ALREADY_REVERSED');
    const reversed = reverseMockPayment(payment, parsed.data.reason, actor);
    paymentRequests.set(`${actor.id}:${key}`, {
      fingerprint,
      payment_id: payment.id,
      status: 200,
      recorded_at: Date.now(),
    });
    return response(reversed);
  }),
];
