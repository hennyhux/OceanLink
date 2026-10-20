import { z } from 'zod';

import type { Customer, CustomerWrite } from './types';

const optionalText = (max: number) =>
  z.string().trim().max(max, 'customers.errors.tooLong').optional().or(z.literal(''));

export const customerFormSchema = z.object({
  type: z.enum(['business', 'individual']),
  display_name: z
    .string()
    .trim()
    .min(1, 'customers.errors.nameRequired')
    .max(200, 'customers.errors.tooLong'),
  contact_name: optionalText(200),
  phone: optionalText(40),
  email: z
    .string()
    .trim()
    .max(254, 'customers.errors.tooLong')
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || z.string().email().safeParse(v).success, 'customers.errors.emailInvalid'),
  usdot_number: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || /^\d{1,8}$/.test(v), 'customers.errors.usdotDigits'),
  address_line1: optionalText(200),
  address_line2: optionalText(200),
  city: optionalText(100),
  state: optionalText(50),
  postal_code: optionalText(20),
  notes: optionalText(2000),
  billing_anchor_day: z.string().regex(/^([1-9]|[12]\d|3[01])$/, 'parking.invalidAnchor'),
  payment_terms: optionalText(1000),
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;

export const emptyCustomerForm: CustomerFormValues = {
  type: 'business',
  display_name: '',
  contact_name: '',
  phone: '',
  email: '',
  usdot_number: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  postal_code: '',
  notes: '',
  billing_anchor_day: '1',
  payment_terms: '',
};

export function customerToForm(customer: Customer): CustomerFormValues {
  return {
    type: customer.type,
    display_name: customer.display_name,
    contact_name: customer.contact_name ?? '',
    phone: customer.phone ?? '',
    email: customer.email ?? '',
    usdot_number: customer.usdot_number ?? '',
    address_line1: customer.address_line1 ?? '',
    address_line2: customer.address_line2 ?? '',
    city: customer.city ?? '',
    state: customer.state ?? '',
    postal_code: customer.postal_code ?? '',
    notes: customer.notes ?? '',
    billing_anchor_day: String(customer.billing_anchor_day ?? 1),
    payment_terms: customer.payment_terms ?? '',
  };
}

const blankToNull = (value: string | undefined): string | null => {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
};

export function formToWrite(values: CustomerFormValues): CustomerWrite {
  return {
    type: values.type,
    display_name: values.display_name.trim(),
    contact_name: values.type === 'business' ? blankToNull(values.contact_name) : null,
    phone: blankToNull(values.phone),
    email: blankToNull(values.email),
    usdot_number: blankToNull(values.usdot_number),
    address_line1: blankToNull(values.address_line1),
    address_line2: blankToNull(values.address_line2),
    city: blankToNull(values.city),
    state: blankToNull(values.state),
    postal_code: blankToNull(values.postal_code),
    notes: blankToNull(values.notes),
    billing_anchor_day: Number(values.billing_anchor_day),
    payment_terms: values.payment_terms?.trim() ?? '',
  };
}

// Only send what changed so the backend audit log stays meaningful.
export function diffWrite(before: CustomerWrite, after: CustomerWrite): Partial<CustomerWrite> {
  const changes: Partial<CustomerWrite> = {};
  for (const key of Object.keys(after) as (keyof CustomerWrite)[]) {
    if (before[key] !== after[key]) {
      (changes as Record<string, unknown>)[key] = after[key];
    }
  }
  return changes;
}
