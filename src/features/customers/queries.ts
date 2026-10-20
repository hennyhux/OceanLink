import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { vehicleKeys } from '@/features/vehicles/api';

import { customerKeys, customersApi } from './api';
import type { Customer, CustomerListParams, CustomerWrite } from './types';

export function useCustomerList(params: CustomerListParams) {
  return useQuery({
    queryKey: customerKeys.list(params),
    queryFn: ({ signal }) => customersApi.list(params, signal),
    // Keep the old page on screen while the next one loads so the table does not flash.
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

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CustomerWrite) => customersApi.create(body),
    onSuccess: (created) => {
      queryClient.setQueryData(customerKeys.detail(created.id), created);
      void queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });
}

export function useUpdateCustomer(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ version, body }: { version: number; body: Partial<CustomerWrite> }) =>
      customersApi.update(id, version, body),
    onSuccess: (updated: Customer) => {
      queryClient.setQueryData(customerKeys.detail(id), updated);
      void queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      // Vehicle lists show the customer's name, so a rename must refresh them too.
      void queryClient.invalidateQueries({ queryKey: vehicleKeys.lists() });
    },
  });
}

export function useSetCustomerActive(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ version, isActive }: { version: number; isActive: boolean }) =>
      customersApi.setActive(id, version, isActive),
    onSuccess: (updated: Customer) => {
      queryClient.setQueryData(customerKeys.detail(id), updated);
      void queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });
}
