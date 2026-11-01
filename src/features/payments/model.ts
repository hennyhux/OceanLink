import { z } from 'zod';

import { isBusinessDate } from '@/lib/dates';
import { blankToNull } from '@/lib/forms';
import { USD_INPUT, usdToCents } from '@/lib/money';

import { PAYMENT_METHODS, type PaymentWrite } from './types';

// Schemas are built inside functions so their rules run inside tests (and mutation testing sees them).
const positiveUsd = () =>
  z
    .string()
    .trim()
    .refine((value) => USD_INPUT.test(value) && usdToCents(value) > 0, 'money.positive');

export function paymentFormSchema(today: string) {
  return z.object({
    customer_id: z.string().min(1, 'payments.errors.customerRequired'),
    amount: positiveUsd(),
    effective_on: z
      .string()
      .refine(isBusinessDate, 'payments.errors.dateRequired')
      .refine((value) => !today || value <= today, 'payments.errors.futureDate'),
    method: z.enum(PAYMENT_METHODS),
    reference: z.string().trim().max(200, 'form.tooLong'),
    notes: z.string().trim().max(2000, 'form.tooLong'),
  });
}
export type PaymentFormValues = z.infer<ReturnType<typeof paymentFormSchema>>;

export function toPaymentWrite(values: PaymentFormValues): PaymentWrite {
  return {
    customer_id: values.customer_id,
    amount: { amount: usdToCents(values.amount), currency: 'USD' },
    effective_on: values.effective_on,
    method: values.method,
    reference: blankToNull(values.reference),
    notes: blankToNull(values.notes),
  };
}

export function reasonSchema() {
  return z.object({
    reason: z.string().trim().min(1, 'payments.errors.reasonRequired').max(1000, 'form.tooLong'),
  });
}
