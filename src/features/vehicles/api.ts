import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { http } from '@/lib/api/http';
import { toQueryString, type Paged } from '@/lib/api/paging';
import { keys, refreshAfter } from '@/lib/queryKeys';

import type {
  ParkingWrite,
  Vehicle,
  VehicleCreate,
  VehicleListParams,
  VehicleUpdate,
} from './types';

const path = (id: string) => `/vehicles/${encodeURIComponent(id)}`;

export const vehiclesApi = {
  list: (params: VehicleListParams, signal?: AbortSignal) =>
    http.get<Paged<Vehicle>>(`/vehicles${toQueryString({ ...params })}`, { signal }),
  get: (id: string, signal?: AbortSignal) => http.get<Vehicle>(path(id), { signal }),
  create: (body: VehicleCreate) => http.post<Vehicle>('/vehicles', body),
  update: (id: string, version: number, body: VehicleUpdate & { is_active?: boolean }) =>
    http.patch<Vehicle>(path(id), body, { ifMatchVersion: version }),
  saveParking: (id: string, version: number, body: ParkingWrite) =>
    http.post<Vehicle>(`${path(id)}/parking`, body, { ifMatchVersion: version }),
};

export const vehicleKeys = {
  list: (params: VehicleListParams) => [...keys.vehicles, 'list', params] as const,
  detail: (id: string) => [...keys.vehicles, 'detail', id] as const,
};

export function useVehicleList(params: VehicleListParams, enabled = true) {
  return useQuery({
    queryKey: vehicleKeys.list(params),
    queryFn: ({ signal }) => vehiclesApi.list(params, signal),
    placeholderData: keepPreviousData,
    enabled,
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
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: VehicleCreate) => vehiclesApi.create(body),
    onSuccess: async (created) => {
      client.setQueryData(vehicleKeys.detail(created.id), created);
      await refreshAfter(client, 'vehicleCreated');
    },
  });
}

export function useUpdateVehicle(vehicle: Vehicle | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: VehicleUpdate & { is_active?: boolean }) => {
      if (!vehicle) throw new Error('Vehicle not loaded');
      return vehiclesApi.update(vehicle.id, vehicle.version, body);
    },
    onSuccess: async (saved) => {
      client.setQueryData(vehicleKeys.detail(saved.id), saved);
      await refreshAfter(client, 'vehicleSaved');
    },
  });
}

export function useSaveParking(vehicle: Vehicle) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: ParkingWrite) => vehiclesApi.saveParking(vehicle.id, vehicle.version, body),
    onSuccess: async (saved) => {
      client.setQueryData(vehicleKeys.detail(saved.id), saved);
      await refreshAfter(client, 'parkingSaved');
    },
  });
}
