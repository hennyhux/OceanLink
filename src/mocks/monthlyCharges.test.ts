import { describe, expect, it } from 'vitest';

import type { Vehicle } from '@/features/vehicles/types';
import { usd } from '@/lib/money';

import { monthlyCharges } from './monthlyCharges';

function vehicleWith(
  starts_on: string,
  rates: [string, number][],
  ends_on: string | null = null,
): Vehicle {
  return {
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
    parking: {
      starts_on,
      ends_on,
      monthly_rate: usd(rates[0]![1]),
      rate_history: rates.map(([effective_on, amount]) => ({
        effective_on,
        monthly_rate: usd(amount),
        reason: 'x',
      })),
    },
  };
}

describe('monthly charge periods', () => {
  it('charges a full month from the start date, billed in advance', () => {
    const lines = monthlyCharges(
      [vehicleWith('2026-10-15', [['2026-10-15', 30000]])],
      '2026-10-15',
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      starts_on: '2026-10-15',
      ends_on: '2026-11-15',
      amount: usd(30000),
    });
  });

  it('keeps month-end anchors: Jan 31, then Feb 28, then back to Mar 31', () => {
    const lines = monthlyCharges(
      [vehicleWith('2027-01-31', [['2027-01-31', 30000]])],
      '2027-03-31',
    );
    expect(lines.map((line) => [line.starts_on, line.ends_on])).toEqual([
      ['2027-01-31', '2027-02-28'],
      ['2027-02-28', '2027-03-31'],
      ['2027-03-31', '2027-04-30'],
    ]);
  });

  it('prorates a period cut short by the service end: $300 for 15 of 30 days is $150', () => {
    const lines = monthlyCharges(
      [vehicleWith('2026-11-01', [['2026-11-01', 30000]], '2026-11-16')],
      '2026-11-30',
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ service_days: 15, period_days: 30, amount: usd(15000) });
  });

  it('splits a period at a rate change and rounds once per line', () => {
    // 10 days at $300 and 20 days at $400 in a 30 day period: (3000 + 8000) / 30 = $366.67
    const lines = monthlyCharges(
      [
        vehicleWith('2026-11-01', [
          ['2026-11-01', 30000],
          ['2026-11-11', 40000],
        ]),
      ],
      '2026-11-01',
    );
    expect(lines[0]?.amount).toEqual(usd(36667));
  });

  it('adds up to the required financial example: $200 and $250 make $450', () => {
    const lines = monthlyCharges(
      [
        vehicleWith('2026-10-01', [['2026-10-01', 20000]]),
        { ...vehicleWith('2026-10-01', [['2026-10-01', 25000]]), id: 'v2' },
      ],
      '2026-10-01',
    );
    expect(lines.reduce((sum, line) => sum + line.amount.amount, 0)).toBe(45000);
  });
});
