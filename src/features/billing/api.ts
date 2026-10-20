import { useQuery } from '@tanstack/react-query';
import { http } from '@/lib/api/http';
import type { Money } from '@/lib/money';
import type { BillingRun } from './model';

export interface CustomerLedger {
  as_of: string;
  outstanding: Money;
  overdue: Money;
  unapplied_credit: Money;
  net_balance: Money;
  monthly_parking?: Money;
  unbilled_parking?: Money;
  last_payment: { id: string; amount: Money; effective_on: string; method: string } | null;
}

export const billingKeys = { ledger: (id: string) => ['ledger', id] as const };
export const billingApi = {
  preview: (customerId: string, throughDate: string) =>
    http.post<BillingRun>('/billing-runs/preview', {
      customer_id: customerId,
      through_date: throughDate,
    }),
  issue: async (id: string, applyCredit: boolean, key: string) => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 15000);
    try {
      return await http.post<BillingRun>(
        `/billing-runs/${encodeURIComponent(id)}/issue`,
        { apply_credit: applyCredit },
        { idempotencyKey: key, signal: controller.signal },
      );
    } finally {
      window.clearTimeout(timer);
    }
  },
};
export function useCustomerLedger(id: string) {
  return useQuery({
    queryKey: billingKeys.ledger(id),
    queryFn: () => http.get<CustomerLedger>(`/customers/${encodeURIComponent(id)}/ledger`),
  });
}
