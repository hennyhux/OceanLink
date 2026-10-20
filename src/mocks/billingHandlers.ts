import { http, HttpResponse } from 'msw';
import { findMockCustomer } from './customerHandlers';
import { mockCustomerLedger, applyMockCredit } from './paymentStore';
import { billingReplay, billingRun, issueBilling, previewBilling } from './billingStore';
import { isBusinessDate, todayInTimeZone } from '@/lib/dates';

export const billingHandlers = [
  http.post('/api/v1/billing-runs/preview', async ({ request, cookies }) => {
    if (
      !['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'].includes(
        cookies.oceanlink_mock_session ?? '',
      )
    )
      return HttpResponse.json({ code: 'SESSION_EXPIRED' }, { status: 401 });
    if (request.headers.get('x-requested-with') !== 'XMLHttpRequest')
      return HttpResponse.json({ code: 'CSRF_REJECTED' }, { status: 403 });
    const body = (await request.json()) as { customer_id: string; through_date: string };
    if (
      !findMockCustomer(body.customer_id) ||
      !isBusinessDate(body.through_date) ||
      body.through_date > todayInTimeZone('UTC')
    )
      return HttpResponse.json({ code: 'INVALID_BILLING_RANGE' }, { status: 422 });
    const ledger = mockCustomerLedger(body.customer_id);
    return HttpResponse.json(
      previewBilling(
        body.customer_id,
        body.through_date,
        ledger.unapplied_credit.amount,
        ledger.outstanding.amount,
      ),
    );
  }),
  http.post('/api/v1/billing-runs/:id/issue', async ({ request, params, cookies }) => {
    const actorId = cookies.oceanlink_mock_session;
    if (
      !['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'].includes(
        actorId ?? '',
      )
    )
      return HttpResponse.json({ code: 'SESSION_EXPIRED' }, { status: 401 });
    if (request.headers.get('x-requested-with') !== 'XMLHttpRequest')
      return HttpResponse.json({ code: 'CSRF_REJECTED' }, { status: 403 });
    const key = request.headers.get('idempotency-key');
    if (!key) return HttpResponse.json({ code: 'IDEMPOTENCY_REQUIRED' }, { status: 400 });
    const body = (await request.json()) as { apply_credit: boolean };
    if (typeof body.apply_credit !== 'boolean')
      return HttpResponse.json({ code: 'INVALID_BILLING' }, { status: 422 });
    const runId = String(params.id);
    try {
      const replay = billingReplay(`${actorId}:${key}`, runId, body.apply_credit);
      if (replay) return HttpResponse.json(replay);
      const run = billingRun(runId);
      if (!run) return HttpResponse.json({ code: 'NOT_FOUND' }, { status: 404 });
      const ledger = mockCustomerLedger(run.customer_id);
      const result = issueBilling(
        runId,
        `${actorId}:${key}`,
        body.apply_credit,
        ledger.unapplied_credit.amount,
        ledger.outstanding.amount,
      );
      if (body.apply_credit)
        applyMockCredit(run.customer_id, result.invoices, {
          id: actorId!,
          name: 'Demo staff',
          role: actorId === '11111111-1111-4111-8111-111111111111' ? 'admin' : 'operator',
        });
      return HttpResponse.json(result.run);
    } catch (failure) {
      const code = failure instanceof Error ? failure.message : 'BILLING_FAILED';
      return HttpResponse.json(
        { code, message: code, request_id: 'mock-billing' },
        { status: code === 'BILLING_PREVIEW_STALE' ? 412 : 409 },
      );
    }
  }),
  http.get('/api/v1/customers/:id/ledger', ({ params }) => {
    if (!findMockCustomer(String(params.id)))
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'Not found' }, { status: 404 });
    return HttpResponse.json(mockCustomerLedger(String(params.id)));
  }),
];
