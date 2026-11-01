import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { http } from '@/lib/api/http';
import { toQueryString, type Paged } from '@/lib/api/paging';
import { keys, refreshAfter } from '@/lib/queryKeys';

import type { Customer, CustomerListItem, CustomerListParams, CustomerWrite } from './types';

const path = (id: string) => `/customers/${encodeURIComponent(id)}`;

export const customersApi = {
  list: (params: CustomerListParams, signal?: AbortSignal) =>
    http.get<Paged<CustomerListItem>>(`/customers${toQueryString({ ...params })}`, { signal }),
  get: (id: string, signal?: AbortSignal) => http.get<Customer>(path(id), { signal }),
  create: (body: CustomerWrite) => http.post<Customer>('/customers', body),
  update: (id: string, version: number, body: Partial<CustomerWrite>) =>
    http.patch<Customer>(path(id), body, { ifMatchVersion: version }),
  setActive: (id: string, version: number, isActive: boolean) =>
    http.patch<Customer>(path(id), { is_active: isActive }, { ifMatchVersion: version }),
};

export const customerKeys = {
  list: (params: CustomerListParams) => [...keys.customers, 'list', params] as const,
  detail: (id: string) => [...keys.customers, 'detail', id] as const,
};

export function useCustomerList(params: CustomerListParams) {
  return useQuery({
    queryKey: customerKeys.list(params),
    queryFn: ({ signal }) => customersApi.list(params, signal),
    placeholderData: keepPreviousData,
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: customerKeys.detail(id ?? ''),
    queryFn: ({ signal }) => customersApi.get(id ?? '', signal),
    enabled: Boolean(id),
  });
}

export function useSaveCustomer(existing?: Customer) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<CustomerWrite>) =>
      existing
        ? customersApi.update(existing.id, existing.version, body)
        : customersApi.create(body as CustomerWrite),
    onSuccess: async (saved) => {
      client.setQueryData(customerKeys.detail(saved.id), saved);
      await refreshAfter(client, 'customerSaved');
    },
  });
}

export function useSetCustomerActive(customer: Customer) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (isActive: boolean) =>
      customersApi.setActive(customer.id, customer.version, isActive),
    onSuccess: async (saved) => {
      client.setQueryData(customerKeys.detail(saved.id), saved);
      await refreshAfter(client, 'customerStatus');
    },
  });
}
