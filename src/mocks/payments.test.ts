import { beforeEach, describe, expect, it } from 'vitest';

import { billingApi } from '@/features/billing/api';
import { customersApi } from '@/features/customers/api';
import { paymentsApi } from '@/features/payments/api';
import type { PaymentWrite } from '@/features/payments/types';
import { vehiclesApi } from '@/features/vehicles/api';
import { http } from '@/lib/api/http';
import { addDays } from '@/lib/dates';
import { usd } from '@/lib/money';
import {
  CUSTOMER_IDS,
  db,
  invoiceRemaining,
  OPERATOR_ID,
  today,
  type InvoiceRow,
} from '@/mocks/db';
import { signIn } from '@/test/renderApp';

const customerId = CUSTOMER_IDS.dmitri;

function invoice(id: string, overrides: Partial<InvoiceRow> = {}): InvoiceRow {
  return {
    id,
    version: 1,
    customer_id: customerId,
    invoice_number: `INV-${id}`,
    status: 'issued',
    source_type: 'manual',
    description: 'Charge',
    issued_on: addDays(today(), -10),
    due_on: addDays(today(), -1),
    total: usd(10000),
    lines: [],
    ...overrides,
  };
}

function paymentWrite(amount: number): PaymentWrite {
  return {
    customer_id: customerId,
    amount: usd(amount),
    effective_on: today(),
    method: 'cash',
    reference: null,
    notes: null,
  };
}

