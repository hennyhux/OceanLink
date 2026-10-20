import { http } from '@/lib/api/http';
import { toQueryString, type Paged } from '@/lib/api/paging';

import type { Vehicle, VehicleListParams, VehicleWrite } from './types';
import type { CapacityPool, VehicleParkingWrite } from './parkingModel';

const path = (id: string) => `/vehicles/${encodeURIComponent(id)}`;

export const vehiclesApi = {
  list: (params: VehicleListParams, signal?: AbortSignal) =>
    http.get<Paged<Vehicle>>(`/vehicles${toQueryString({ ...params })}`, { signal }),
  get: (id: string, signal?: AbortSignal) => http.get<Vehicle>(path(id), { signal }),
  create: (body: VehicleWrite) => http.post<Vehicle>('/vehicles', body),
  // The owner cannot change in an ordinary edit, so customer_id is never sent here.
  update: (id: string, version: number, body: Partial<Omit<VehicleWrite, 'customer_id'>>) =>
    http.patch<Vehicle>(path(id), body, { ifMatchVersion: version }),
  setActive: (id: string, version: number, isActive: boolean) =>
    http.patch<Vehicle>(path(id), { is_active: isActive }, { ifMatchVersion: version }),
  pools: () => http.get<CapacityPool[]>('/lots/current/capacity-pools'),
  saveParking: (id: string, version: number, body: VehicleParkingWrite) =>
    http.post<Vehicle>(`${path(id)}/parking`, body, { ifMatchVersion: version }),
};

export const vehicleKeys = {
  all: ['vehicles'] as const,
  lists: () => ['vehicles', 'list'] as const,
  list: (params: VehicleListParams) => ['vehicles', 'list', params] as const,
  detail: (id: string) => ['vehicles', 'detail', id] as const,
};
