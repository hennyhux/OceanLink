import type { TFunction } from 'i18next';

import type { Vehicle } from './types';

type Identity = Pick<
  Vehicle,
  'unit_number' | 'plate_number' | 'plate_jurisdiction' | 'usdot_number'
>;

// The name staff use for a vehicle: unit number, else plate, else USDOT number.
export function vehicleTitle(vehicle: Identity, t: TFunction): string {
  if (vehicle.unit_number) return t('vehicles.unitLabel', { unit: vehicle.unit_number });
  if (vehicle.plate_number) return vehicle.plate_number;
  if (vehicle.usdot_number) return t('vehicles.usdotLabel', { usdot: vehicle.usdot_number });
  return t('vehicles.unnamed');
}

// Plate and USDOT, for example "USDOT 2345678 · 8XYZ123 (CA)".
export function vehicleIdentifiers(vehicle: Identity, t: TFunction): string {
  return [
    vehicle.usdot_number ? t('vehicles.usdotLabel', { usdot: vehicle.usdot_number }) : null,
    vehicle.plate_number
      ? t('vehicles.plateLabel', {
          plate: vehicle.plate_number,
          state: vehicle.plate_jurisdiction ?? '',
        })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
