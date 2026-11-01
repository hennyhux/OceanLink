import type { SessionResponse, User } from '@/features/auth/types';
import type { BillingRun, CustomerLedger, Invoice, MonthlyCharge } from '@/features/billing/types';
import type { Customer } from '@/features/customers/types';
import type { Payment } from '@/features/payments/types';
import type { Vehicle } from '@/features/vehicles/types';
import { addDays, firstOfMonth, todayInTimeZone } from '@/lib/dates';
import { usd } from '@/lib/money';

import { monthlyCharges } from './monthlyCharges';

// In-memory backend for development and tests. Synthetic data only, not real people.

export const LOT = {
  id: 'l0000001-0000-4000-8000-000000000001',
  name: 'Demo Truck Parking',
  time_zone: 'America/Los_Angeles',
  currency: 'USD' as const,
};

export const today = () => todayInTimeZone(LOT.time_zone);

export const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
export const OPERATOR_ID = '22222222-2222-4222-8222-222222222222';

export const USERS: ReadonlyArray<User & { password: string }> = [
  {
    id: ADMIN_ID,
    email: 'admin@example.com',
    name: 'Ada Admin',
    role: 'admin',
    is_active: true,
    preferred_language: 'zh-CN',
    must_change_password: false,
    password: 'admin-password',
  },
  {
    id: OPERATOR_ID,
    email: 'operator@example.com',
    name: 'Oscar Operator',
    role: 'operator',
    is_active: true,
    preferred_language: 'zh-CN',
    must_change_password: false,
    password: 'operator-password',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    email: 'inactive@example.com',
    name: 'Former Staff',
    role: 'operator',
    is_active: false,
    preferred_language: 'en',
    must_change_password: false,
    password: 'inactive-password',
  },
];

export const CUSTOMER_IDS = {
  yuanhang: 'c0000001-0000-4000-8000-000000000001',
  pacific: 'c0000001-0000-4000-8000-000000000002',
  liqiang: 'c0000001-0000-4000-8000-000000000003',
  dmitri: 'c0000001-0000-4000-8000-000000000004',
  jinqiao: 'c0000001-0000-4000-8000-000000000005',
} as const;

export interface InvoiceRow extends Invoice {
  lines: MonthlyCharge[];
}

interface Allocation {
  payment_id: string;
  invoice_id: string;
  amount: number;
}

type StoredPayment = Omit<Payment, 'allocated_amount' | 'available_credit'>;

interface IdempotencyRecord {
  actor: string;
  fingerprint: string;
  status: number;
  body: unknown;
}

interface Db {
  customers: Customer[];
  vehicles: Vehicle[];
  invoices: InvoiceRow[];
  payments: StoredPayment[];
  allocations: Allocation[];
  billingRuns: Map<string, { run: BillingRun; fingerprint: string }>;
  sessions: Map<string, { userId: string; idleExpiresAt: number; absoluteExpiresAt: number }>;
  idempotency: Map<string, IdempotencyRecord>;
  invoiceCounter: number;
  requestCounter: number;
}

function customer(partial: Partial<Customer> & Pick<Customer, 'id' | 'display_name'>): Customer {
  return {
    version: 1,
    type: 'business',
    contact_name: null,
    phone: null,
    email: null,
    usdot_number: null,
    address_line1: null,
    address_line2: null,
    city: null,
    state: null,
    postal_code: null,
    notes: null,
    is_active: true,
    created_at: '2026-09-01T12:00:00Z',
    updated_at: '2026-09-01T12:00:00Z',
    ...partial,
  };
}

function vehicle(
  partial: Partial<Vehicle> & Pick<Vehicle, 'id' | 'customer_id' | 'vehicle_type'>,
): Vehicle {
  return {
    version: 1,
    customer_name: '',
    unit_number: null,
    plate_number: null,
    plate_jurisdiction: null,
    usdot_number: null,
    is_active: true,
    created_at: '2026-09-02T12:00:00Z',
    updated_at: '2026-09-02T12:00:00Z',
    parking: null,
    ...partial,
  };
}

