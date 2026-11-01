import { HttpResponse, http } from 'msw';

import type { BillingRun, ManualChargeWrite, MonthlyCharge } from '@/features/billing/types';
import { isBusinessDate } from '@/lib/dates';
import { usd } from '@/lib/money';

import {
  applyCredit,
  db,
  findCustomer,
  invoiceView,
  ledger,
  nextInvoiceNumber,
  today,
  unbilledCharges,
  type InvoiceRow,
} from '../db';
import { BASE, clean, fail, fieldError, guard, idempotent, paged } from './util';

// Anything that would change the preview: vehicle versions, balances, and credit.
function snapshot(customerId: string): string {
  const account = ledger(customerId);
  return JSON.stringify({
    vehicles: db.vehicles
      .filter((item) => item.customer_id === customerId)
      .map((item) => [item.id, item.version]),
    outstanding: account.outstanding.amount,
    credit: account.unapplied_credit.amount,
  });
}

export const billingHandlers = [
  http.post(`${BASE}/billing-runs/preview`, async ({ request, cookies }) => {
    const result = guard(request, cookies, { write: true });
    if ('response' in result) return result.response;
    const body = (await request.json()) as { customer_id?: string; through_date?: string };
    const customer = findCustomer(body.customer_id ?? '');
    if (!customer) return fail(404, 'CUSTOMER_NOT_FOUND');
    const through = body.through_date ?? '';
    if (!isBusinessDate(through) || through > today()) return fail(422, 'INVALID_BILLING_RANGE');
    const { lines, alreadyBilled } = unbilledCharges(customer.id, through);
    const total = lines.reduce((sum, line) => sum + line.amount.amount, 0);
    const account = ledger(customer.id);
    const credit = account.unapplied_credit.amount;
    const run: BillingRun = {
      id: crypto.randomUUID(),
      customer_id: customer.id,
      through_date: through,
      lines,
      total: usd(total),
      credit_available: usd(credit),
      amount_due_after_credit: usd(Math.max(0, account.outstanding.amount + total - credit)),
      already_billed_count: alreadyBilled,
      status: 'preview',
      invoice_numbers: [],
    };
    db.billingRuns.set(run.id, { run, fingerprint: snapshot(customer.id) });
    return HttpResponse.json(run);
  }),

  http.post(`${BASE}/billing-runs/:id/issue`, async ({ request, cookies, params }) => {
    const result = guard(request, cookies, { write: true });
    if ('response' in result) return result.response;
    const body = (await request.json()) as { apply_credit?: boolean };
    return idempotent(request, result.actor, `billing:${String(params.id)}`, body, () => {
      const saved = db.billingRuns.get(String(params.id));
      if (!saved) return fail(404, 'BILLING_RUN_NOT_FOUND');
      const { run } = saved;
      if (run.status === 'issued') return fail(409, 'ALREADY_ISSUED');
      if (snapshot(run.customer_id) !== saved.fingerprint)
        return fail(412, 'BILLING_PREVIEW_STALE');
      const open = new Set(
        unbilledCharges(run.customer_id, run.through_date).lines.map((l) => l.key),
      );
      if (!run.lines.length || run.lines.some((line) => !open.has(line.key))) {
        return fail(409, 'VEHICLE_PERIOD_ALREADY_BILLED');
      }
      // Lines with the same due date share one invoice. Due date is the period start, or today.
      const issuedOn = today();
      const groups = new Map<string, MonthlyCharge[]>();
      for (const line of run.lines) {
        const due = line.starts_on > issuedOn ? line.starts_on : issuedOn;
        groups.set(due, [...(groups.get(due) ?? []), line]);
      }
      const created: InvoiceRow[] = [...groups].map(([due, lines]) => ({
        id: crypto.randomUUID(),
        version: 1,
        customer_id: run.customer_id,
        invoice_number: nextInvoiceNumber(),
        status: 'issued',
        source_type: 'monthly_parking',
        description: null,
        issued_on: issuedOn,
        due_on: due,
        total: usd(lines.reduce((sum, line) => sum + line.amount.amount, 0)),
        lines: structuredClone(lines),
      }));
      db.invoices.push(...created);
      if (body.apply_credit)
        applyCredit(
          run.customer_id,
          created.map((invoice) => invoice.id),
          result.actor.id,
        );
      run.status = 'issued';
      run.invoice_numbers = created.map((invoice) => invoice.invoice_number ?? '');
      return HttpResponse.json(run);
    });
  }),

  http.get(`${BASE}/invoices`, ({ request, cookies }) => {
    const result = guard(request, cookies);
    if ('response' in result) return result.response;
    const url = new URL(request.url);
    const customerId = url.searchParams.get('customer_id');
    if (!customerId) return fail(422, 'CUSTOMER_REQUIRED');
    const source = url.searchParams.get('source_type');
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const items = db.invoices
      .filter((invoice) => invoice.customer_id === customerId && invoice.status === 'issued')
      .filter((invoice) => !source || invoice.source_type === source)
      .filter(
        (invoice) =>
          !q ||
          invoice.invoice_number?.toLowerCase().includes(q) ||
          invoice.description?.toLowerCase().includes(q),
      )
      .filter((invoice) => !from || (invoice.issued_on ?? '') >= from)
      .filter((invoice) => !to || (invoice.issued_on ?? '') <= to)
      .sort(
        (a, b) => (b.issued_on ?? '').localeCompare(a.issued_on ?? '') || b.id.localeCompare(a.id),
      )
      .map(invoiceView);
    return HttpResponse.json(paged(items, url));
  }),

  http.post(`${BASE}/invoices`, async ({ request, cookies }) => {
    const result = guard(request, cookies, { write: true });
    if ('response' in result) return result.response;
    const body = (await request.json()) as Partial<ManualChargeWrite>;
    return idempotent(request, result.actor, 'invoice-draft', body, () => {
      if (!findCustomer(body.customer_id ?? '')) return fail(404, 'CUSTOMER_NOT_FOUND');
      const description = clean(body.description);
      if (!description || description.length > 200) {
        return fieldError(422, 'VALIDATION_FAILED', 'description', 'REQUIRED');
      }
      const amount = body.amount?.amount;
      if (
        typeof amount !== 'number' ||
        !Number.isSafeInteger(amount) ||
        amount <= 0 ||
        amount > 999_999_999
      ) {
        return fieldError(422, 'VALIDATION_FAILED', 'amount', 'INVALID');
      }
      if (!isBusinessDate(body.due_on ?? '')) {
        return fieldError(422, 'VALIDATION_FAILED', 'due_on', 'INVALID');
      }
      const draft: InvoiceRow = {
        id: crypto.randomUUID(),
        version: 1,
        customer_id: body.customer_id!,
        invoice_number: null,
        status: 'draft',
        source_type: 'manual',
        description,
        issued_on: null,
        due_on: body.due_on!,
        total: usd(amount),
        lines: [],
      };
      db.invoices.push(draft);
      return HttpResponse.json(invoiceView(draft), { status: 201 });
    });
  }),

  http.post(`${BASE}/invoices/:id/issue`, async ({ request, cookies, params }) => {
    const result = guard(request, cookies, { write: true });
    if ('response' in result) return result.response;
    return idempotent(request, result.actor, `invoice-issue:${String(params.id)}`, {}, () => {
      const invoice = db.invoices.find((item) => item.id === params.id);
      if (!invoice) return fail(404, 'INVOICE_NOT_FOUND');
      if (invoice.status !== 'draft') return fail(409, 'ALREADY_ISSUED');
      Object.assign(invoice, {
        status: 'issued',
        invoice_number: nextInvoiceNumber(),
        issued_on: today(),
        version: invoice.version + 1,
      });
      return HttpResponse.json(invoiceView(invoice));
    });
  }),
];
