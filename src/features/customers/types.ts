import type { Money } from '@/lib/money';

export type CustomerType = 'individual' | 'business';

export interface Customer {
  id: string;
  version: number;
  type: CustomerType;
  display_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  usdot_number: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// List rows carry balances calculated by the backend for the whole page.
export interface CustomerListItem extends Customer {
  net_balance: Money;
  overdue_balance: Money;
  truck_count: number;
}

export type CustomerWrite = Pick<
  Customer,
  | 'type'
  | 'display_name'
  | 'contact_name'
  | 'phone'
  | 'email'
  | 'usdot_number'
  | 'address_line1'
  | 'address_line2'
  | 'city'
  | 'state'
  | 'postal_code'
  | 'notes'
>;

export interface CustomerListParams {
  q?: string;
  include_inactive?: boolean;
  overdue_only?: boolean;
  page?: number;
  page_size?: number;
}
