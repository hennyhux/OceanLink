import { http, HttpResponse } from 'msw';
import { findMockCustomer } from './customerHandlers';
import { mockCustomerLedger, applyMockCredit } from './paymentStore';
import {
  billingReplay,
  billingRun,
  createManualDebitDraft,
  issueBilling,
  issueManualDebit,
  previewBilling,
  issuedManualDebits,
} from './billingStore';
import { isBusinessDate, todayInTimeZone } from '@/lib/dates';
import { manualDebitWriteSchema } from '@/features/billing/manualDebitModel';

export const billingHandlers = [
  http.get('/api/v1/invoices', ({ request, cookies }) => {
    if (
      !['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'].includes(
        cookies.oceanlink_mock_session ?? '',
      )
    )
      return HttpResponse.json({ code: 'SESSION_EXPIRED' }, { status: 401 });
    const params = new URL(request.url).searchParams;
    const customerId = params.get('customer_id');
    if (!customerId || !findMockCustomer(customerId))
      return HttpResponse.json({ code: 'CUSTOMER_REQUIRED' }, { status: 422 });
    const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(params.get('page_size') ?? '20', 10) || 20),
    );
    const q = params.get('q')?.trim().toLocaleLowerCase();
    const sourceType = params.get('source_type');
    const from = params.get('from');
    const to = params.get('to');
    const invoices = issuedManualDebits(customerId).filter((invoice) => {
      const description =
        `${invoice.description} ${invoice.invoice_number ?? ''}`.toLocaleLowerCase();
      const issuedOn = invoice.issued_on ?? '';
      return (
        sourceType === 'manual' &&
        (!q || description.includes(q)) &&
        (!from || issuedOn >= from) &&
        (!to || issuedOn <= to)
      );
    });
    const start = (page - 1) * pageSize;
    return HttpResponse.json({
      items: invoices.slice(start, start + pageSize),
      page,
      page_size: pageSize,
      total: invoices.length,
    });
  }),
  http.post('/api/v1/invoices', async ({ request, cookies }) => {
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
    const parsed = manualDebitWriteSchema.safeParse(await request.json());
    if (!parsed.success)
      return HttpResponse.json(
        { code: 'VALIDATION_FAILED', field_errors: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    if (!findMockCustomer(parsed.data.customer_id))
      return HttpResponse.json({ code: 'NOT_FOUND' }, { status: 404 });
    try {
      return HttpResponse.json(createManualDebitDraft(parsed.data, `${actorId}:${key}`), {
        status: 201,
      });
    } catch {
      return HttpResponse.json({ code: 'IDEMPOTENCY_CONFLICT' }, { status: 409 });
    }
  }),
  http.post('/api/v1/invoices/:id/issue', async ({ request, params, cookies }) => {
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
    try {
      return HttpResponse.json(issueManualDebit(String(params.id), `${actorId}:${key}`));
    } catch (failure) {
      const code = failure instanceof Error ? failure.message : 'INVOICE_ISSUE_FAILED';
      return HttpResponse.json(
        { code, message: code, request_id: 'mock-manual-invoice' },
        { status: code === 'NOT_FOUND' ? 404 : 409 },
      );
    }
  }),
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
