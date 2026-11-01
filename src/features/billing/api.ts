import { useQuery } from '@tanstack/react-query';

import { http } from '@/lib/api/http';
import { toQueryString, type Paged } from '@/lib/api/paging';
import { config } from '@/lib/config';
import { keys } from '@/lib/queryKeys';

import type {
  BillingRun,
  CustomerLedger,
  Invoice,
  InvoiceListParams,
  ManualChargeWrite,
} from './types';

// Money writes reuse one key per intended operation and time out into an unknown result.
const financial = (key: string) => ({ idempotencyKey: key, timeoutMs: config.financialTimeoutMs });

export const billingApi = {
  ledger: (customerId: string, signal?: AbortSignal) =>
    http.get<CustomerLedger>(`/customers/${encodeURIComponent(customerId)}/ledger`, { signal }),
  preview: (customerId: string, throughDate: string) =>
    http.post<BillingRun>('/billing-runs/preview', {
      customer_id: customerId,
      through_date: throughDate,
    }),
  issue: (runId: string, applyCredit: boolean, key: string) =>
    http.post<BillingRun>(
      `/billing-runs/${encodeURIComponent(runId)}/issue`,
      { apply_credit: applyCredit },
      financial(key),
    ),
  invoices: (params: InvoiceListParams, signal?: AbortSignal) =>
    http.get<Paged<Invoice>>(`/invoices${toQueryString({ ...params })}`, { signal }),
  createCharge: (body: ManualChargeWrite, key: string) =>
    http.post<Invoice>('/invoices', body, financial(key)),
  issueCharge: (id: string, key: string) =>
    http.post<Invoice>(`/invoices/${encodeURIComponent(id)}/issue`, undefined, financial(key)),
};

export const billingKeys = {
  ledger: (customerId: string) => [...keys.ledger, customerId] as const,
  invoices: (params: InvoiceListParams) => [...keys.invoices, params] as const,
};

export function useLedger(customerId: string) {
  return useQuery({
    queryKey: billingKeys.ledger(customerId),
    queryFn: ({ signal }) => billingApi.ledger(customerId, signal),
  });
}

export function useInvoices(params: InvoiceListParams) {
  return useQuery({
    queryKey: billingKeys.invoices(params),
    queryFn: ({ signal }) => billingApi.invoices(params, signal),
  });
}
