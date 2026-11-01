import { describe, expect, it } from 'vitest';

import type { Customer, CustomerListItem } from '@/features/customers/types';
import type { Payment } from '@/features/payments/types';
import type { Vehicle } from '@/features/vehicles/types';
import { usd } from '@/lib/money';

import {
  formatWhen,
  hasParkingOn,
  isTruncated,
  missingContact,
  notYetDue,
  parkingEndingSoon,
  recentActivity,
  topOverdue,
  withoutParking,
} from './model';

const TODAY = '2026-10-31';

const vehicle = (overrides: Partial<Vehicle> = {}): Vehicle => ({
  id: 'v',
  version: 1,
  customer_id: 'c',
  customer_name: 'Co',
  vehicle_type: 'truck',
  unit_number: '1',
  plate_number: null,
  plate_jurisdiction: null,
  usdot_number: '1',
  is_active: true,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  parking: null,
  ...overrides,
});

const parking = (starts_on: string, ends_on: string | null = null) => ({
  starts_on,
  ends_on,
  monthly_rate: usd(100),
  rate_history: [],
});

const customer = (overrides: Partial<Customer> = {}): Customer => ({
  id: 'c',
  version: 1,
  type: 'business',
  display_name: 'Co',
  contact_name: null,
  phone: null,
  email: null,
  usdot_number: null,
  address_line1: null,
  address_line2: null,
  city: null,
  state: null,
  postal_code: null,
  notes: null,
  is_active: true,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  ...overrides,
});

const payment = (overrides: Partial<Payment> = {}): Payment => ({
  id: 'p',
  version: 1,
  customer_id: 'c',
  customer_name: 'Co',
  amount: usd(5000),
  allocated_amount: usd(0),
  available_credit: usd(5000),
  effective_on: '2026-10-30',
  method: 'cash',
  reference: null,
  notes: null,
  status: 'received',
  recorded_by: { id: 'u', name: 'U' },
  created_at: '2026-10-30T10:00:00Z',
  reversal: null,
  audit_events: [],
  ...overrides,
});

const ids = (items: { id: string }[]) => items.map((item) => item.id);

describe('hasParkingOn', () => {
  it.each([
    ['open-ended parking that started earlier', parking('2026-10-01'), true],
    ['parking that starts today', parking(TODAY), true],
    ['parking that starts tomorrow', parking('2026-11-01'), false],
    ['parking that ends tomorrow', parking('2026-10-01', '2026-11-01'), true],
    // Ends are exclusive: a period ending today no longer covers today.
    ['parking that ends today', parking('2026-10-01', TODAY), false],
    ['no parking', null, false],
  ])('is %s -> %s', (_, value, expected) => {
    expect(hasParkingOn(vehicle({ parking: value }), TODAY)).toBe(expected);
  });

  it('ignores parking on an inactive vehicle', () => {
    expect(hasParkingOn(vehicle({ parking: parking('2026-10-01'), is_active: false }), TODAY)).toBe(
      false,
    );
  });
});

describe('parkingEndingSoon', () => {
  const ending = (ends_on: string | null, extra: Partial<Vehicle> = {}) =>
    vehicle({ id: `ends-${ends_on}`, parking: parking('2026-01-01', ends_on), ...extra });

  it('includes parking ending tomorrow through exactly 30 days out, in input order', () => {
    const list = [
      ending('2026-11-30'), // today + 30, the last day included
      ending(TODAY), // already ended
      ending('2026-11-01'), // tomorrow
      ending('2026-12-01'), // today + 31
      ending(null), // open-ended
    ];
    expect(ids(parkingEndingSoon(list, TODAY))).toEqual(['ends-2026-11-30', 'ends-2026-11-01']);
  });

  it('honors a custom window', () => {
    const list = [ending('2026-11-07'), ending('2026-11-08')];
    expect(ids(parkingEndingSoon(list, TODAY, 7))).toEqual(['ends-2026-11-07']);
  });

  it('skips inactive vehicles and vehicles without parking', () => {
    expect(
      parkingEndingSoon([ending('2026-11-10', { is_active: false }), vehicle()], TODAY),
    ).toEqual([]);
  });
});

describe('withoutParking', () => {
  it('lists only active vehicles that have no monthly parking', () => {
    const list = [
      vehicle({ id: 'none' }),
      vehicle({ id: 'parked', parking: parking('2026-10-01') }),
      vehicle({ id: 'inactive', is_active: false }),
    ];
    expect(ids(withoutParking(list))).toEqual(['none']);
  });
});

describe('missingContact', () => {
  it('flags active customers with neither a phone nor an email', () => {
    const list = [
      customer({ id: 'none' }),
      customer({ id: 'phone', phone: '555' }),
      customer({ id: 'email', email: 'a@example.com' }),
      customer({ id: 'inactive', is_active: false }),
    ];
    expect(ids(missingContact(list))).toEqual(['none']);
  });
});

describe('topOverdue', () => {
  const owing = (id: string, cents: number) =>
    ({ ...customer({ id }), overdue_balance: usd(cents) }) as CustomerListItem;

  it('puts the largest past-due balance first and keeps three by default', () => {
    const list = [owing('a', 100), owing('b', 900), owing('c', 500), owing('d', 300)];
    expect(ids(topOverdue(list))).toEqual(['b', 'c', 'd']);
  });

  it('honors a custom limit and leaves the input order alone', () => {
    const list = [owing('a', 100), owing('b', 900)];
    expect(ids(topOverdue(list, 1))).toEqual(['b']);
    expect(ids(list)).toEqual(['a', 'b']);
  });
});

