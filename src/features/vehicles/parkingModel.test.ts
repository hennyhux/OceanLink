import { describe, expect, it } from 'vitest';
import { businessDate, cents, parkingSchema, parkingToWrite } from './parkingModel';

const setup = {
  pool_id: 'standard',
  starts_on: '2026-10-01',
  ends_on: '',
  rate: '200.29',
  effective_on: '2026-10-01',
  reason: 'Initial parking rate',
};

describe('vehicle parking rates', () => {
  it('stores each vehicle rate in exact USD cents', () => {
    expect(cents('0.29')).toBe(29);
    expect(parkingToWrite(setup).monthly_rate).toEqual({ amount: 20029, currency: 'USD' });
    expect(parkingToWrite(setup).ends_on).toBeNull();
  });
  it('rejects invalid dates, amounts, and an end before the start', () => {
    expect(businessDate.safeParse('2026-02-30').success).toBe(false);
    expect(parkingSchema.safeParse({ ...setup, rate: '1.999' }).success).toBe(false);
    expect(parkingSchema.safeParse({ ...setup, ends_on: setup.starts_on }).success).toBe(false);
  });
  it('requires effective dates to fall inside the service period', () => {
    expect(parkingSchema.safeParse({ ...setup, effective_on: '2026-09-30' }).success).toBe(false);
    expect(
      parkingSchema.safeParse({ ...setup, ends_on: '2026-11-01', effective_on: '2026-11-01' })
        .success,
    ).toBe(false);
  });
});
