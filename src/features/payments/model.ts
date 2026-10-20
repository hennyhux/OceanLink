import { z } from 'zod';
import { isBusinessDate } from '@/lib/dates';
import { usdToCents, type Money } from '@/lib/money';

export const PAYMENT_METHODS = [
  'cash',
  'check',
  'bank_transfer',
  'external_card',
  'other',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type PaymentStatus = 'received' | 'reversed';

export interface Payment {
  id: string;
  version: number;
  customer_id: string;
  customer_name: string;
  amount: Money;
  allocated_amount: Money;
  available_credit: Money;
  effective_on: string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  status: PaymentStatus;
  recorded_by: { id: string; name: string };
  created_at: string;
  reversal: { reason: string; actor: { id: string; name: string }; created_at: string } | null;
  audit_events: {
    action: 'recorded' | 'reversed' | 'allocated';
    actor_id: string;
    reason: string | null;
    created_at: string;
  }[];
}

export interface PaymentFilters {
  customer_id?: string;
  q?: string;
  from?: string;
  to?: string;
  method?: PaymentMethod;
  status?: PaymentStatus;
  page?: number;
  page_size?: number;
}

export const paymentWriteSchema = z
  .object({
    customer_id: z.string().min(1),
    amount: z.object({
      amount: z.number().int().positive().max(999999999),
      currency: z.literal('USD'),
    }),
    effective_on: z.string().refine(isBusinessDate),
    method: z.enum(PAYMENT_METHODS),
    reference: z.string().trim().max(200).nullable(),
    notes: z.string().trim().max(2000).nullable(),
  })
  .strict();
export type PaymentWrite = z.infer<typeof paymentWriteSchema>;

export function paymentFormSchema(today: string) {
  return z.object({
    customer_id: z.string().min(1, 'payments.customerRequired'),
    amount: z
      .string()
      .trim()
      .regex(/^\d{1,7}(\.\d{1,2})?$/, 'payments.invalidAmount')
      .refine(
        (value) => /^\d{1,7}(\.\d{1,2})?$/.test(value) && usdToCents(value) > 0,
        'payments.invalidAmount',
      ),
    effective_on: z
      .string()
      .refine(isBusinessDate, 'payments.invalidDate')
      .refine((value) => value <= today, 'payments.futureDate'),
    method: z.enum(PAYMENT_METHODS),
    reference: z.string().trim().max(200, 'payments.referenceLong'),
    notes: z.string().trim().max(2000, 'payments.notesLong'),
  });
}
export type PaymentFormValues = z.infer<ReturnType<typeof paymentFormSchema>>;
export function toPaymentWrite(values: PaymentFormValues): PaymentWrite {
  return {
    customer_id: values.customer_id,
    amount: { amount: usdToCents(values.amount), currency: 'USD' },
    effective_on: values.effective_on,
    method: values.method,
    reference: values.reference || null,
    notes: values.notes || null,
  };
}
