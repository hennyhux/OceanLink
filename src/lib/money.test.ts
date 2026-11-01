import { describe, expect, it } from 'vitest';

import { centsToInput, formatMoney, isUsdInput, usd, usdToCents } from './money';

describe('money', () => {
  it('turns typed dollars into whole cents without floating point drift', () => {
    expect(usdToCents('300')).toBe(30000);
    expect(usdToCents(' 300.5 ')).toBe(30050);
    expect(usdToCents('0.29')).toBe(29);
    expect(usdToCents('1234567.89')).toBe(123456789);
  });

  it.each(['-1', '1.234', 'abc', '', '12345678', '1,000'])('rejects %s', (value) => {
    expect(isUsdInput(value)).toBe(false);
    expect(() => usdToCents(value)).toThrow('Invalid USD amount');
  });

  it('accepts typed dollars with spaces around them', () => {
    expect(isUsdInput(' 12.5 ')).toBe(true);
  });

  it('formats cents for display and back for editing', () => {
    expect(formatMoney(15000, 'en')).toBe('$150.00');
    expect(centsToInput(30050)).toBe('300.50');
    expect(centsToInput(5)).toBe('0.05');
    expect(centsToInput(0)).toBe('0.00');
    expect(centsToInput(123456789)).toBe('1234567.89');
  });

  it('wraps cents as a USD amount', () => {
    expect(usd(2500)).toEqual({ amount: 2500, currency: 'USD' });
  });
});
