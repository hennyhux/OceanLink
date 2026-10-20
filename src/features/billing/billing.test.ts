import { describe, expect, it } from 'vitest';
import { authApi } from '@/features/auth/api';
import { vehiclesApi } from '@/features/vehicles/api';
import { paymentsApi } from '@/features/payments/api';
import { todayInTimeZone } from '@/lib/dates';
import { http } from '@/lib/api/http';
import { billingApi, type CustomerLedger } from './api';

const customer = 'c0000001-0000-4000-8000-000000000004';
const today = todayInTimeZone('UTC');
const start = `${today.slice(0, 7)}-01`;
async function prepare() {
  await authApi.login({ email: 'admin@example.com', password: 'admin-password' });
  const vehicles = [];
  for (const [index, amount] of [20000, 25000].entries()) {
    const vehicle = await vehiclesApi.create({
      customer_id: customer,
      vehicle_type: 'truck',
      unit_number: `billing-${index}`,
      usdot_number: '3456789',
      plate_number: null,
      plate_jurisdiction: null,
    });
    vehicles.push(
      await vehiclesApi.saveParking(vehicle.id, vehicle.version, {
        pool_id: 'mock-standard',
        starts_on: start,
        ends_on: null,
        effective_on: start,
        monthly_rate: { amount, currency: 'USD' },
        reason: 'Initial monthly rate',
      }),
    );
  }
  return vehicles;
}
const ledger = () => http.get<CustomerLedger>(`/customers/${customer}/ledger`);

describe('monthly parking billing', () => {
  it('requires a fresh review if a new payment changes the previewed balance', async () => {
    await prepare();
    const preview = await billingApi.preview(customer, today);
    await paymentsApi.record(
      {
        customer_id: customer,
        amount: { amount: 5000, currency: 'USD' },
        effective_on: today,
        method: 'cash',
        reference: null,
        notes: null,
      },
      crypto.randomUUID(),
    );
    await expect(billingApi.issue(preview.id, false, crypto.randomUUID())).rejects.toMatchObject({
      status: 412,
    });
    expect((await ledger()).outstanding.amount).toBe(0);
  });
  it('shows saved vehicle costs as unbilled and raises debt only when issued', async () => {
    await prepare();
    expect(await ledger()).toMatchObject({
      net_balance: { amount: 0 },
      monthly_parking: { amount: 45000 },
      unbilled_parking: { amount: 45000 },
    });
    const preview = await billingApi.preview(customer, today);
    expect(preview.lines).toHaveLength(2);
    expect(preview.total.amount).toBe(45000);
    const issued = await billingApi.issue(preview.id, false, crypto.randomUUID());
    expect(issued.invoice_numbers).toHaveLength(1);
    expect(await ledger()).toMatchObject({
      net_balance: { amount: 45000 },
      unbilled_parking: { amount: 0 },
    });
  });

  it('applies reviewed customer credit without creating a second receipt and can reverse it', async () => {
    await prepare();
    const receipt = await paymentsApi.record(
      {
        customer_id: customer,
        amount: { amount: 42000, currency: 'USD' },
        effective_on: today,
        method: 'cash',
        reference: null,
        notes: null,
      },
      crypto.randomUUID(),
    );
    const preview = await billingApi.preview(customer, today);
    expect(preview.amount_due_after_credit.amount).toBe(3000);
    await billingApi.issue(preview.id, true, crypto.randomUUID());
    expect(await ledger()).toMatchObject({
      net_balance: { amount: 3000 },
      outstanding: { amount: 3000 },
      unapplied_credit: { amount: 0 },
    });
    expect((await paymentsApi.list({ customer_id: customer })).total).toBe(1);
    const applied = await paymentsApi.get(receipt.id);
    expect(applied.allocated_amount.amount).toBe(42000);
    await paymentsApi.reverse(applied, 'Incorrect receipt', crypto.randomUUID());
    expect((await ledger()).net_balance.amount).toBe(45000);
  });

  it('replays an uncertain issue safely and never bills a vehicle period twice', async () => {
    await prepare();
    const preview = await billingApi.preview(customer, today);
    const key = crypto.randomUUID();
    const first = await billingApi.issue(preview.id, false, key);
    expect((await billingApi.issue(preview.id, false, key)).invoice_numbers).toEqual(
      first.invoice_numbers,
    );
    expect((await billingApi.preview(customer, today)).lines).toEqual([]);
    await expect(billingApi.issue(preview.id, false, crypto.randomUUID())).rejects.toMatchObject({
      status: 409,
    });
    expect((await ledger()).net_balance.amount).toBe(45000);
  });

  it('rejects a preview after a vehicle changes or another run issues its charges', async () => {
    const vehicles = await prepare();
    const stale = await billingApi.preview(customer, today);
    await vehiclesApi.update(vehicles[0]!.id, vehicles[0]!.version, { unit_number: 'New label' });
    await expect(billingApi.issue(stale.id, false, crypto.randomUUID())).rejects.toMatchObject({
      status: 412,
    });
    const first = await billingApi.preview(customer, today);
    const second = await billingApi.preview(customer, today);
    const outcomes = await Promise.allSettled([
      billingApi.issue(first.id, false, crypto.randomUUID()),
      billingApi.issue(second.id, false, crypto.randomUUID()),
    ]);
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((await ledger()).net_balance.amount).toBe(45000);
  });
});
