import { z } from 'zod';

import { blankToNull } from '@/lib/forms';

import type { Customer, CustomerWrite } from './types';

const optional = (max: number) => z.string().trim().max(max, 'form.tooLong');

export const customerFormSchema = z.object({
  type: z.enum(['business', 'individual']),
  display_name: z.string().trim().min(1, 'customers.errors.nameRequired').max(200, 'form.tooLong'),
  contact_name: optional(200),
  phone: optional(50),
  email: optional(254).refine(
    (value) => !value || z.string().email().safeParse(value).success,
    'customers.errors.emailInvalid',
  ),
  usdot_number: optional(8).refine(
    (value) => !value || /^\d{1,8}$/.test(value),
    'customers.errors.usdotDigits',
  ),
  address_line1: optional(200),
  address_line2: optional(200),
  city: optional(100),
  state: optional(50),
  postal_code: optional(20),
  notes: optional(2000),
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;

export const CUSTOMER_FIELDS = Object.keys(
  customerFormSchema.shape,
) as (keyof CustomerFormValues)[];

export function emptyCustomerForm(): CustomerFormValues {
  return {
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
  };
}

export function customerToForm(customer: Customer): CustomerFormValues {
  const value = (text: string | null) => text ?? '';
  return {
    type: customer.type,
    display_name: customer.display_name,
    contact_name: value(customer.contact_name),
    phone: value(customer.phone),
    email: value(customer.email),
    usdot_number: value(customer.usdot_number),
    address_line1: value(customer.address_line1),
    address_line2: value(customer.address_line2),
    city: value(customer.city),
    state: value(customer.state),
    postal_code: value(customer.postal_code),
    notes: value(customer.notes),
  };
}

export function formToWrite(values: CustomerFormValues): CustomerWrite {
  return {
    type: values.type,
    display_name: values.display_name.trim(),
    // Individuals have no separate contact person.
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
  };
}

// Only changed fields are sent, so the backend history stays meaningful.
export function changedFields(before: CustomerWrite, after: CustomerWrite): Partial<CustomerWrite> {
  const changes: Partial<Record<keyof CustomerWrite, unknown>> = {};
  for (const key of Object.keys(after) as (keyof CustomerWrite)[]) {
    if (before[key] !== after[key]) changes[key] = after[key];
  }
  return changes as Partial<CustomerWrite>;
}

export function formatAddress(customer: Customer): string {
  const cityLine = [
    [customer.city, customer.state].filter(Boolean).join(', '),
    customer.postal_code,
  ]
    .filter(Boolean)
    .join(' ');
  return [customer.address_line1, customer.address_line2, cityLine].filter(Boolean).join('\n');
}
