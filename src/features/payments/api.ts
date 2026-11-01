import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { http } from '@/lib/api/http';
import { toQueryString, type Paged } from '@/lib/api/paging';
import { config } from '@/lib/config';
import { keys } from '@/lib/queryKeys';

import type { Payment, PaymentFilters, PaymentWrite } from './types';

const path = (id: string) => `/payments/${encodeURIComponent(id)}`;

export const paymentsApi = {
  list: (filters: PaymentFilters, signal?: AbortSignal) =>
    http.get<Paged<Payment>>(`/payments${toQueryString({ ...filters })}`, { signal }),
  get: (id: string, signal?: AbortSignal) => http.get<Payment>(path(id), { signal }),
  record: (body: PaymentWrite, key: string) =>
    http.post<Payment>('/payments', body, {
      idempotencyKey: key,
      timeoutMs: config.financialTimeoutMs,
    }),
  reverse: (payment: Payment, reason: string, key: string) =>
    http.post<Payment>(
      `${path(payment.id)}/reverse`,
      { reason },
      {
        idempotencyKey: key,
        ifMatchVersion: payment.version,
        timeoutMs: config.financialTimeoutMs,
      },
    ),
};

export const paymentKeys = {
  list: (filters: PaymentFilters) => [...keys.payments, 'list', filters] as const,
  detail: (id: string) => [...keys.payments, 'detail', id] as const,
};

export function usePayments(filters: PaymentFilters, enabled = true) {
  return useQuery({
    queryKey: paymentKeys.list(filters),
    queryFn: ({ signal }) => paymentsApi.list(filters, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function usePayment(id: string | undefined) {
  return useQuery({
    queryKey: paymentKeys.detail(id ?? ''),
    queryFn: ({ signal }) => paymentsApi.get(id ?? '', signal),
    enabled: Boolean(id),
  });
}
