import { describe, expect, it } from 'vitest';
import { seedVehicles } from './vehicleHandlers';
import { monthlyCharges } from './monthlyCharges';

function vehicle(start = '2026-10-01', anchor = 1) {
  return {
    ...seedVehicles()[0]!,
    parking: {
      pool_id: 'mock-standard',
      pool_label: 'Standard',
      starts_on: start,
      ends_on: null as string | null,
      monthly_rate: { amount: 30000, currency: 'USD' as const },
      billing_anchor_day: anchor,
      payment_terms: '',
      rate_history: [
        {
          effective_on: start,
          monthly_rate: { amount: 30000, currency: 'USD' as const },
          reason: 'Initial rate',
        },
      ],
    },
  };
}

describe('monthly parking charge preview', () => {
  it('bills both vehicles for the current monthly period in advance', () => {
    const first = vehicle();
    const second = { ...vehicle(), id: 'second' };
    expect(monthlyCharges([first, second], '2026-10-20').map((line) => line.amount.amount)).toEqual(
      [30000, 30000],
    );
  });
  it('prorates a partial month by calendar days and rounds half up to cents', () => {
    const partial = vehicle('2026-11-16');
    expect(monthlyCharges([partial], '2026-11-20')[0]).toMatchObject({
      service_days: 15,
      period_days: 30,
      amount: { amount: 15000 },
    });
  });
  it('restores the original anchor after February', () => {
    const lines = monthlyCharges([vehicle('2026-01-31', 31)], '2026-03-31');
    expect(lines.map((line) => [line.starts_on, line.ends_on])).toEqual([
      ['2026-01-31', '2026-02-28'],
      ['2026-02-28', '2026-03-31'],
      ['2026-03-31', '2026-04-30'],
    ]);
  });
  it('splits a service period at a rate change and ignores future service', () => {
    const changed = vehicle('2026-11-01');
    changed.parking.rate_history.push({
      effective_on: '2026-11-16',
      monthly_rate: { amount: 60000, currency: 'USD' },
      reason: 'New rate',
    });
    expect(monthlyCharges([changed], '2026-11-20')[0]?.amount.amount).toBe(45000);
    expect(monthlyCharges([vehicle('2027-01-01')], '2026-10-20')).toEqual([]);
  });
});
