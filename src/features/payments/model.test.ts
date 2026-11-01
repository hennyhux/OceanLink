import { describe, expect, it } from 'vitest';

import { paymentFormSchema, reasonSchema, toPaymentWrite, type PaymentFormValues } from './model';

const TODAY = '2026-10-31';

const valid = (overrides: Partial<PaymentFormValues> = {}): PaymentFormValues => ({
  customer_id: 'c1',
  amount: '125.50',
  effective_on: TODAY,
  method: 'cash',
  reference: '',
  notes: '',
  ...overrides,
});

// The message for each field that failed, so tests can check the exact rule that fired.
function errors(values: unknown, today = TODAY): Record<string, string> {
  const result = paymentFormSchema(today).safeParse(values);
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
  );
}

describe('payment form rules', () => {
  it('accepts a complete payment dated today', () => {
    expect(errors(valid())).toEqual({});
  });

  it('requires a customer', () => {
    expect(errors(valid({ customer_id: '' }))).toEqual({
      customer_id: 'payments.errors.customerRequired',
    });
  });

  it.each(['0', '0.00', '-5', '1.234', 'abc', '', '12345678'])(
    'rejects the amount %j',
    (amount) => {
      expect(errors(valid({ amount }))).toEqual({ amount: 'money.positive' });
    },
  );

  it.each(['0.01', ' 25 ', '9999999.99'])('accepts the amount %j', (amount) => {
    expect(errors(valid({ amount }))).toEqual({});
  });

  it('rejects a date that is not on the calendar', () => {
    expect(errors(valid({ effective_on: '2026-02-30' }))).toEqual({
      effective_on: 'payments.errors.dateRequired',
    });
  });

  it('rejects a date after today but accepts today', () => {
    expect(errors(valid({ effective_on: '2026-11-01' }))).toEqual({
      effective_on: 'payments.errors.futureDate',
    });
    expect(errors(valid({ effective_on: TODAY }))).toEqual({});
  });

  it('skips the future-date check until the lot date is known', () => {
    expect(errors(valid({ effective_on: '2030-01-01' }), '')).toEqual({});
  });

  it('rejects an unknown payment method', () => {
    expect(Object.keys(errors({ ...valid(), method: 'crypto' }))).toEqual(['method']);
  });

  it.each([
    ['reference', 200],
    ['notes', 2000],
  ] as const)('limits %s to %i characters after trimming', (field, max) => {
    expect(errors(valid({ [field]: `  ${'x'.repeat(max)}  ` }))).toEqual({});
    expect(errors(valid({ [field]: 'x'.repeat(max + 1) }))).toEqual({ [field]: 'form.tooLong' });
  });
});

describe('toPaymentWrite', () => {
  it('sends whole cents and trims text', () => {
    const values = paymentFormSchema(TODAY).parse(
      valid({ amount: ' 125.5 ', reference: '  WIRE-1  ', notes: ' paid at desk ' }),
    );
    expect(toPaymentWrite(values)).toEqual({
      customer_id: 'c1',
      amount: { amount: 12550, currency: 'USD' },
      effective_on: TODAY,
      method: 'cash',
      reference: 'WIRE-1',
      notes: 'paid at desk',
    });
  });

  it('sends blank reference and notes as null', () => {
    const write = toPaymentWrite(valid({ reference: '   ', notes: '' }));
    expect(write.reference).toBeNull();
    expect(write.notes).toBeNull();
  });
});

describe('reversal reason', () => {
  it.each(['', '   '])('is required (%j)', (reason) => {
    const result = reasonSchema().safeParse({ reason });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('payments.errors.reasonRequired');
  });

  it('is trimmed and limited to 1000 characters', () => {
    expect(reasonSchema().parse({ reason: '  Bounced check  ' })).toEqual({
      reason: 'Bounced check',
    });
    expect(reasonSchema().safeParse({ reason: 'x'.repeat(1000) }).success).toBe(true);
    expect(reasonSchema().safeParse({ reason: 'x'.repeat(1001) }).error?.issues[0]?.message).toBe(
      'form.tooLong',
    );
  });
});
