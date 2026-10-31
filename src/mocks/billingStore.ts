import type { BillingRun, MonthlyCharge } from '@/features/billing/model';
import type { ManualDebitInvoice, ManualDebitWrite } from '@/features/billing/manualDebitModel';
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
const manualDebitDraftRequests = new Map<string, { fingerprint: string; invoice_id: string }>();
const manualDebitIssueRequests = new Map<string, string>();
let invoices: ParkingInvoice[] = [];
let manualDebitInvoices: ManualDebitInvoice[] = [];
const money = (amount: number) => ({ amount, currency: 'USD' as const });

export function resetMockBilling() {
  runs.clear();
  requests.clear();
  manualDebitDraftRequests.clear();
  manualDebitIssueRequests.clear();
  invoices = [];
  manualDebitInvoices = [];
}
export function parkingInvoices(customerId: string) {
  return invoices.filter((invoice) => invoice.customer_id === customerId);
}
export function issuedManualDebits(customerId: string) {
  return manualDebitInvoices.filter(
    (invoice) => invoice.customer_id === customerId && invoice.status === 'issued',
  );
}
export function createManualDebitDraft(
  body: ManualDebitWrite,
  requestKey: string,
): ManualDebitInvoice {
  const fingerprint = JSON.stringify(body);
  const previous = manualDebitDraftRequests.get(requestKey);
  if (previous) {
    if (previous.fingerprint !== fingerprint) throw new Error('IDEMPOTENCY_CONFLICT');
    return manualDebitInvoices.find((invoice) => invoice.id === previous.invoice_id)!;
  }
  const invoice: ManualDebitInvoice = {
    customer_id: body.customer_id,
    due_on: body.due_on,
    description: body.description,
    id: crypto.randomUUID(),
    version: 1,
    invoice_number: null,
    issued_on: null,
    status: 'draft',
    total: body.amount,
  };
  manualDebitInvoices = [invoice, ...manualDebitInvoices];
  manualDebitDraftRequests.set(requestKey, { fingerprint, invoice_id: invoice.id });
  return invoice;
}
export function issueManualDebit(id: string, requestKey: string): ManualDebitInvoice {
  const previousInvoiceId = manualDebitIssueRequests.get(requestKey);
  if (previousInvoiceId) {
    if (previousInvoiceId !== id) throw new Error('IDEMPOTENCY_CONFLICT');
    return manualDebitInvoices.find((invoice) => invoice.id === id)!;
  }
  const draft = manualDebitInvoices.find((invoice) => invoice.id === id);
  if (!draft) throw new Error('NOT_FOUND');
  if (draft.status !== 'draft') throw new Error('INVOICE_NOT_EDITABLE');
  const issued: ManualDebitInvoice = {
    ...draft,
    version: draft.version + 1,
    invoice_number: `OL-MAN-${String(manualDebitInvoices.filter((item) => item.status === 'issued').length + 1).padStart(6, '0')}`,
    issued_on: todayInTimeZone('UTC'),
    status: 'issued',
  };
  manualDebitInvoices = manualDebitInvoices.map((invoice) =>
    invoice.id === id ? issued : invoice,
  );
  manualDebitIssueRequests.set(requestKey, id);
  return issued;
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
