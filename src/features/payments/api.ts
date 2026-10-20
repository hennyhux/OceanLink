import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/lib/api/http';
import { toQueryString, type Paged } from '@/lib/api/paging';
import type { Payment, PaymentFilters, PaymentWrite } from './model';

async function timedWrite<T>(
  path: string,
  body: unknown,
  key: string,
  version?: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15000);
  try {
    return await http.post<T>(path, body, {
      idempotencyKey: key,
      ifMatchVersion: version,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timer);
  }
}

export const paymentKeys = {
  all: ['payments'] as const,
  list: (filters: PaymentFilters) => ['payments', 'list', filters] as const,
  detail: (id: string) => ['payments', 'detail', id] as const,
};
export const paymentsApi = {
  list: (filters: PaymentFilters, signal?: AbortSignal) =>
    http.get<Paged<Payment>>(`/payments${toQueryString({ ...filters })}`, { signal }),
  get: (id: string, signal?: AbortSignal) =>
    http.get<Payment>(`/payments/${encodeURIComponent(id)}`, { signal }),
  record: (body: PaymentWrite, key: string) => timedWrite<Payment>('/payments', body, key),
  reverse: (payment: Payment, reason: string, key: string) =>
    timedWrite<Payment>(
      `/payments/${encodeURIComponent(payment.id)}/reverse`,
      { reason },
      key,
      payment.version,
    ),
  lot: () => http.get<{ id: string; time_zone: string; currency: 'USD' }>('/lots/current'),
};

export function usePayments(filters: PaymentFilters) {
  return useQuery({
    queryKey: paymentKeys.list(filters),
    queryFn: ({ signal }) => paymentsApi.list(filters, signal),
  });
}
export function usePaymentMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (operation: () => Promise<Payment>) => operation(),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: paymentKeys.all }),
        client.invalidateQueries({ queryKey: ['ledger'] }),
      ]);
    },
  });
}