function seed(): Db {
  const now = today();
  const customers = [
    customer({
      id: CUSTOMER_IDS.yuanhang,
      display_name: '远航货运有限公司',
      contact_name: '王建国',
      phone: '(555) 010-1001',
      email: 'dispatch@yuanhang.example',
      usdot_number: '1234567',
      address_line1: '100 Harbor Way',
      city: 'Oakland',
      state: 'CA',
      postal_code: '94607',
    }),
    customer({
      id: CUSTOMER_IDS.pacific,
      display_name: 'Pacific Haul LLC',
      contact_name: 'Maria Lopez',
      phone: '(555) 010-1002',
      usdot_number: '2345678',
      city: 'Hayward',
      state: 'CA',
    }),
    customer({
      id: CUSTOMER_IDS.liqiang,
      type: 'individual',
      display_name: '李强',
      phone: '(555) 010-1003',
      notes: '只有一辆车，月底付款。',
    }),
    customer({
      id: CUSTOMER_IDS.dmitri,
      type: 'individual',
      display_name: 'Dmitri Volkov',
      phone: '(555) 010-1004',
      email: 'dmitri@example.com',
      usdot_number: '3456789',
    }),
    customer({
      id: CUSTOMER_IDS.jinqiao,
      display_name: '金桥物流',
      contact_name: '陈美玲',
      phone: '(555) 010-1005',
      usdot_number: '4567890',
      is_active: false,
      notes: '2026 年 6 月停用。',
    }),
  ];
  const name = (id: string) => customers.find((item) => item.id === id)?.display_name ?? '';
  const parkingStart = firstOfMonth(now);
  const vehicles = [
    vehicle({
      id: 'v0000001-0000-4000-8000-000000000001',
      customer_id: CUSTOMER_IDS.yuanhang,
      vehicle_type: 'truck',
      usdot_number: '1234567',
      unit_number: '12',
    }),
    vehicle({
      id: 'v0000001-0000-4000-8000-000000000002',
      customer_id: CUSTOMER_IDS.yuanhang,
      vehicle_type: 'truck',
      usdot_number: '1234567',
      unit_number: '14',
    }),
    vehicle({
      id: 'v0000001-0000-4000-8000-000000000003',
      customer_id: CUSTOMER_IDS.yuanhang,
      vehicle_type: 'trailer',
      plate_number: 'TRL 4821',
      plate_jurisdiction: 'CA',
    }),
    vehicle({
      id: 'v0000001-0000-4000-8000-000000000004',
      customer_id: CUSTOMER_IDS.pacific,
      vehicle_type: 'combination',
      usdot_number: '2345678',
      unit_number: '7',
      plate_number: '8XYZ123',
      plate_jurisdiction: 'CA',
      parking: {
        starts_on: parkingStart,
        ends_on: null,
        monthly_rate: usd(28000),
        rate_history: [
          { effective_on: parkingStart, monthly_rate: usd(28000), reason: 'Monthly customer' },
        ],
      },
    }),
    vehicle({
      id: 'v0000001-0000-4000-8000-000000000005',
      customer_id: CUSTOMER_IDS.liqiang,
      vehicle_type: 'truck',
      plate_number: '6ABC789',
      plate_jurisdiction: 'CA',
    }),
    vehicle({
      id: 'v0000001-0000-4000-8000-000000000006',
      customer_id: CUSTOMER_IDS.pacific,
      vehicle_type: 'truck',
      plate_number: 'OLD 1234',
      plate_jurisdiction: 'CA',
      is_active: false,
    }),
    vehicle({
      id: 'v0000001-0000-4000-8000-000000000007',
      customer_id: CUSTOMER_IDS.jinqiao,
      vehicle_type: 'truck',
      usdot_number: '4567890',
      unit_number: '3',
      is_active: false,
    }),
  ].map((item) => ({ ...item, customer_name: name(item.customer_id) }));

  // Opening balances for the first customer: $350 overdue (partly paid) and $100 not due yet.
  const invoices: InvoiceRow[] = [
    {
      id: 'i0000001-0000-4000-8000-000000000001',
      version: 1,
      customer_id: CUSTOMER_IDS.yuanhang,
      invoice_number: 'OL-000001',
      status: 'issued',
      source_type: 'opening_balance',
      description: 'Opening balance',
      issued_on: addDays(now, -60),
      due_on: addDays(now, -45),
      total: usd(35000),
      lines: [],
    },
    {
      id: 'i0000001-0000-4000-8000-000000000002',
      version: 1,
      customer_id: CUSTOMER_IDS.yuanhang,
      invoice_number: 'OL-000002',
      status: 'issued',
      source_type: 'opening_balance',
      description: 'Opening balance',
      issued_on: addDays(now, -5),
      due_on: addDays(now, 10),
      total: usd(10000),
      lines: [],
    },
  ];
  const paymentId = 'p0000001-0000-4000-8000-000000000001';
  const payments: StoredPayment[] = [
    {
      id: paymentId,
      version: 1,
      customer_id: CUSTOMER_IDS.yuanhang,
      customer_name: name(CUSTOMER_IDS.yuanhang),
      amount: usd(30000),
      effective_on: firstOfMonth(now),
      method: 'bank_transfer',
      reference: 'WIRE-1001',
      notes: null,
      status: 'received',
      recorded_by: { id: ADMIN_ID, name: 'Ada Admin' },
      created_at: `${firstOfMonth(now)}T18:00:00Z`,
      reversal: null,
      audit_events: [
        {
          action: 'recorded',
          actor_id: ADMIN_ID,
          reason: null,
          created_at: `${firstOfMonth(now)}T18:00:00Z`,
        },
      ],
    },
  ];
  return {
    customers,
    vehicles,
    invoices,
    payments,
    allocations: [
      { payment_id: paymentId, invoice_id: 'i0000001-0000-4000-8000-000000000001', amount: 30000 },
    ],
    billingRuns: new Map(),
    sessions: new Map(),
    idempotency: new Map(),
    invoiceCounter: 2,
    requestCounter: 0,
  };
}

