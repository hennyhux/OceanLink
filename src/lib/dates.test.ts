import { describe, expect, it } from 'vitest';

import {
  addDays,
  firstOfMonth,
  formatDate,
  formatDateTime,
  isBusinessDate,
  todayInTimeZone,
} from './dates';
import { safeReturnTo, withReturnTo } from './navigation';

describe('business dates', () => {
  it('uses the lot time zone for today, not UTC', () => {
    // 1 AM UTC on Oct 21 is still Oct 20 in California.
    expect(todayInTimeZone('America/Los_Angeles', new Date('2026-10-21T01:00:00Z'))).toBe(
      '2026-10-20',
    );
    // 8 PM UTC on Mar 4 is already Mar 5 in New Zealand, and single digits are padded.
    expect(todayInTimeZone('Pacific/Auckland', new Date('2026-03-04T20:00:00Z'))).toBe(
      '2026-03-05',
    );
  });

  it('accepts only real calendar dates', () => {
    expect(isBusinessDate('2026-02-28')).toBe(true);
    expect(isBusinessDate('2026-02-30')).toBe(false);
    expect(isBusinessDate('2026-2-3')).toBe(false);
  });

  it.each(['x2026-02-28', '2026-02-28x', '2026-02-28T00:00'])(
    'rejects extra text around a date (%s)',
    (value) => {
      expect(isBusinessDate(value)).toBe(false);
    },
  );

  it('formats a business date without shifting it a day', () => {
    expect(formatDate('2026-11-01', 'en')).toBe('Nov 1, 2026');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(firstOfMonth('2026-10-24')).toBe('2026-10-01');
  });

  it('shows text that is not a business date as it is', () => {
    expect(formatDate('2026-02-30', 'en')).toBe('2026-02-30');
  });

  it('formats an instant with both date and time', () => {
    // Noon UTC is the same calendar day in every time zone a test machine might use.
    expect(formatDateTime('2026-10-31T12:00:00Z', 'en')).toMatch(
      /^Oct 31, 2026, \d{1,2}:\d{2}\s[AP]M$/,
    );
  });

  it('shows an unreadable instant as it is', () => {
    expect(formatDateTime('soon', 'en')).toBe('soon');
  });
});

describe('return links', () => {
  it('keeps same-site paths and rejects anything that could leave the site', () => {
    expect(safeReturnTo('/customers?q=pac', '/')).toBe('/customers?q=pac');
    for (const bad of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      '/\t/evil.example',
      'customers',
    ]) {
      expect(safeReturnTo(bad, '/fallback')).toBe('/fallback');
    }
    expect(withReturnTo('/vehicles/new?customer_id=1', '/customers/1')).toBe(
      '/vehicles/new?customer_id=1&returnTo=%2Fcustomers%2F1',
    );
  });
});
