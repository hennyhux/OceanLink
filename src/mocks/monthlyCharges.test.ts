import { describe, expect, it } from 'vitest';
import { seedVehicles } from './vehicleHandlers';
import { monthlyCharges } from './monthlyCharges';

function vehicle(start = '2026-10-01') {
  return {
    ...seedVehicles()[0]!,
    parking: {
      starts_on: start,
      ends_on: null as string | null,
      monthly_rate: { amount: 30000, currency: 'USD' as const },
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
  it('anchors a full billing month on the service start date', () => {
    const partial = vehicle('2026-11-16');
    expect(monthlyCharges([partial], '2026-11-20')[0]).toMatchObject({
      starts_on: '2026-11-16',
      ends_on: '2026-12-16',
      service_days: 30,
      period_days: 30,
      amount: { amount: 30000 },
    });
  });
  it('restores the original anchor after February', () => {
    const lines = monthlyCharges([vehicle('2026-01-31')], '2026-03-31');
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
