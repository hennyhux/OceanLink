import type { Money } from '@/lib/money';

// Customer shapes follow REQUIREMENTS.md section 10. The backend OpenAPI schema is the
// source of truth once it exists; field names here are the proposed wire names.

export type CustomerType = 'individual' | 'business';

export interface Customer {
  id: string;
  version: number;
  type: CustomerType;
  display_name: string;
  // Main contact person when the customer is a business.
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  // Digits only. Identifies the carrier, not a single truck.
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

export interface CustomerListItem extends Customer {
  net_balance: Money;
  overdue_balance: Money;
  truck_count: number;
}

export interface CustomerWrite {
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
}

export interface CustomerListParams {
  q?: string;
  // Omit to get active customers only.
  include_inactive?: boolean;
  // Restrict results to customers with a positive overdue invoice balance.
  overdue_only?: boolean;
  page?: number;
  page_size?: number;
}
