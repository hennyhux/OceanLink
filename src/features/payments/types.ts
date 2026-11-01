import type { Money } from '@/lib/money';

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

export interface PaymentWrite {
  customer_id: string;
  amount: Money;
  effective_on: string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
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