describe('notYetDue', () => {
  it.each([
    [50000, 20000, 30000],
    [20000, 20000, 0],
    // Never negative, even if the backend reports more overdue than outstanding.
    [10000, 20000, 0],
  ])('outstanding %i minus overdue %i is %i', (outstanding, overdue, expected) => {
    expect(notYetDue(outstanding, overdue)).toBe(expected);
  });
});

describe('isTruncated', () => {
  it.each([
    [undefined, false],
    [{ total: 3, items: [1, 2] }, true],
    [{ total: 2, items: [1, 2] }, false],
    [{ total: 0, items: [] }, false],
  ])('%o -> %s', (page, expected) => {
    expect(isTruncated(page)).toBe(expected);
  });
});

describe('recentActivity', () => {
  it('builds a payment entry linked to the customer transactions tab', () => {
    expect(recentActivity([], [], [payment()])).toEqual([
      {
        key: 'payment-p',
        kind: 'payment',
        at: '2026-10-30T10:00:00Z',
        to: '/customers/c?tab=transactions',
        name: 'Co',
        cents: 5000,
      },
    ]);
  });

  it('adds a separate, newer reversal entry when a payment was reversed', () => {
    const reversed = payment({
      reversal: { reason: 'x', actor: { id: 'a', name: 'A' }, created_at: '2026-10-31T09:00:00Z' },
    });
    expect(recentActivity([], [], [reversed])).toEqual([
      {
        key: 'reversal-p',
        kind: 'reversal',
        at: '2026-10-31T09:00:00Z',
        to: '/customers/c?tab=transactions',
        name: 'Co',
        cents: 5000,
      },
      expect.objectContaining({ key: 'payment-p', kind: 'payment' }),
    ]);
  });

  it('builds a vehicle entry linked to the vehicle', () => {
    const added = vehicle({ id: 'v1', customer_name: 'Fleet', created_at: '2026-10-29T00:00:00Z' });
    expect(recentActivity([], [added], [])).toEqual([
      {
        key: 'vehicle-v1',
        kind: 'vehicle',
        at: '2026-10-29T00:00:00Z',
        to: '/vehicles/v1',
        name: 'Fleet',
        vehicle: added,
      },
    ]);
  });

  it('adds an "updated" entry only when the customer changed after being added', () => {
    const unchanged = customer({ id: 'same', display_name: 'Same' });
    const edited = customer({
      id: 'edited',
      display_name: 'Edited',
      updated_at: '2026-10-05T00:00:00Z',
    });
    expect(recentActivity([unchanged, edited], [], [])).toEqual([
      {
        key: 'updated-edited',
        kind: 'customerUpdated',
        at: '2026-10-05T00:00:00Z',
        to: '/customers/edited',
        name: 'Edited',
      },
      {
        key: 'added-edited',
        kind: 'customerAdded',
        at: '2026-10-01T00:00:00Z',
        to: '/customers/edited',
        name: 'Edited',
      },
      {
        key: 'added-same',
        kind: 'customerAdded',
        at: '2026-10-01T00:00:00Z',
        to: '/customers/same',
        name: 'Same',
      },
    ]);
  });

  it('orders newest first, breaks ties by key, and drops entries with unreadable times', () => {
    const entries = recentActivity(
      [customer({ id: 'b' }), customer({ id: 'a' }), customer({ id: 'bad', created_at: 'soon' })],
      [vehicle({ created_at: '2026-10-02T00:00:00Z' })],
      [],
    );
    expect(entries.map((entry) => entry.key)).toEqual(['vehicle-v', 'added-a', 'added-b']);
  });

  it('keeps five entries by default and honors a custom limit', () => {
    const many = ['1', '2', '3', '4', '5', '6'].map((day) =>
      customer({ id: day, created_at: `2026-10-0${day}T00:00:00Z` }),
    );
    expect(recentActivity(many, [], []).map((entry) => entry.key)).toEqual([
      'added-6',
      'added-5',
      'added-4',
      'added-3',
      'added-2',
    ]);
    expect(recentActivity(many, [], [], 2)).toHaveLength(2);
  });
});

describe('formatWhen', () => {
  const now = new Date(2026, 9, 31, 15, 0);
  const at = (...parts: [number, number, number, number, number]) =>
    new Date(...parts).toISOString();

  it('shows only a time for something that happened today', () => {
    expect(formatWhen(at(2026, 9, 31, 13, 44), 'en', now)).toMatch(/^1:44\sPM$/);
  });

  it('shows month and day earlier this year', () => {
    expect(formatWhen(at(2026, 9, 2, 9, 0), 'en', now)).toBe('Oct 2');
  });

  it('shows the full date for an earlier year', () => {
    expect(formatWhen(at(2025, 9, 2, 9, 0), 'en', now)).toBe('Oct 2, 2025');
  });

  it('defaults "now" to the current time', () => {
    expect(formatWhen(new Date().toISOString(), 'en')).toMatch(/^\d{1,2}:\d{2}\s[AP]M$/);
  });
});
