import type { Money } from '@/lib/money';

export interface OverviewMetrics {
  outstanding_invoices: Money;
  overdue_invoices: Money;
  unbilled_parking: Money;
  payments_received_this_month: Money;
  total_customers: number;
  total_trucks: number;
}
