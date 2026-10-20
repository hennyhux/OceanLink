import { http } from '@/lib/api/http';
import { toQueryString, type Paged } from '@/lib/api/paging';

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
  all: ['customers'] as const,
  lists: () => ['customers', 'list'] as const,
  list: (params: CustomerListParams) => ['customers', 'list', params] as const,
  detail: (id: string) => ['customers', 'detail', id] as const,
};
