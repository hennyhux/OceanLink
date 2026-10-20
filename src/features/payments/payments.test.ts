import { describe, expect, it } from 'vitest';
import { http } from '@/lib/api/http';
import { todayInTimeZone } from '@/lib/dates';
import { authApi } from '@/features/auth/api';
import type { CustomerLedger } from '@/features/billing/api';
import { paymentsApi } from './api';
import type { PaymentWrite } from './model';

const customerId = 'c0000001-0000-4000-8000-000000000002';
const today = todayInTimeZone('UTC');
const receipt: PaymentWrite = {
  customer_id: customerId,
  amount: { amount: 30000, currency: 'USD' },
  effective_on: today,
  method: 'cash',
  reference: null,
  notes: null,
};
const login = (role = 'admin') =>
  authApi.login({ email: `${role}@example.com`, password: `${role}-password` });
const ledger = (id = customerId) => http.get<CustomerLedger>(`/customers/${id}/ledger`);

describe('recorded payment API contract', () => {
  it('records money as customer credit without inventing invoices', async () => {
    await login();
    const payment = await paymentsApi.record(receipt, crypto.randomUUID());
    expect(payment.amount.amount).toBe(30000);
    expect(payment.allocated_amount.amount).toBe(0);
    expect(payment.available_credit.amount).toBe(30000);
    expect(payment.recorded_by.id).toBeTruthy();
    expect(payment.audit_events).toHaveLength(1);
    expect(await ledger()).toMatchObject({
      outstanding: { amount: 0 },
      unapplied_credit: { amount: 30000 },
      net_balance: { amount: -30000 },
      last_payment: { id: payment.id, amount: { amount: 30000 } },
    });
  });

  it('replays a receipt and rejects reuse of its key with different content', async () => {
    await login();
    const key = crypto.randomUUID();
    const first = await paymentsApi.record(receipt, key);
    expect((await paymentsApi.record(receipt, key)).id).toBe(first.id);
    await expect(
      paymentsApi.record({ ...receipt, amount: { amount: 10000, currency: 'USD' } }, key),
    ).rejects.toMatchObject({ status: 409, code: 'IDEMPOTENCY_CONFLICT' });
    expect((await paymentsApi.list({ customer_id: customerId })).total).toBe(1);
    expect((await ledger()).unapplied_credit.amount).toBe(30000);
  });

  it('treats concurrent retries as one receipt', async () => {
    await login();
    const key = crypto.randomUUID();
    const results = await Promise.all([
      paymentsApi.record(receipt, key),
      paymentsApi.record(receipt, key),
    ]);
    expect(results[0]?.id).toBe(results[1]?.id);
    expect((await paymentsApi.list({ customer_id: customerId })).total).toBe(1);
  });

  it('requires idempotency, positive amounts and non-future dates', async () => {
    await login();
    await expect(http.post('/payments', receipt)).rejects.toMatchObject({ status: 400 });
    await expect(
      paymentsApi.record(
        { ...receipt, amount: { amount: 0, currency: 'USD' } },
        crypto.randomUUID(),
      ),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      paymentsApi.record({ ...receipt, effective_on: '9999-01-01' }, crypto.randomUUID()),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('allows collection from an inactive customer', async () => {
    await login('operator');
    const payment = await paymentsApi.record(
      { ...receipt, customer_id: 'c0000001-0000-4000-8000-000000000005' },
      crypto.randomUUID(),
    );
    expect(payment.status).toBe('received');
  });

  it('keeps issued balances separate from unapplied receipts', async () => {
    await login();
    const id = 'c0000001-0000-4000-8000-000000000001';
    await paymentsApi.record(
      { ...receipt, customer_id: id, amount: { amount: 10000, currency: 'USD' } },
      crypto.randomUUID(),
    );
    expect(await ledger(id)).toMatchObject({
      outstanding: { amount: 15000 },
      overdue: { amount: 5000 },
      unapplied_credit: { amount: 10000 },
      net_balance: { amount: 5000 },
    });
  });

  it('reverses an erroneous receipt once, restores credit and retains its audit history', async () => {
    await login();
    const payment = await paymentsApi.record(receipt, crypto.randomUUID());
    const key = crypto.randomUUID();
    const reversed = await paymentsApi.reverse(payment, 'Entered twice by mistake', key);
    expect(reversed.status).toBe('reversed');
    expect(reversed.reversal?.reason).toBe('Entered twice by mistake');
    expect(reversed.audit_events.map((event) => event.action)).toEqual(['recorded', 'reversed']);
    expect((await paymentsApi.reverse(payment, 'Entered twice by mistake', key)).version).toBe(2);
    expect(await ledger()).toMatchObject({
      net_balance: { amount: 0 },
      unapplied_credit: { amount: 0 },
      last_payment: null,
    });
    expect((await paymentsApi.list({ customer_id: customerId })).total).toBe(1);
  });

  it('requires admin access, a reason and a matching version for reversal', async () => {
    await login();
    const payment = await paymentsApi.record(receipt, crypto.randomUUID());
    await expect(paymentsApi.reverse(payment, '', crypto.randomUUID())).rejects.toMatchObject({
      status: 422,
    });
    await expect(
      paymentsApi.reverse({ ...payment, version: 0 }, 'Wrong version', crypto.randomUUID()),
    ).rejects.toMatchObject({ status: 412 });
    await login('operator');
    await expect(
      paymentsApi.reverse(payment, 'Operator correction', crypto.randomUUID()),
    ).rejects.toMatchObject({ status: 403 });
    expect((await paymentsApi.get(payment.id)).status).toBe('received');
  });

  it('restores historical allocations on reversal without creating a refund', async () => {
    await login();
    const seed = await paymentsApi.get('90000000-0000-4000-8000-000000000001');
    await paymentsApi.reverse(seed, 'Correct imported receipt', crypto.randomUUID());
    expect(await ledger(seed.customer_id)).toMatchObject({
      outstanding: { amount: 45000 },
      overdue: { amount: 35000 },
      last_payment: null,
    });
    expect((await paymentsApi.list({ customer_id: seed.customer_id })).items).toHaveLength(1);
  });

  it('selects latest payment by effective date rather than recording order', async () => {
    await login();
    const recent = await paymentsApi.record(receipt, crypto.randomUUID());
    await paymentsApi.record({ ...receipt, effective_on: '2026-01-01' }, crypto.randomUUID());
    expect((await ledger()).last_payment?.id).toBe(recent.id);
    await paymentsApi.reverse(recent, 'Incorrect recent receipt', crypto.randomUUID());
    expect((await ledger()).last_payment?.effective_on).toBe('2026-01-01');
  });

  it('filters by customer, date, method and reference with deterministic pagination', async () => {
    await login();
    for (let index = 0; index < 22; index += 1) {
      await paymentsApi.record(
        { ...receipt, reference: `CHECK-${index}`, method: 'check' },
        crypto.randomUUID(),
      );
    }
    const first = await paymentsApi.list({
      customer_id: customerId,
      q: 'CHECK-',
      method: 'check',
      from: today,
      to: today,
      page: 1,
    });
    const second = await paymentsApi.list({
      customer_id: customerId,
      q: 'CHECK-',
      method: 'check',
      from: today,
      to: today,
      page: 2,
    });
    expect(first.total).toBe(22);
    expect(first.items).toHaveLength(20);
    expect(second.items).toHaveLength(2);
    expect(new Set([...first.items, ...second.items].map((payment) => payment.id)).size).toBe(22);
  });
});
