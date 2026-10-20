import type { CustomerLedger } from '@/features/billing/api';
import type { Payment, PaymentWrite } from '@/features/payments/model';
import { findMockCustomer } from './customerHandlers';
import {
  parkingInvoices,
  unbilledParking,
  resetMockBilling,
  type ParkingInvoice,
} from './billingStore';
import { mockVehicles, currentMockParking } from './vehicleHandlers';
import { todayInTimeZone } from '@/lib/dates';

const money = (amount: number) => ({ amount, currency: 'USD' as const });
const demoCustomerId = 'c0000001-0000-4000-8000-000000000001';
export interface PaymentActor {
  id: string;
  name: string;
  role: 'admin' | 'operator';
}

function seed(): Payment[] {
  return [
    {
      id: '90000000-0000-4000-8000-000000000001',
      version: 1,
      customer_id: demoCustomerId,
      customer_name: '远航货运有限公司',
      amount: money(30000),
      allocated_amount: money(30000),
      available_credit: money(0),
      effective_on: '2026-10-01',
      method: 'bank_transfer',
      reference: 'DEMO-OPENING-RECEIPT',
      notes: null,
      status: 'received',
      recorded_by: { id: '11111111-1111-4111-8111-111111111111', name: 'Demo administrator' },
      created_at: '2026-10-01T12:00:00Z',
      reversal: null,
      audit_events: [
        {
          action: 'recorded',
          actor_id: '11111111-1111-4111-8111-111111111111',
          reason: null,
          created_at: '2026-10-01T12:00:00Z',
        },
      ],
    },
  ];
}
let records = seed();
export const paymentRequests = new Map<
  string,
  { fingerprint: string; payment_id: string; status: number; recorded_at: number }
>();
export function resetMockPayments() {
  records = seed();
  paymentRequests.clear();
  resetMockBilling();
}
export function mockPayment(id: string): Payment | undefined {
  return records.find((payment) => payment.id === id);
}
export function mockPayments(): Payment[] {
  return records;
}

export function applyMockCredit(
  customerId: string,
  invoices: ParkingInvoice[],
  actor: PaymentActor,
) {
  const candidates = records
    .filter(
      (payment) =>
        payment.customer_id === customerId &&
        payment.status === 'received' &&
        payment.available_credit.amount > 0,
    )
    .sort(
      (left, right) =>
        left.effective_on.localeCompare(right.effective_on) || left.id.localeCompare(right.id),
    );
  for (const invoice of invoices) {
    let remaining = invoice.amount;
    for (const candidate of candidates) {
      const payment = mockPayment(candidate.id)!;
      const applied = Math.min(remaining, payment.available_credit.amount);
      if (!applied) continue;
      invoice.allocations.push({ payment_id: payment.id, amount: applied });
      records = records.map((item) =>
        item.id === payment.id
          ? {
              ...item,
              version: item.version + 1,
              allocated_amount: money(item.allocated_amount.amount + applied),
              available_credit: money(item.available_credit.amount - applied),
              audit_events: [
                ...item.audit_events,
                {
                  action: 'allocated',
                  actor_id: actor.id,
                  reason: invoice.number,
                  created_at: new Date().toISOString(),
                },
              ],
            }
          : item,
      );
      remaining -= applied;
      if (!remaining) break;
    }
  }
}

export function createMockPayment(body: PaymentWrite, actor: PaymentActor): Payment {
  const createdAt = new Date().toISOString();
  const payment: Payment = {
    ...body,
    id: crypto.randomUUID(),
    version: 1,
    customer_name: findMockCustomer(body.customer_id)!.display_name,
    status: 'received',
    recorded_by: { id: actor.id, name: actor.name },
    created_at: createdAt,
    allocated_amount: money(0),
    available_credit: { ...body.amount },
    reversal: null,
    audit_events: [{ action: 'recorded', actor_id: actor.id, reason: null, created_at: createdAt }],
  };
  records = [payment, ...records];
  return payment;
}
export function reverseMockPayment(payment: Payment, reason: string, actor: PaymentActor): Payment {
  const createdAt = new Date().toISOString();
  const reversed: Payment = {
    ...payment,
    version: payment.version + 1,
    status: 'reversed',
    available_credit: money(0),
    reversal: { reason, actor: { id: actor.id, name: actor.name }, created_at: createdAt },
    audit_events: [
      ...payment.audit_events,
      { action: 'reversed', actor_id: actor.id, reason, created_at: createdAt },
    ],
  };
  records = records.map((record) => (record.id === payment.id ? reversed : record));
  return reversed;
}

export function mockCustomerLedger(customerId: string): CustomerLedger {
  const valid = records.filter(
    (payment) => payment.customer_id === customerId && payment.status === 'received',
  );
  const allocated = valid.reduce((sum, payment) => sum + payment.allocated_amount.amount, 0);
  const credit = valid.reduce((sum, payment) => sum + payment.available_credit.amount, 0);
  const invoices = parkingInvoices(customerId);
  const issuedTotal = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const newAllocated = invoices
    .flatMap((invoice) => invoice.allocations)
    .filter((allocation) => valid.some((payment) => payment.id === allocation.payment_id))
    .reduce((sum, allocation) => sum + allocation.amount, 0);
  const outstanding = Math.max(
    0,
    (customerId === demoCustomerId ? 45000 : 0) + issuedTotal - allocated,
  );
  const today = todayInTimeZone('UTC');
  const overdue =
    Math.max(0, (customerId === demoCustomerId ? 35000 : 0) - (allocated - newAllocated)) +
    invoices
      .filter((invoice) => invoice.due_on < today)
      .reduce(
        (sum, invoice) =>
          sum +
          Math.max(
            0,
            invoice.amount -
              invoice.allocations
                .filter((allocation) =>
                  valid.some((payment) => payment.id === allocation.payment_id),
                )
                .reduce((paid, allocation) => paid + allocation.amount, 0),
          ),
        0,
      );
  const monthlyTotal = mockVehicles()
    .filter(
      (vehicle) =>
        vehicle.customer_id === customerId &&
        vehicle.parking &&
        vehicle.parking.starts_on <= today &&
        (!vehicle.parking.ends_on || vehicle.parking.ends_on > today),
    )
    .reduce((sum, vehicle) => sum + currentMockParking(vehicle).parking!.monthly_rate.amount, 0);
  const pending = unbilledParking(customerId).lines.reduce(
    (sum, line) => sum + line.amount.amount,
    0,
  );
  const latest = [...valid].sort(
    (left, right) =>
      right.effective_on.localeCompare(left.effective_on) ||
      right.created_at.localeCompare(left.created_at) ||
      right.id.localeCompare(left.id),
  )[0];
  return {
    as_of: new Date().toISOString(),
    outstanding: money(outstanding),
    overdue: money(overdue),
    unapplied_credit: money(credit),
    net_balance: money(outstanding - credit),
    monthly_parking: money(monthlyTotal),
    unbilled_parking: money(pending),
    last_payment: latest
      ? {
          id: latest.id,
          amount: latest.amount,
          effective_on: latest.effective_on,
          method: latest.method,
        }
      : null,
  };
}
