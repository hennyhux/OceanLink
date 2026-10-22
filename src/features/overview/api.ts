import { useQuery } from '@tanstack/react-query';
import { http } from '@/lib/api/http';
import type { Money } from '@/lib/money';

export interface OverviewMetrics {
  overdue_invoices: Money;
  outstanding_invoices: Money;
  unbilled_parking: Money;
  payments_received_this_month: Money;
  total_customers: number;
  total_trucks: number;
}

export const overviewApi = {
  summary: () => http.get<OverviewMetrics>('/reports/summary'),
};

export function useOverviewMetrics() {
  return useQuery({
    queryKey: ['overview', 'metrics'],
    queryFn: overviewApi.summary,
  });
}