import type { Money } from '@/lib/money';

export const VEHICLE_TYPES = ['truck', 'trailer', 'combination', 'compact'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export interface RateChange {
  effective_on: string;
  monthly_rate: Money;
  reason: string;
}

export interface VehicleParking {
  starts_on: string;
  // Exclusive: service through Oct 31 ends on Nov 1.
  ends_on: string | null;
  // The rate in effect today, or the first rate if service has not started.
  monthly_rate: Money;
  rate_history: RateChange[];
}

export interface Vehicle {
  id: string;
  version: number;
  customer_id: string;
  customer_name: string;
  vehicle_type: VehicleType;
  unit_number: string | null;
  plate_number: string | null;
  plate_jurisdiction: string | null;
  usdot_number: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  parking: VehicleParking | null;
}

export interface VehicleWrite {
  customer_id: string;
  vehicle_type: VehicleType;
  unit_number: string | null;
  plate_number: string | null;
  plate_jurisdiction: string | null;
  usdot_number: string | null;
}

export type VehicleUpdate = Partial<Omit<VehicleWrite, 'customer_id'>>;

export interface ParkingWrite {
  starts_on: string;
  ends_on: string | null;
  monthly_rate: Money;
  effective_on: string;
  reason: string;
}

export interface VehicleCreate extends VehicleWrite {
  parking?: ParkingWrite;
}

export interface VehicleListParams {
  q?: string;
  customer_id?: string;
  include_inactive?: boolean;
  page?: number;
  page_size?: number;
}
