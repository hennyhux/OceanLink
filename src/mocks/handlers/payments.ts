import { HttpResponse, http } from 'msw';

import { PAYMENT_METHODS, type PaymentMethod, type PaymentWrite } from '@/features/payments/types';
import { firstOfMonth, isBusinessDate } from '@/lib/dates';

import {
  allocatePayment,
  countsAsTruck,
  db,
  findCustomer,
  findPayment,
  ledger,
  paymentView,
  today,
} from '../db';
import { BASE, checkVersion, clean, fail, fieldError, guard, idempotent, paged } from './util';

export const paymentHandlers = [
  http.get(`${BASE}/payments`, ({ request, cookies }) => {
    const result = guard(request, cookies);
    if ('response' in result) return result.response;
    const url = new URL(request.url);
    const get = (name: string) => url.searchParams.get(name) ?? '';
    const method = get('method');
    const status = get('status');
    const from = get('from');
    const to = get('to');
    if (
      (method && !PAYMENT_METHODS.includes(method as PaymentMethod)) ||
      (status && status !== 'received' && status !== 'reversed') ||
      (from && !isBusinessDate(from)) ||
      (to && !isBusinessDate(to)) ||
      (from && to && from > to)
    ) {
      return fail(422, 'INVALID_FILTERS');
    }
    const q = get('q').trim().toLowerCase();
    const items = db.payments
      .map(paymentView)
      .filter((payment) => !get('customer_id') || payment.customer_id === get('customer_id'))
      .filter(
        (payment) =>
          !q ||
          payment.customer_name.toLowerCase().includes(q) ||
          (payment.reference ?? '').toLowerCase().includes(q),
      )
      .filter((payment) => !method || payment.method === method)
      .filter((payment) => !status || payment.status === status)
      .filter((payment) => !from || payment.effective_on >= from)
      .filter((payment) => !to || payment.effective_on <= to)
      .sort(
        (a, b) =>
          b.effective_on.localeCompare(a.effective_on) ||
          b.created_at.localeCompare(a.created_at) ||
          b.id.localeCompare(a.id),
      );
    return HttpResponse.json(paged(items, url));
  }),

  http.get(`${BASE}/payments/:id`, ({ request, cookies, params }) => {
    const result = guard(request, cookies);
    if ('response' in result) return result.response;
    const payment = findPayment(String(params.id));
    return payment ? HttpResponse.json(paymentView(payment)) : fail(404, 'PAYMENT_NOT_FOUND');
  }),

  http.post(`${BASE}/payments`, async ({ request, cookies }) => {
    const result = guard(request, cookies, { write: true });
    if ('response' in result) return result.response;
    const body = (await request.json()) as Partial<PaymentWrite>;
    return idempotent(request, result.actor, 'payment', body, () => {
      const customer = findCustomer(body.customer_id ?? '');
      if (!customer) return fieldError(422, 'VALIDATION_FAILED', 'customer_id', 'REQUIRED');
      const amount = body.amount?.amount;
      if (
        typeof amount !== 'number' ||
        !Number.isSafeInteger(amount) ||
        amount <= 0 ||
        amount > 999_999_999
      ) {
        return fieldError(422, 'VALIDATION_FAILED', 'amount', 'INVALID');
      }
      if (!isBusinessDate(body.effective_on ?? '') || body.effective_on! > today()) {
        return fieldError(422, 'VALIDATION_FAILED', 'effective_on', 'INVALID');
      }
      if (!PAYMENT_METHODS.includes(body.method as PaymentMethod)) {
        return fieldError(422, 'VALIDATION_FAILED', 'method', 'INVALID');
      }
      const reference = clean(body.reference);
      const notes = clean(body.notes);
      if ((reference?.length ?? 0) > 200)
        return fieldError(422, 'VALIDATION_FAILED', 'reference', 'TOO_LONG');
      if ((notes?.length ?? 0) > 2000)
        return fieldError(422, 'VALIDATION_FAILED', 'notes', 'TOO_LONG');
      const createdAt = new Date().toISOString();
      const payment = {
        id: crypto.randomUUID(),
        version: 1,
        customer_id: customer.id,
        customer_name: customer.display_name,
        amount: { amount, currency: 'USD' as const },
        effective_on: body.effective_on!,
        method: body.method as PaymentMethod,
        reference,
        notes,
        status: 'received' as const,
        recorded_by: { id: result.actor.id, name: result.actor.name },
        created_at: createdAt,
        reversal: null,
        audit_events: [
          {
            action: 'recorded' as const,
            actor_id: result.actor.id,
            reason: null,
            created_at: createdAt,
          },
        ],
      };
      db.payments.push(payment);
      allocatePayment(payment, db.invoices, result.actor.id);
      return HttpResponse.json(paymentView(payment), { status: 201 });
    });
  }),

  http.post(`${BASE}/payments/:id/reverse`, async ({ request, cookies, params }) => {
    const result = guard(request, cookies, { write: true, admin: true });
    if ('response' in result) return result.response;
    const body = (await request.json()) as { reason?: string };
    return idempotent(request, result.actor, `reverse:${String(params.id)}`, body, () => {
      const payment = findPayment(String(params.id));
      if (!payment) return fail(404, 'PAYMENT_NOT_FOUND');
      const stale = checkVersion(request, payment.version);
      if (stale) return stale;
      const reason = clean(body.reason);
      if (!reason || reason.length > 1000) return fail(422, 'REASON_REQUIRED');
      if (payment.status === 'reversed') return fail(409, 'PAYMENT_ALREADY_REVERSED');
      const createdAt = new Date().toISOString();
      // Release its allocations so those invoices are unpaid again.
      db.allocations = db.allocations.filter((allocation) => allocation.payment_id !== payment.id);
      Object.assign(payment, {
        status: 'reversed',
        version: payment.version + 1,
        reversal: {
          reason,
          actor: { id: result.actor.id, name: result.actor.name },
          created_at: createdAt,
        },
        audit_events: [
          ...payment.audit_events,
          { action: 'reversed', actor_id: result.actor.id, reason, created_at: createdAt },
        ],
      });
      return HttpResponse.json(paymentView(payment));
    });
  }),

  http.get(`${BASE}/reports/summary`, ({ request, cookies }) => {
    const result = guard(request, cookies);
    if ('response' in result) return result.response;
    const accounts = db.customers.map((customer) => ledger(customer.id));
    const sum = (pick: (account: (typeof accounts)[number]) => number) =>
      accounts.reduce((total, account) => total + pick(account), 0);
    const monthStart = firstOfMonth(today());
    return HttpResponse.json({
      outstanding_invoices: { amount: sum((a) => a.outstanding.amount), currency: 'USD' },
      overdue_invoices: { amount: sum((a) => a.overdue.amount), currency: 'USD' },
      unbilled_parking: { amount: sum((a) => a.unbilled_parking.amount), currency: 'USD' },
      payments_received_this_month: {
        amount: db.payments
          .filter(
            (payment) =>
              payment.status === 'received' &&
              payment.effective_on >= monthStart &&
              payment.effective_on <= today(),
          )
          .reduce((total, payment) => total + payment.amount.amount, 0),
        currency: 'USD',
      },
      total_customers: db.customers.length,
      total_trucks: db.vehicles.filter(countsAsTruck).length,
    });
  }),
];
