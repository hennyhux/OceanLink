import type { Money } from '@/lib/money';

export interface CustomerLedger {
  as_of: string;
  outstanding: Money;
  overdue: Money;
  unapplied_credit: Money;
  net_balance: Money;
  monthly_parking: Money;
  unbilled_parking: Money;
  last_payment: { id: string; amount: Money; effective_on: string; method: string } | null;
}

export interface MonthlyCharge {
  key: string;
  vehicle_id: string;
  vehicle_label: string;
  starts_on: string;
  ends_on: string;
  service_days: number;
  period_days: number;
  amount: Money;
}

export interface BillingRun {
  id: string;
  customer_id: string;
  through_date: string;
  lines: MonthlyCharge[];
  total: Money;
  credit_available: Money;
  amount_due_after_credit: Money;
  already_billed_count: number;
  status: 'preview' | 'issued';
  invoice_numbers: string[];
}

export type InvoiceSource = 'manual' | 'monthly_parking' | 'opening_balance';

export interface Invoice {
  id: string;
  version: number;
  customer_id: string;
  invoice_number: string | null;
  status: 'draft' | 'issued' | 'void';
  source_type: InvoiceSource;
  description: string | null;
  issued_on: string | null;
  due_on: string;
  total: Money;
}

export interface ManualChargeWrite {
  customer_id: string;
  due_on: string;
  description: string;
  amount: Money;
}

export interface InvoiceListParams {
  customer_id: string;
  source_type?: InvoiceSource;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
}