export let db: Db = seed();

export function resetDb(): void {
  db = seed();
}

export function nextRequestId(): string {
  db.requestCounter += 1;
  return `mock-${String(db.requestCounter).padStart(5, '0')}`;
}

export function nextInvoiceNumber(): string {
  db.invoiceCounter += 1;
  return `OL-${String(db.invoiceCounter).padStart(6, '0')}`;
}

// Sessions

const IDLE_MS = 30 * 60_000;
const ABSOLUTE_MS = 8 * 3_600_000;

export function publicUser(user: User & { password: string }): User {
  const { id, email, name, role, is_active, preferred_language, must_change_password } = user;
  return { id, email, name, role, is_active, preferred_language, must_change_password };
}

export function createSession(userId: string): string {
  const id = `${userId}.${crypto.randomUUID()}`;
  const now = Date.now();
  db.sessions.set(id, {
    userId,
    idleExpiresAt: now + IDLE_MS,
    absoluteExpiresAt: now + ABSOLUTE_MS,
  });
  return id;
}

// In the browser the mock data resets on every page reload. Restoring the session from its
// cookie keeps staff signed in during a demo. Tests leave this off so each test starts clean.
let restoreSessions = false;
export function enableSessionRestore(): void {
  restoreSessions = true;
}

export function sessionBody(sessionId: string): SessionResponse | undefined {
  if (restoreSessions && !db.sessions.has(sessionId)) {
    const userId = sessionId.split('.')[0] ?? '';
    if (USERS.some((user) => user.id === userId)) {
      const now = Date.now();
      db.sessions.set(sessionId, {
        userId,
        idleExpiresAt: now + IDLE_MS,
        absoluteExpiresAt: now + ABSOLUTE_MS,
      });
    }
  }
  const session = db.sessions.get(sessionId);
  const user = USERS.find((item) => item.id === session?.userId);
  if (!session || !user || !user.is_active) return undefined;
  if (Date.now() > session.idleExpiresAt || Date.now() > session.absoluteExpiresAt) {
    db.sessions.delete(sessionId);
    return undefined;
  }
  return {
    user: publicUser(user),
    session: {
      idle_expires_at: new Date(session.idleExpiresAt).toISOString(),
      absolute_expires_at: new Date(session.absoluteExpiresAt).toISOString(),
    },
  };
}

export function touchSession(sessionId: string): void {
  const session = db.sessions.get(sessionId);
  if (session) session.idleExpiresAt = Math.min(Date.now() + IDLE_MS, session.absoluteExpiresAt);
}

// Lookups

export const findCustomer = (id: string) => db.customers.find((item) => item.id === id);
export const findVehicle = (id: string) => db.vehicles.find((item) => item.id === id);
export const findPayment = (id: string) => db.payments.find((item) => item.id === id);

// Reads pick the rate in effect today; future rates stay in the history only.
export function vehicleView(item: Vehicle): Vehicle {
  const owner = findCustomer(item.customer_id);
  const parking = item.parking;
  if (!parking) return { ...item, customer_name: owner?.display_name ?? item.customer_name };
  const current =
    parking.rate_history.filter((rate) => rate.effective_on <= today()).at(-1) ??
    parking.rate_history[0];
  return {
    ...item,
    customer_name: owner?.display_name ?? item.customer_name,
    parking: { ...parking, monthly_rate: current?.monthly_rate ?? parking.monthly_rate },
  };
}

const activeAllocations = () =>
  db.allocations.filter((allocation) =>
    db.payments.some(
      (payment) => payment.id === allocation.payment_id && payment.status === 'received',
    ),
  );

export function paymentView(payment: StoredPayment): Payment {
  const allocated =
    payment.status === 'received'
      ? db.allocations
          .filter((allocation) => allocation.payment_id === payment.id)
          .reduce((sum, allocation) => sum + allocation.amount, 0)
      : 0;
  return {
    ...payment,
    customer_name: findCustomer(payment.customer_id)?.display_name ?? payment.customer_name,
    allocated_amount: usd(allocated),
    available_credit: usd(payment.status === 'received' ? payment.amount.amount - allocated : 0),
  };
}