describe('automatic payment allocation', () => {
  beforeEach(() => {
    db.invoices = [];
    db.payments = [];
    db.allocations = [];
  });

  it('pays oldest due dates first, then issue dates and IDs, across all invoice sources', async () => {
    await signIn('operator');
    const older = addDays(today(), -2);
    db.invoices = [
      invoice('future', { due_on: addDays(today(), 10) }),
      invoice('c', { issued_on: addDays(today(), -5) }),
      invoice('b', { source_type: 'monthly_parking' }),
      invoice('a', { source_type: 'opening_balance' }),
      invoice('oldest', { due_on: older }),
    ];

    const payment = await paymentsApi.record(paymentWrite(35000), 'ordered');

    expect(db.allocations.map(({ invoice_id, amount }) => [invoice_id, amount])).toEqual([
      ['oldest', 10000],
      ['a', 10000],
      ['b', 10000],
      ['c', 5000],
    ]);
    expect(payment.allocated_amount).toEqual(usd(35000));
    expect(payment.available_credit).toEqual(usd(0));
    expect(payment.version).toBe(5);
    expect(payment.audit_events.filter((event) => event.action === 'allocated')).toEqual(
      ['oldest', 'a', 'b', 'c'].map((id) => ({
        action: 'allocated',
        actor_id: OPERATOR_ID,
        reason: `INV-${id}`,
        created_at: expect.any(String),
      })),
    );
  });

  it.each([
    [30000, 15000, 0],
    [45000, 0, 0],
    [50000, 0, 5000],
  ])('allocates %i cents and leaves %i outstanding and %i credit', async (amount, owed, credit) => {
    await signIn();
    db.invoices = [invoice('450', { total: usd(45000), source_type: 'monthly_parking' })];

    const payment = await paymentsApi.record(paymentWrite(amount), 'financial-example');
    expect(payment.allocated_amount).toEqual(usd(Math.min(amount, 45000)));
    expect(payment.available_credit).toEqual(usd(credit));
    expect(invoiceRemaining(db.invoices[0]!)).toBe(owed);
    const ledger = await billingApi.ledger(customerId);
    expect(ledger.outstanding).toEqual(usd(owed));
    expect(ledger.overdue).toEqual(usd(owed));
    expect(ledger.unapplied_credit).toEqual(usd(credit));
    expect(ledger.net_balance).toEqual(usd(owed - credit));
    const customers = await customersApi.list({});
    expect(customers.items.find((customer) => customer.id === customerId)?.net_balance).toEqual(
      usd(owed - credit),
    );
    const summary = await http.get<{ outstanding_invoices: { amount: number } }>(
      '/reports/summary',
    );
    expect(summary.outstanding_invoices.amount).toBe(owed);
  });

  it('skips paid, draft, void, and other-customer invoices but pays invoices not yet due', async () => {
    await signIn();
    db.invoices = [invoice('paid')];
    await paymentsApi.record(paymentWrite(10000), 'pay-first');
    db.invoices.push(
      invoice('draft', { status: 'draft', invoice_number: null, issued_on: null }),
      invoice('void', { status: 'void' }),
      invoice('other', { customer_id: CUSTOMER_IDS.pacific }),
      invoice('future', { due_on: addDays(today(), 10) }),
    );
    const payment = await paymentsApi.record(paymentWrite(15000), 'eligible');
    expect(
      db.allocations
        .filter((allocation) => allocation.payment_id === payment.id)
        .map(({ invoice_id, amount }) => [invoice_id, amount]),
    ).toEqual([['future', 10000]]);
    expect((await billingApi.ledger(customerId)).unapplied_credit).toEqual(usd(5000));
  });

  it('leaves full credit without invoices and does not consume existing credit on a new payment', async () => {
    await signIn();
    const existing = await paymentsApi.record(paymentWrite(7000), 'before-invoice');
    expect(existing.allocated_amount).toEqual(usd(0));
    expect(existing.available_credit).toEqual(usd(7000));
    db.invoices = [invoice('new')];
    const payment = await paymentsApi.record(paymentWrite(3000), 'after-invoice');
    expect(db.allocations).toEqual([{ payment_id: payment.id, invoice_id: 'new', amount: 3000 }]);
    expect((await paymentsApi.get(existing.id)).available_credit).toEqual(usd(7000));
    expect(invoiceRemaining(db.invoices[0]!)).toBe(7000);
  });

  it('replays recording without duplicate allocations and reversal restores all unpaid balances', async () => {
    await signIn();
    db.invoices = [invoice('a'), invoice('b')];
    const body = paymentWrite(15000);
    const payment = await paymentsApi.record(body, 'record-once');
    expect(await paymentsApi.record(body, 'record-once')).toEqual(payment);
    expect(db.payments).toHaveLength(1);
    expect(db.allocations).toHaveLength(2);
    await expect(paymentsApi.record(paymentWrite(16000), 'record-once')).rejects.toMatchObject({
      status: 409,
      code: 'IDEMPOTENCY_CONFLICT',
    });

    const reversed = await paymentsApi.reverse(payment, 'Entered twice', 'reverse-once');
    expect(await paymentsApi.reverse(payment, 'Entered twice', 'reverse-once')).toEqual(reversed);
    expect(reversed.allocated_amount).toEqual(usd(0));
    expect(reversed.available_credit).toEqual(usd(0));
    expect(reversed.version).toBe(payment.version + 1);
    expect(db.allocations).toHaveLength(0);
    expect((await billingApi.ledger(customerId)).outstanding).toEqual(usd(20000));
  });

  it('preserves credit application on monthly issue and records the actual operator', async () => {
    await signIn('operator');
    const payment = await paymentsApi.record(paymentWrite(30000), 'credit');
    await vehiclesApi.create({
      customer_id: customerId,
      vehicle_type: 'truck',
      unit_number: 'A1',
      usdot_number: '3456789',
      plate_number: null,
      plate_jurisdiction: null,
      parking: {
        starts_on: today(),
        ends_on: null,
        monthly_rate: usd(45000),
        effective_on: today(),
        reason: 'Setup',
      },
    });
    const run = await billingApi.preview(customerId, today());
    const issued = await billingApi.issue(run.id, true, 'issue');
    const allocated = await paymentsApi.get(payment.id);
    expect(allocated.allocated_amount).toEqual(usd(30000));
    expect(allocated.available_credit).toEqual(usd(0));
    expect(allocated.audit_events.at(-1)).toMatchObject({
      action: 'allocated',
      actor_id: OPERATOR_ID,
      reason: issued.invoice_numbers[0],
    });
    expect((await billingApi.ledger(customerId)).net_balance).toEqual(usd(15000));
  });

  it('still allocates payments for inactive customers', async () => {
    await signIn('operator');
    const customer = await customersApi.get(customerId);
    await customersApi.setActive(customerId, customer.version, false);
    db.invoices = [invoice('inactive-customer')];
    const payment = await paymentsApi.record(paymentWrite(5000), 'inactive');
    expect(payment.allocated_amount).toEqual(usd(5000));
    expect((await billingApi.ledger(customerId)).outstanding).toEqual(usd(5000));
  });

  it('rejects a billing preview after automatic allocation changes the outstanding balance', async () => {
    await signIn();
    db.invoices = [invoice('unpaid')];
    const run = await billingApi.preview(customerId, today());
    await paymentsApi.record(paymentWrite(5000), 'after-preview');
    await expect(billingApi.issue(run.id, true, 'stale-issue')).rejects.toMatchObject({
      status: 412,
      code: 'BILLING_PREVIEW_STALE',
    });
  });
});
