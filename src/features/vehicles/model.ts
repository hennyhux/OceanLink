import { z } from 'zod';

import { isBusinessDate } from '@/lib/dates';
import { blankToNull } from '@/lib/forms';
import { USD_INPUT, usdToCents } from '@/lib/money';

import {
  VEHICLE_TYPES,
  type Vehicle,
  type VehicleCreate,
  type VehicleUpdate,
  type VehicleWrite,
} from './types';

// "method" only decides which fields are shown first. It is never sent.
export type IdentifyMethod = 'usdot' | 'plate';

const text = (max: number) => z.string().trim().max(max, 'form.tooLong');

export const vehicleFormSchema = z
  .object({
    customer_id: z.string().min(1, 'vehicles.errors.customerRequired'),
    vehicle_type: z.enum(VEHICLE_TYPES),
    method: z.enum(['usdot', 'plate']),
    usdot_number: text(20),
    unit_number: text(50),
    plate_number: text(20),
    plate_jurisdiction: text(20),
    monthly_rate: z.string().trim(),
    parking_starts_on: z.string(),
  })
  .superRefine((v, ctx) => {
    const issue = (path: keyof typeof v, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    const usdot = v.usdot_number;
    const plate = v.plate_number;
    const state = v.plate_jurisdiction;

    if (usdot && !/^\d{1,8}$/.test(usdot)) issue('usdot_number', 'vehicles.errors.usdotDigits');
    // A plate and its state always go together.
    if (plate && !state) issue('plate_jurisdiction', 'vehicles.errors.stateRequired');
    if (state && !plate) issue('plate_number', 'vehicles.errors.plateRequired');

    if (v.method === 'usdot') {
      if (!usdot) issue('usdot_number', 'vehicles.errors.usdotRequired');
      // Trucks can share a USDOT number, so the unit number tells them apart unless a plate does.
      if (!v.unit_number && !(plate && state)) issue('unit_number', 'vehicles.errors.unitRequired');
    } else {
      if (!plate) issue('plate_number', 'vehicles.errors.plateRequired');
      if (!state) issue('plate_jurisdiction', 'vehicles.errors.stateRequired');
    }

    if (v.monthly_rate) {
      if (!USD_INPUT.test(v.monthly_rate)) issue('monthly_rate', 'money.invalid');
      if (!isBusinessDate(v.parking_starts_on))
        issue('parking_starts_on', 'parking.errors.startRequired');
    }
  });

export type VehicleFormValues = z.infer<typeof vehicleFormSchema>;

export const VEHICLE_FIELDS = [
  'customer_id',
  'vehicle_type',
  'usdot_number',
  'unit_number',
  'plate_number',
  'plate_jurisdiction',
  'monthly_rate',
  'parking_starts_on',
] as const;

export function emptyVehicleForm(
  customerId = '',
  customerUsdot: string | null = null,
): VehicleFormValues {
  return {
    customer_id: customerId,
    vehicle_type: 'truck',
    method: 'usdot',
    usdot_number: customerUsdot ?? '',
    unit_number: '',
    plate_number: '',
    plate_jurisdiction: '',
    monthly_rate: '',
    parking_starts_on: '',
  };
}

export function vehicleToForm(vehicle: Vehicle): VehicleFormValues {
  return {
    customer_id: vehicle.customer_id,
    vehicle_type: vehicle.vehicle_type,
    method: vehicle.plate_number ? 'plate' : 'usdot',
    usdot_number: vehicle.usdot_number ?? '',
    unit_number: vehicle.unit_number ?? '',
    plate_number: vehicle.plate_number ?? '',
    plate_jurisdiction: vehicle.plate_jurisdiction ?? '',
    monthly_rate: '',
    parking_starts_on: '',
  };
}

export function formToWrite(values: VehicleFormValues): VehicleWrite {
  return {
    customer_id: values.customer_id,
    vehicle_type: values.vehicle_type,
    unit_number: blankToNull(values.unit_number),
    plate_number: blankToNull(values.plate_number),
    // States and provinces are stored in capitals.
    plate_jurisdiction: blankToNull(values.plate_jurisdiction)?.toUpperCase() ?? null,
    usdot_number: blankToNull(values.usdot_number),
  };
}

// The vehicle and its first monthly parking are saved together in one request.
export function formToCreate(values: VehicleFormValues, reason: string): VehicleCreate {
  const write = formToWrite(values);
  const rate = values.monthly_rate.trim();
  if (!rate) return write;
  return {
    ...write,
    parking: {
      starts_on: values.parking_starts_on,
      ends_on: null,
      monthly_rate: { amount: usdToCents(rate), currency: 'USD' },
      effective_on: values.parking_starts_on,
      reason,
    },
  };
}

export function changedVehicleFields(before: VehicleWrite, after: VehicleWrite): VehicleUpdate {
  const changes: Partial<Record<keyof VehicleWrite, unknown>> = {};
  for (const key of Object.keys(after) as (keyof VehicleWrite)[]) {
    if (key !== 'customer_id' && before[key] !== after[key]) changes[key] = after[key];
  }
  return changes as VehicleUpdate;
}