export function invoiceRemaining(invoice: InvoiceRow): number {
  const paid = activeAllocations()
    .filter((allocation) => allocation.invoice_id === invoice.id)
    .reduce((sum, allocation) => sum + allocation.amount, 0);
  return Math.max(0, invoice.total.amount - paid);
}

// The stored row also keeps its charge lines; the API returns the invoice without them.
export function invoiceView(invoice: InvoiceRow): Invoice {
  const view: Partial<InvoiceRow> = { ...invoice };
  delete view.lines;
  return view as Invoice;
}

// Billing

export function unbilledCharges(customerId: string, through = today()) {
  const all = monthlyCharges(
    db.vehicles.filter((item) => item.customer_id === customerId).map(vehicleView),
    through,
  );
  const billed = new Set(
    db.invoices
      .filter((invoice) => invoice.customer_id === customerId && invoice.status === 'issued')
      .flatMap((invoice) => invoice.lines.map((line) => line.key)),
  );
  return {
    lines: all.filter((line) => !billed.has(line.key)),
    alreadyBilled: all.filter((line) => billed.has(line.key)).length,
  };
}

export function allocatePayment(
  payment: StoredPayment,
  invoices: InvoiceRow[],
  actorId: string,
): void {
  if (payment.status !== 'received') return;
  const targets = invoices
    .filter((invoice) => invoice.customer_id === payment.customer_id && invoice.status === 'issued')
    .sort(
      (a, b) =>
        a.due_on.localeCompare(b.due_on) ||
        (a.issued_on ?? '').localeCompare(b.issued_on ?? '') ||
        a.id.localeCompare(b.id),
    );
  let available = paymentView(payment).available_credit.amount;
  for (const invoice of targets) {
    if (!available) break;
    const applied = Math.min(available, invoiceRemaining(invoice));
    if (!applied) continue;
    db.allocations.push({ payment_id: payment.id, invoice_id: invoice.id, amount: applied });
    payment.version += 1;
    payment.audit_events.push({
      action: 'allocated',
      actor_id: actorId,
      reason: invoice.invoice_number,
      created_at: new Date().toISOString(),
    });
    available -= applied;
  }
}

// Credit is spent without creating a new payment.
export function applyCredit(customerId: string, invoiceIds: string[], actorId: string): void {
  const targets = db.invoices.filter((invoice) => invoiceIds.includes(invoice.id));
  const payments = db.payments
    .filter((payment) => payment.customer_id === customerId && payment.status === 'received')
    .sort(
      (a, b) =>
        a.effective_on.localeCompare(b.effective_on) ||
        a.created_at.localeCompare(b.created_at) ||
        a.id.localeCompare(b.id),
    );
  for (const payment of payments) allocatePayment(payment, targets, actorId);
}

// One shared calculation for the ledger, the customer list, and the dashboard.
export function ledger(customerId: string): CustomerLedger {
  const now = today();
  const invoices = db.invoices.filter(
    (invoice) => invoice.customer_id === customerId && invoice.status === 'issued',
  );
  const outstanding = invoices.reduce((sum, invoice) => sum + invoiceRemaining(invoice), 0);
  const overdue = invoices
    .filter((invoice) => invoice.due_on < now)
    .reduce((sum, invoice) => sum + invoiceRemaining(invoice), 0);
  const received = db.payments
    .filter((payment) => payment.customer_id === customerId && payment.status === 'received')
    .map(paymentView);
  const credit = received.reduce((sum, payment) => sum + payment.available_credit.amount, 0);
  const monthly = db.vehicles
    .filter(
      (item) =>
        item.customer_id === customerId &&
        item.parking &&
        item.parking.starts_on <= now &&
        (!item.parking.ends_on || item.parking.ends_on > now),
    )
    .reduce((sum, item) => sum + (vehicleView(item).parking?.monthly_rate.amount ?? 0), 0);
  const unbilled = unbilledCharges(customerId).lines.reduce(
    (sum, line) => sum + line.amount.amount,
    0,
  );
  const latest = [...received].sort(
    (a, b) =>
      b.effective_on.localeCompare(a.effective_on) ||
      b.created_at.localeCompare(a.created_at) ||
      b.id.localeCompare(a.id),
  )[0];
  return {
    as_of: new Date().toISOString(),
    outstanding: usd(outstanding),
    overdue: usd(overdue),
    unapplied_credit: usd(credit),
    net_balance: usd(outstanding - credit),
    monthly_parking: usd(monthly),
    unbilled_parking: usd(unbilled),
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

export const countsAsTruck = (item: Vehicle) =>
  item.vehicle_type === 'truck' || item.vehicle_type === 'combination';
