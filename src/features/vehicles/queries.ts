import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { vehicleKeys, vehiclesApi } from './api';
import type { Vehicle, VehicleListParams, VehicleWrite } from './types';

export function useVehicleList(params: VehicleListParams) {
  return useQuery({
    queryKey: vehicleKeys.list(params),
    queryFn: ({ signal }) => vehiclesApi.list(params, signal),
    placeholderData: keepPreviousData,
  });
}

export function useVehicle(id: string | undefined) {
  return useQuery({
    queryKey: vehicleKeys.detail(id ?? ''),
    queryFn: ({ signal }) => vehiclesApi.get(id ?? '', signal),
    enabled: Boolean(id),
  });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: VehicleWrite) => vehiclesApi.create(body),
    onSuccess: (created) => {
      queryClient.setQueryData(vehicleKeys.detail(created.id), created);
      void queryClient.invalidateQueries({ queryKey: vehicleKeys.lists() });
    },
  });
}

export function useUpdateVehicle(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      version,
      body,
    }: {
      version: number;
      body: Partial<Omit<VehicleWrite, 'customer_id'>>;
    }) => vehiclesApi.update(id, version, body),
    onSuccess: (updated: Vehicle) => {
      queryClient.setQueryData(vehicleKeys.detail(id), updated);
      void queryClient.invalidateQueries({ queryKey: vehicleKeys.lists() });
    },
  });
}

export function useSetVehicleActive(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ version, isActive }: { version: number; isActive: boolean }) =>
      vehiclesApi.setActive(id, version, isActive),
    onSuccess: (updated: Vehicle) => {
      queryClient.setQueryData(vehicleKeys.detail(id), updated);
      void queryClient.invalidateQueries({ queryKey: vehicleKeys.lists() });
    },
  });
}
