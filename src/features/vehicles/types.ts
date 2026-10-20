// Vehicle shapes follow REQUIREMENTS.md sections 7.1 and 10. The backend OpenAPI schema is the
// source of truth once it exists; field names here are the proposed wire names.

import type { VehicleParking } from './parkingModel';

export type VehicleType = 'truck' | 'trailer' | 'combination';

export const VEHICLE_TYPES: readonly VehicleType[] = ['truck', 'trailer', 'combination'];

export interface Vehicle {
  id: string;
  version: number;
  customer_id: string;
  // Read-only copy so lists do not need a second request per row.
  customer_name: string;
  vehicle_type: VehicleType;
  // Needed to tell apart vehicles that share one USDOT number.
  unit_number: string | null;
  plate_number: string | null;
  plate_jurisdiction: string | null;
  // Digits only. Identifies the carrier, not a single truck.
  usdot_number: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  parking?: VehicleParking | null;
}

export interface VehicleWrite {
  customer_id: string;
  vehicle_type: VehicleType;
  unit_number: string | null;
  plate_number: string | null;
  plate_jurisdiction: string | null;
  usdot_number: string | null;
}

export interface VehicleListParams {
  q?: string;
  customer_id?: string;
  // Omit to get active vehicles only.
  include_inactive?: boolean;
  page?: number;
  page_size?: number;
}
