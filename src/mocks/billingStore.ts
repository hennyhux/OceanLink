import type { BillingRun, MonthlyCharge } from '@/features/billing/model';
import { todayInTimeZone } from '@/lib/dates';
import { findMockCustomer } from './customerHandlers';
import { mockVehicles } from './vehicleHandlers';
import { monthlyCharges } from './monthlyCharges';

export interface ParkingInvoice {
  id: string;
  number: string;
  customer_id: string;
  customer_name: string;
  issued_on: string;
  due_on: string;
  amount: number;
  lines: MonthlyCharge[];
  allocations: { payment_id: string; amount: number }[];
}

interface SavedRun {
  run: BillingRun;
  vehicle_versions: Record<string, number>;
  customer_version: number;
  outstanding: number;
}
const runs = new Map<string, SavedRun>();
const requests = new Map<string, { run_id: string; apply_credit: boolean }>();
let invoices: ParkingInvoice[] = [];
const money = (amount: number) => ({ amount, currency: 'USD' as const });

export function resetMockBilling() {
  runs.clear();
  requests.clear();
  invoices = [];
}
export function parkingInvoices(customerId: string) {
  return invoices.filter((invoice) => invoice.customer_id === customerId);
}
export function unbilledParking(customerId: string, through = todayInTimeZone('UTC')) {
  const all = monthlyCharges(
    mockVehicles().filter((vehicle) => vehicle.customer_id === customerId),
    through,
  );
  const issued = new Set(
    parkingInvoices(customerId).flatMap((invoice) => invoice.lines.map((line) => line.key)),
  );
  return {
    lines: all.filter((line) => !issued.has(line.key)),
    already_billed_count: all.filter((line) => issued.has(line.key)).length,
  };
}

export function previewBilling(
  customerId: string,
  through: string,
  credit: number,
  outstanding: number,
): BillingRun {
  const { lines, already_billed_count } = unbilledParking(customerId, through);
  const total = lines.reduce((sum, line) => sum + line.amount.amount, 0);
  const run: BillingRun = {
    id: crypto.randomUUID(),
    customer_id: customerId,
    through_date: through,
    lines,
    total: money(total),
    credit_available: money(credit),
    amount_due_after_credit: money(Math.max(0, outstanding + total - credit)),
    already_billed_count,
    status: 'preview',
    invoice_numbers: [],
  };
  runs.set(run.id, {
    run,
    outstanding,
    customer_version: findMockCustomer(customerId)!.version,
    vehicle_versions: Object.fromEntries(
      mockVehicles()
        .filter((vehicle) => lines.some((line) => line.vehicle_id === vehicle.id))
        .map((vehicle) => [vehicle.id, vehicle.version]),
    ),
  });
  return run;
}

export function billingRun(id: string): BillingRun | undefined {
  return runs.get(id)?.run;
}
export function billingReplay(
  key: string,
  runId: string,
  applyCredit: boolean,
): BillingRun | undefined {
  const previous = requests.get(key);
  if (!previous) return undefined;
  if (previous.run_id !== runId || previous.apply_credit !== applyCredit)
    throw new Error('IDEMPOTENCY_CONFLICT');
  return billingRun(runId);
}

export function issueBilling(
  id: string,
  requestKey: string,
  applyCredit: boolean,
  credit: number,
  outstanding: number,
): { run: BillingRun; invoices: ParkingInvoice[] } {
  const saved = runs.get(id);
  if (!saved) throw new Error('NOT_FOUND');
  const { run } = saved;
  if (run.status === 'issued') throw new Error('ALREADY_ISSUED');
  if (
    findMockCustomer(run.customer_id)?.version !== saved.customer_version ||
    Object.entries(saved.vehicle_versions).some(
      ([vehicleId, version]) =>
        mockVehicles().find((vehicle) => vehicle.id === vehicleId)?.version !== version,
    )
  )
    throw new Error('BILLING_PREVIEW_STALE');
  if (credit !== run.credit_available.amount || outstanding !== saved.outstanding)
    throw new Error('BILLING_PREVIEW_STALE');
  const unbilled = new Set(
    unbilledParking(run.customer_id, run.through_date).lines.map((line) => line.key),
  );
  if (!run.lines.length || run.lines.some((line) => !unbilled.has(line.key)))
    throw new Error('PERIOD_ALREADY_BILLED');
  const today = todayInTimeZone('UTC');
  const groups = new Map<string, MonthlyCharge[]>();
  for (const line of run.lines) {
    const due = line.starts_on > today ? line.starts_on : today;
    groups.set(due, [...(groups.get(due) ?? []), line]);
  }
  const created: ParkingInvoice[] = [...groups].map(([due, lines], index) => ({
    id: crypto.randomUUID(),
    number: `OL-${String(invoices.length + index + 1).padStart(6, '0')}`,
    customer_id: run.customer_id,
    customer_name: findMockCustomer(run.customer_id)!.display_name,
    issued_on: today,
    due_on: due,
    amount: lines.reduce((sum, line) => sum + line.amount.amount, 0),
    lines: structuredClone(lines),
    allocations: [],
  }));
  invoices = [...invoices, ...created];
  run.status = 'issued';
  run.invoice_numbers = created.map((invoice) => invoice.number);
  requests.set(requestKey, { run_id: id, apply_credit: applyCredit });
  return { run, invoices: created };
}
