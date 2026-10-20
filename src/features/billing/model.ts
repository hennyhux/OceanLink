import type { Money } from '@/lib/money';

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
