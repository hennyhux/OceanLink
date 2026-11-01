import { z } from 'zod';

import { isBusinessDate } from '@/lib/dates';
import { USD_INPUT, usdToCents } from '@/lib/money';

import type { ParkingWrite, VehicleParking } from './types';

const reason = z.string().trim().min(1, 'parking.errors.reasonRequired').max(1000, 'form.tooLong');
const date = (message: string) => z.string().refine(isBusinessDate, message);
const rate = z.string().trim().regex(USD_INPUT, 'money.invalid');

// First setup. The first rate starts on the billing start date.
export const firstSetupSchema = z.object({
  starts_on: date('parking.errors.startRequired'),
  rate,
  reason,
});
export type FirstSetupValues = z.infer<typeof firstSetupSchema>;

export function firstSetupToWrite(values: FirstSetupValues): ParkingWrite {
  return {
    starts_on: values.starts_on,
    ends_on: null,
    monthly_rate: { amount: usdToCents(values.rate), currency: 'USD' },
    effective_on: values.starts_on,
    reason: values.reason.trim(),
  };
}

// New rates start on a future date and are added to the history, never overwriting it.
export function rateChangeSchema(today: string, latestEffective: string) {
  return z.object({
    rate,
    effective_on: date('parking.errors.dateRequired').refine(
      (value) => value > today && value > latestEffective,
      'parking.errors.futureDate',
    ),
    reason,
  });
}
export type RateChangeValues = z.infer<ReturnType<typeof rateChangeSchema>>;

export function rateChangeToWrite(parking: VehicleParking, values: RateChangeValues): ParkingWrite {
  return {
    starts_on: parking.starts_on,
    ends_on: parking.ends_on,
    monthly_rate: { amount: usdToCents(values.rate), currency: 'USD' },
    effective_on: values.effective_on,
    reason: values.reason.trim(),
  };
}

// The end date is the first day without service, so it must come after the start.
export function endDateSchema(startsOn: string) {
  return z.object({
    ends_on: z
      .string()
      .refine((value) => value === '' || isBusinessDate(value), 'parking.errors.dateRequired')
      .refine((value) => value === '' || value > startsOn, 'parking.errors.endAfterStart'),
    reason,
  });
}
export type EndDateValues = z.infer<ReturnType<typeof endDateSchema>>;

export function endDateToWrite(parking: VehicleParking, values: EndDateValues): ParkingWrite {
  const latest = parking.rate_history.at(-1);
  return {
    starts_on: parking.starts_on,
    ends_on: values.ends_on || null,
    // Same rate as the latest entry, so no new rate is added.
    monthly_rate: latest?.monthly_rate ?? parking.monthly_rate,
    effective_on: latest?.effective_on ?? parking.starts_on,
    reason: values.reason.trim(),
  };
}
