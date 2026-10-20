import { describe, expect, it } from 'vitest';
import { todayInTimeZone } from '@/lib/dates';
import { paymentFormSchema, toPaymentWrite } from './model';

const values = {
  customer_id: 'c1',
  amount: '300.29',
  effective_on: '2026-10-20',
  method: 'cash' as const,
  reference: '',
  notes: '',
};
const schema = paymentFormSchema('2026-10-20');
describe('recorded payment validation', () => {
  it('uses exact integer cents and null optional fields', () => {
    expect(toPaymentWrite(schema.parse(values))).toMatchObject({
      amount: { amount: 30029, currency: 'USD' },
      reference: null,
      notes: null,
    });
  });
  it.each(['0', '-1', '1.999', 'abc', '10000000'])('rejects invalid amount %s', (amount) => {
    expect(schema.safeParse({ ...values, amount }).success).toBe(false);
  });
  it('rejects invalid and future business dates and missing customers', () => {
    expect(schema.safeParse({ ...values, effective_on: '2026-02-30' }).success).toBe(false);
    expect(schema.safeParse({ ...values, effective_on: '2026-10-21' }).success).toBe(false);
    expect(schema.safeParse({ ...values, customer_id: '' }).success).toBe(false);
  });
  it('defaults receipt dates using the configured lot time zone', () => {
    expect(todayInTimeZone('America/Los_Angeles', new Date('2026-10-21T01:00:00Z'))).toBe(
      '2026-10-20',
    );
  });
});
