import { z } from 'zod';
import type { Money } from '@/lib/money';
import type { VehicleType } from './types';

export interface CapacityPool {
  id: string;
  label: string;
  capacity: number;
  allowed_vehicle_types: VehicleType[];
}

export interface VehicleParking {
  pool_id: string;
  pool_label: string;
  starts_on: string;
  ends_on: string | null;
  monthly_rate: Money;
  billing_anchor_day: number;
  payment_terms: string;
  rate_history: { effective_on: string; monthly_rate: Money; reason: string }[];
}

export const businessDate = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}, 'parking.invalidDate');

export const rateSchema = z
  .string()
  .trim()
  .regex(/^\d{1,7}(\.\d{1,2})?$/, 'parking.invalidRate');

export function cents(value: string): number {
  const [whole = '0', fraction = ''] = rateSchema.parse(value).split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export const parkingSchema = z
  .object({
    pool_id: z.string().min(1, 'parking.required'),
    starts_on: businessDate,
    ends_on: z.union([z.literal(''), businessDate]),
    rate: rateSchema,
    effective_on: businessDate,
    reason: z.string().trim().min(1, 'parking.required').max(1000, 'parking.tooLong'),
  })
  .superRefine((values, context) => {
    if (values.ends_on && values.ends_on <= values.starts_on)
      context.addIssue({ code: 'custom', path: ['ends_on'], message: 'parking.invalidEnd' });
    if (
      values.effective_on < values.starts_on ||
      (values.ends_on && values.effective_on >= values.ends_on)
    )
      context.addIssue({
        code: 'custom',
        path: ['effective_on'],
        message: 'parking.invalidEffective',
      });
  });

export type ParkingFormValues = z.infer<typeof parkingSchema>;
export type VehicleParkingWrite = Omit<ParkingFormValues, 'rate' | 'ends_on'> & {
  monthly_rate: Money;
  ends_on: string | null;
};

export function parkingToWrite(values: ParkingFormValues): VehicleParkingWrite {
  const { rate, ends_on, ...rest } = parkingSchema.parse(values);
  return {
    ...rest,
    ends_on: ends_on || null,
    monthly_rate: { amount: cents(rate), currency: 'USD' },
  };
}
