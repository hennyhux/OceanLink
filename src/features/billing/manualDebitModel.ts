import { z } from 'zod';

import { isBusinessDate } from '@/lib/dates';
import { usdToCents, type Money } from '@/lib/money';

export const manualDebitFormSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, 'billing.manualDescriptionRequired')
    .max(200, 'billing.manualDescriptionLong'),
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,7}(\.\d{1,2})?$/, 'billing.manualAmountInvalid')
    .refine(
      (value) => /^\d{1,7}(\.\d{1,2})?$/.test(value) && usdToCents(value) > 0,
      'billing.manualAmountInvalid',
    ),
  due_on: z.string().refine(isBusinessDate, 'billing.manualDueDateRequired'),
});

export type ManualDebitFormValues = z.infer<typeof manualDebitFormSchema>;

export const manualDebitWriteSchema = z
  .object({
    customer_id: z.string().uuid(),
    due_on: z.string().refine(isBusinessDate),
    description: z.string().trim().min(1).max(200),
    amount: z
      .object({ amount: z.number().int().positive().max(999999999), currency: z.literal('USD') })
      .strict(),
  })
  .strict();

export type ManualDebitWrite = z.infer<typeof manualDebitWriteSchema>;

export interface ManualDebitInvoice {
  id: string;
  version: number;
  customer_id: string;
  invoice_number: string | null;
  issued_on: string | null;
  due_on: string;
  description: string | null;
  status: 'draft' | 'issued';
  total: Money;
}

export function manualDebitToWrite(
  customerId: string,
  values: ManualDebitFormValues,
): ManualDebitWrite {
  const parsed = manualDebitFormSchema.parse(values);
  return {
    customer_id: customerId,
    due_on: parsed.due_on,
    description: parsed.description,
    amount: { amount: usdToCents(parsed.amount), currency: 'USD' },
  };
}
