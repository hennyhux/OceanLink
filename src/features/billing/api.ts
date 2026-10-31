import { useQuery } from '@tanstack/react-query';
import { http } from '@/lib/api/http';
import { toQueryString, type Paged } from '@/lib/api/paging';
import type { Money } from '@/lib/money';
import type { BillingRun } from './model';
import type { ManualDebitInvoice, ManualDebitWrite } from './manualDebitModel';

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
export interface ManualDebitFilters {
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
}
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
  createManualDebit: (body: ManualDebitWrite, key: string) =>
    http.post<ManualDebitInvoice>('/invoices', body, { idempotencyKey: key }),
  issueManualDebit: (id: string, key: string) =>
    http.post<ManualDebitInvoice>(`/invoices/${encodeURIComponent(id)}/issue`, undefined, {
      idempotencyKey: key,
    }),
  manualDebits: (customerId: string, filters: ManualDebitFilters, signal?: AbortSignal) =>
    http.get<Paged<ManualDebitInvoice>>(
      `/invoices${toQueryString({
        customer_id: customerId,
        source_type: 'manual',
        page: 1,
        page_size: 20,
        ...filters,
      })}`,
      { signal },
    ),
};
export function useCustomerLedger(id: string) {
  return useQuery({
    queryKey: billingKeys.ledger(id),
    queryFn: () => http.get<CustomerLedger>(`/customers/${encodeURIComponent(id)}/ledger`),
  });
}
