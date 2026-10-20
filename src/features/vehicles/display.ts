import type { Vehicle } from './types';

// A short, unambiguous name for a vehicle. The unit number wins because trucks that share a
// USDOT number can only be told apart by it.
export function vehicleTitle(vehicle: Vehicle, unitLabel: (unit: string) => string): string {
  if (vehicle.unit_number) return unitLabel(vehicle.unit_number);
  if (vehicle.plate_number) return vehicle.plate_number;
  return vehicle.usdot_number ?? '';
}
