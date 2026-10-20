import { describe, expect, it } from 'vitest';

import {
  diffWrite,
  emptyVehicleForm,
  formToWrite,
  vehicleFormSchema,
  vehicleToForm,
} from './formModel';
import type { Vehicle } from './types';

const base = { ...emptyVehicleForm('c1', null) };

function errorPaths(values: Partial<typeof base>): string[] {
  const result = vehicleFormSchema.safeParse({ ...base, ...values });
  return result.success ? [] : result.error.issues.map((issue) => String(issue.path[0]));
}

describe('vehicle form rules', () => {
  it('needs a USDOT number and a unit number when identifying by USDOT', () => {
    expect(errorPaths({ method: 'usdot' }).sort()).toEqual(['unit_number', 'usdot_number']);
  });

  it('accepts a USDOT vehicle with a unit number and no plate', () => {
    expect(errorPaths({ method: 'usdot', usdot_number: '1234567', unit_number: '12' })).toEqual([]);
  });

  it('does not need a unit number when a full plate is also given', () => {
    expect(
      errorPaths({
        method: 'usdot',
        usdot_number: '1234567',
        plate_number: 'ABC123',
        plate_jurisdiction: 'CA',
      }),
    ).toEqual([]);
  });

  it('still needs the unit number when the plate has no state', () => {
    expect(
      errorPaths({ method: 'usdot', usdot_number: '1234567', plate_number: 'ABC123' }).sort(),
    ).toEqual(['plate_jurisdiction', 'unit_number']);
  });

  it('needs a plate and a state when identifying by plate, and never a USDOT number', () => {
    expect(errorPaths({ method: 'plate' }).sort()).toEqual(['plate_jurisdiction', 'plate_number']);
    expect(
      errorPaths({ method: 'plate', plate_number: 'ABC123', plate_jurisdiction: 'CA' }),
    ).toEqual([]);
  });

  it('rejects a USDOT number that is not 1 to 8 digits, whichever way it is identified', () => {
    for (const bad of ['ABC', '123456789', '12 34']) {
      expect(
        errorPaths({
          method: 'plate',
          plate_number: 'ABC123',
          plate_jurisdiction: 'CA',
          usdot_number: bad,
        }),
      ).toEqual(['usdot_number']);
    }
  });

  it('needs a customer', () => {
    expect(
      errorPaths({ customer_id: '', method: 'usdot', usdot_number: '1', unit_number: '1' }),
    ).toEqual(['customer_id']);
  });
});

describe('vehicle form to wire', () => {
  it('trims, writes the state in capitals, and turns blanks into null', () => {
    const write = formToWrite({
      ...base,
      method: 'plate',
      plate_number: '  8ABC123 ',
      plate_jurisdiction: ' ca ',
      usdot_number: '',
      unit_number: '  ',
    });
    expect(write).toMatchObject({
      plate_number: '8ABC123',
      plate_jurisdiction: 'CA',
      usdot_number: null,
      unit_number: null,
    });
  });

  it('never includes the method', () => {
    expect(formToWrite({ ...base, usdot_number: '1', unit_number: '1' })).not.toHaveProperty(
      'method',
    );
  });

  it('diffWrite returns only changed fields and ignores the owner', () => {
    const vehicle: Vehicle = {
      id: 'v1',
      version: 1,
      customer_id: 'c1',
      customer_name: 'Co',
      vehicle_type: 'truck',
      unit_number: '12',
      plate_number: null,
      plate_jurisdiction: null,
      usdot_number: '1234567',
      is_active: true,
      created_at: '',
      updated_at: '',
    };
    const before = formToWrite(vehicleToForm(vehicle));
    const after = formToWrite({ ...vehicleToForm(vehicle), unit_number: '13', customer_id: 'c2' });
    expect(diffWrite(before, after)).toEqual({ unit_number: '13' });
  });

  it('starts on the plate view only when the vehicle has a plate', () => {
    const vehicle = {
      id: 'v1',
      version: 1,
      customer_id: 'c1',
      customer_name: 'Co',
      vehicle_type: 'truck',
      unit_number: '12',
      plate_number: null,
      plate_jurisdiction: null,
      usdot_number: '1234567',
      is_active: true,
      created_at: '',
      updated_at: '',
    } satisfies Vehicle;
    expect(vehicleToForm(vehicle).method).toBe('usdot');
    expect(
      vehicleToForm({ ...vehicle, plate_number: 'ABC', plate_jurisdiction: 'CA' }).method,
    ).toBe('plate');
  });
});
