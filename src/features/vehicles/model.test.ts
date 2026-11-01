import { describe, expect, it } from 'vitest';

import {
  changedVehicleFields,
  emptyVehicleForm,
  formToCreate,
  formToWrite,
  vehicleFormSchema,
} from './model';
import { endDateSchema, rateChangeSchema } from './parkingModel';

const base = emptyVehicleForm('c1', null);
const problems = (values: Partial<typeof base>) => {
  const result = vehicleFormSchema.safeParse({ ...base, ...values });
  return result.success ? [] : result.error.issues.map((issue) => String(issue.path[0])).sort();
};

describe('vehicle form rules (REQUIREMENTS 7.1)', () => {
  it('needs a USDOT number and a unit number when identified by USDOT', () => {
    expect(problems({ method: 'usdot' })).toEqual(['unit_number', 'usdot_number']);
    expect(problems({ method: 'usdot', usdot_number: '1234567', unit_number: '12' })).toEqual([]);
  });

  it('does not need a unit number when a full plate tells the truck apart', () => {
    expect(problems({ usdot_number: '1', plate_number: 'ABC', plate_jurisdiction: 'CA' })).toEqual(
      [],
    );
  });

  it('needs a plate with its state when identified by plate', () => {
    expect(problems({ method: 'plate' })).toEqual(['plate_jurisdiction', 'plate_number']);
  });

  it('rejects a USDOT number that is not 1 to 8 digits', () => {
    expect(problems({ usdot_number: '12 34', unit_number: '1' })).toEqual(['usdot_number']);
  });

  it('asks for a start date only when a monthly amount is entered, and allows zero', () => {
    const ok = { usdot_number: '1', unit_number: '1' };
    expect(problems({ ...ok, monthly_rate: '' })).toEqual([]);
    expect(problems({ ...ok, monthly_rate: '300' })).toEqual(['parking_starts_on']);
    expect(problems({ ...ok, monthly_rate: '-5', parking_starts_on: '2026-11-01' })).toEqual([
      'monthly_rate',
    ]);
    expect(problems({ ...ok, monthly_rate: '0', parking_starts_on: '2026-11-01' })).toEqual([]);
  });
});

describe('vehicle form to request', () => {
  it('sends the first monthly parking with the vehicle, starting on the billing date', () => {
    const body = formToCreate(
      {
        ...base,
        usdot_number: '1',
        unit_number: '9',
        monthly_rate: '325.50',
        parking_starts_on: '2026-11-01',
      },
      'New monthly customer',
    );
    expect(body.parking).toEqual({
      starts_on: '2026-11-01',
      ends_on: null,
      monthly_rate: { amount: 32550, currency: 'USD' },
      effective_on: '2026-11-01',
      reason: 'New monthly customer',
    });
    expect(formToCreate({ ...base, usdot_number: '1', unit_number: '9' }, 'x')).not.toHaveProperty(
      'parking',
    );
  });

  it('writes states in capitals, blanks as null, and sends only changes', () => {
    const before = formToWrite({
      ...base,
      method: 'plate',
      plate_number: ' 8abc ',
      plate_jurisdiction: ' ca ',
    });
    expect(before).toMatchObject({
      plate_number: '8abc',
      plate_jurisdiction: 'CA',
      usdot_number: null,
    });
    expect(
      changedVehicleFields(before, { ...before, unit_number: '5', customer_id: 'other' }),
    ).toEqual({ unit_number: '5' });
  });
});

describe('parking change rules', () => {
  it('only accepts new rates on a future date after the last scheduled change', () => {
    const schema = rateChangeSchema('2026-10-31', '2026-11-15');
    const base = { rate: '350', reason: 'Yearly increase' };
    expect(schema.safeParse({ ...base, effective_on: '2026-10-31' }).success).toBe(false);
    expect(schema.safeParse({ ...base, effective_on: '2026-11-15' }).success).toBe(false);
    expect(schema.safeParse({ ...base, effective_on: '2026-12-01' }).success).toBe(true);
  });

  it('allows clearing the end date but not ending before the start', () => {
    const schema = endDateSchema('2026-11-01');
    expect(schema.safeParse({ ends_on: '', reason: 'x' }).success).toBe(true);
    expect(schema.safeParse({ ends_on: '2026-11-01', reason: 'x' }).success).toBe(false);
    expect(schema.safeParse({ ends_on: '2026-12-01', reason: '' }).success).toBe(false);
  });
});
