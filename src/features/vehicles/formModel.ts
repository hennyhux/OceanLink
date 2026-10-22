import { z } from 'zod';

import { VEHICLE_TYPES, type Vehicle, type VehicleType, type VehicleWrite } from './types';

// "method" only controls which fields are shown first. It is never sent to the server.
export type IdentifyMethod = 'usdot' | 'plate';

const text = (max: number) =>
  z.string().trim().max(max, 'vehicles.errors.tooLong').optional().or(z.literal(''));

export const vehicleFormSchema = z
  .object({
    customer_id: z.string().min(1, 'vehicles.errors.customerRequired'),
    vehicle_type: z.enum(VEHICLE_TYPES),
    method: z.enum(['usdot', 'plate']),
    usdot_number: text(20),
    unit_number: text(50),
    plate_number: text(20),
    plate_jurisdiction: text(20),
  })
  .superRefine((v, ctx) => {
    const issue = (path: keyof typeof v, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

    const usdot = v.usdot_number?.trim() ?? '';
    const unit = v.unit_number?.trim() ?? '';
    const plate = v.plate_number?.trim() ?? '';
    const state = v.plate_jurisdiction?.trim() ?? '';

    if (usdot && !/^\d{1,8}$/.test(usdot)) issue('usdot_number', 'vehicles.errors.usdotDigits');

    // A plate and its state always go together, whichever way the vehicle is identified.
    if (plate && !state) issue('plate_jurisdiction', 'vehicles.errors.jurisdictionRequired');
    if (state && !plate) issue('plate_number', 'vehicles.errors.plateRequired');

    if (v.method === 'usdot') {
      if (!usdot) issue('usdot_number', 'vehicles.errors.usdotRequired');
      // Many trucks can share one USDOT number, so the unit number tells them apart. It is only
      // needed when there is no plate to tell them apart by. A plate is never required here.
      const hasPlate = Boolean(plate && state);
      if (!unit && !hasPlate) issue('unit_number', 'vehicles.errors.unitRequired');
    } else {
      if (!plate) issue('plate_number', 'vehicles.errors.plateRequired');
      if (!state) issue('plate_jurisdiction', 'vehicles.errors.jurisdictionRequired');
    }
  });

export type VehicleFormValues = z.infer<typeof vehicleFormSchema>;

export function emptyVehicleForm(
  customerId = '',
  customerUsdot: string | null = null,
): VehicleFormValues {
  return {
    customer_id: customerId,
    vehicle_type: 'truck',
    // USDOT is the usual way trucks are identified, so it is the default.
    method: 'usdot',
    usdot_number: customerUsdot ?? '',
    unit_number: '',
    plate_number: '',
    plate_jurisdiction: '',
  };
}

export function vehicleToForm(vehicle: Vehicle): VehicleFormValues {
  return {
    customer_id: vehicle.customer_id,
    vehicle_type: vehicle.vehicle_type,
    // Plate-only and plate-plus-USDOT vehicles start on the plate view.
    method: vehicle.plate_number ? 'plate' : 'usdot',
    usdot_number: vehicle.usdot_number ?? '',
    unit_number: vehicle.unit_number ?? '',
    plate_number: vehicle.plate_number ?? '',
    plate_jurisdiction: vehicle.plate_jurisdiction ?? '',
  };
}

const blankToNull = (value: string | undefined): string | null => {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
};

export function formToWrite(values: VehicleFormValues): VehicleWrite {
  return {
    customer_id: values.customer_id,
    vehicle_type: values.vehicle_type as VehicleType,
    unit_number: blankToNull(values.unit_number),
    plate_number: blankToNull(values.plate_number),
    // States and provinces are written in capitals.
    plate_jurisdiction: blankToNull(values.plate_jurisdiction)?.toUpperCase() ?? null,
    usdot_number: blankToNull(values.usdot_number),
  };
}

// Only send what changed so the backend history stays meaningful.
export function diffWrite(
  before: VehicleWrite,
  after: VehicleWrite,
): Partial<Omit<VehicleWrite, 'customer_id'>> {
  const changes: Record<string, unknown> = {};
  for (const key of Object.keys(after) as (keyof VehicleWrite)[]) {
    if (key === 'customer_id') continue;
    if (before[key] !== after[key]) changes[key] = after[key];
  }
  return changes as Partial<Omit<VehicleWrite, 'customer_id'>>;
}
