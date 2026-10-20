import { HttpResponse, http, type HttpHandler } from 'msw';

import type { Customer, CustomerWrite } from '@/features/customers/types';
import type { ApiErrorBody } from '@/lib/api/errors';
import type { Paged } from '@/lib/api/paging';

const BASE = '/api/v1';

function errorResponse(
  status: number,
  code: string,
  message: string,
  extra?: Partial<ApiErrorBody>,
) {
  const body: ApiErrorBody = { code, message, request_id: `mock-cust-${Date.now()}`, ...extra };
  return HttpResponse.json(body, { status });
}

function makeCustomer(
  partial: Partial<Customer> & Pick<Customer, 'id' | 'display_name'>,
): Customer {
  const now = '2026-09-01T12:00:00Z';
  return {
    version: 1,
    type: 'business',
    contact_name: null,
    phone: null,
    email: null,
    usdot_number: null,
    address_line1: null,
    address_line2: null,
    city: null,
    state: null,
    postal_code: null,
    notes: null,
    is_active: true,
    created_at: now,
    updated_at: now,
    billing_anchor_day: 1,
    payment_terms: '',
    ...partial,
  };
}

// Synthetic customers. Development only. Not real people or companies.
export function seedCustomers(): Customer[] {
  return [
    makeCustomer({
      id: 'c0000001-0000-4000-8000-000000000001',
      display_name: '远航货运有限公司',
      contact_name: '王建国',
      phone: '(555) 010-1001',
      email: 'dispatch@yuanhang.example',
      usdot_number: '1234567',
      address_line1: '100 Harbor Way',
      city: 'Oakland',
      state: 'CA',
      postal_code: '94607',
    }),
    makeCustomer({
      id: 'c0000001-0000-4000-8000-000000000002',
      display_name: 'Pacific Haul LLC',
      contact_name: 'Maria Lopez',
      phone: '(555) 010-1002',
      usdot_number: '2345678',
      city: 'Hayward',
      state: 'CA',
    }),
    makeCustomer({
      id: 'c0000001-0000-4000-8000-000000000003',
      type: 'individual',
      display_name: '李强',
      phone: '(555) 010-1003',
      notes: '只有一辆车，月底付款。',
    }),
    makeCustomer({
      id: 'c0000001-0000-4000-8000-000000000004',
      type: 'individual',
      display_name: 'Dmitri Volkov',
      phone: '(555) 010-1004',
      email: 'dmitri@example.com',
      usdot_number: '3456789',
    }),
    makeCustomer({
      id: 'c0000001-0000-4000-8000-000000000005',
      display_name: '金桥物流',
      contact_name: '陈美玲',
      phone: '(555) 010-1005',
      usdot_number: '4567890',
      is_active: false,
      notes: '2026 年 6 月停用。',
    }),
  ];
}

let customers: Customer[] = seedCustomers();
let nextId = 6;

export function resetMockCustomers(): void {
  customers = seedCustomers();
  nextId = 6;
}

// Lets the vehicle mocks fill in customer names without duplicating the customer store.
export function findMockCustomer(id: string): Customer | undefined {
  return customers.find((candidate) => candidate.id === id);
}

function normalizeDigits(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  return digits || null;
}

function matchesQuery(customer: Customer, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    customer.display_name,
    customer.contact_name,
    customer.phone,
    customer.email,
    customer.usdot_number,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());
  const digitNeedle = needle.replace(/\D/g, '');
  return haystack.some(
    (value) =>
      value.includes(needle) ||
      (digitNeedle.length >= 3 && value.replace(/\D/g, '').includes(digitNeedle)),
  );
}

export function listMockCustomers({
  q = '',
  includeInactive = false,
  page = 1,
  pageSize = 20,
}: {
  q?: string;
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
} = {}): Paged<Customer> {
  const filtered = customers
    .filter((customer) => includeInactive || customer.is_active)
    .filter((customer) => matchesQuery(customer, q))
    .sort((a, b) => a.display_name.localeCompare(b.display_name, 'zh-Hans-CN'));
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(100, Math.max(1, pageSize));
  const start = (safePage - 1) * safePageSize;
  return {
    items: filtered.slice(start, start + safePageSize),
    page: safePage,
    page_size: safePageSize,
    total: filtered.length,
  };
}

function validate(body: Partial<CustomerWrite>): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  if (
    body.billing_anchor_day !== undefined &&
    (!Number.isInteger(body.billing_anchor_day) ||
      body.billing_anchor_day < 1 ||
      body.billing_anchor_day > 31)
  )
    errors.billing_anchor_day = ['INVALID_ANCHOR'];
  if (
    body.payment_terms !== undefined &&
    (typeof body.payment_terms !== 'string' || body.payment_terms.length > 1000)
  )
    errors.payment_terms = ['INVALID_TERMS'];
  if ('display_name' in body && !body.display_name?.trim()) {
    errors.display_name = ['Name is required'];
  }
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    errors.email = ['Invalid email address'];
  }
  if (body.usdot_number) {
    if (!/^\d{1,8}$/.test(body.usdot_number)) {
      errors.usdot_number = ['USDOT number must be 1 to 8 digits'];
    }
  }
  return errors;
}

function usdotTaken(usdot: string | null | undefined, currentId?: string): boolean {
  if (!usdot) return false;
  return customers.some(
    (candidate) =>
      candidate.id !== currentId && candidate.is_active && candidate.usdot_number === usdot,
  );
}

function readIfMatch(request: Request): number | undefined {
  const raw = request.headers.get('if-match');
  if (!raw) return undefined;
  const parsed = Number(raw.replace(/"/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export const customerHandlers: HttpHandler[] = [
  http.get(`${BASE}/customers`, ({ request }) => {
    const url = new URL(request.url);
    return HttpResponse.json(
      listMockCustomers({
        q: url.searchParams.get('q') ?? '',
        includeInactive: url.searchParams.get('include_inactive') === 'true',
        page: Number(url.searchParams.get('page') ?? '1'),
        pageSize: Number(url.searchParams.get('page_size') ?? '20'),
      }),
    );
  }),

  http.get(`${BASE}/customers/:id`, ({ params }) => {
    const customer = customers.find((candidate) => candidate.id === params.id);
    if (!customer) return errorResponse(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
    return HttpResponse.json(customer);
  }),

  http.post(`${BASE}/customers`, async ({ request }) => {
    const body = (await request.json()) as Partial<CustomerWrite>;
    const errors = validate({ display_name: '', ...body });
    if (Object.keys(errors).length > 0) {
      return errorResponse(422, 'VALIDATION_FAILED', 'Some fields are invalid', {
        field_errors: errors,
      });
    }
    const usdot = normalizeDigits(body.usdot_number);
    if (usdotTaken(usdot)) {
      return errorResponse(409, 'USDOT_ALREADY_IN_USE', 'Another active customer has this USDOT', {
        field_errors: { usdot_number: ['USDOT_ALREADY_IN_USE'] },
      });
    }
    const now = new Date().toISOString();
    const created = makeCustomer({
      id: `c0000001-0000-4000-8000-${String(nextId).padStart(12, '0')}`,
      type: body.type ?? 'business',
      display_name: body.display_name!.trim(),
      contact_name: body.contact_name?.trim() || null,
      phone: body.phone?.trim() || null,
      email: body.email?.trim() || null,
      usdot_number: usdot,
      address_line1: body.address_line1?.trim() || null,
      address_line2: body.address_line2?.trim() || null,
      city: body.city?.trim() || null,
      state: body.state?.trim() || null,
      postal_code: body.postal_code?.trim() || null,
      notes: body.notes?.trim() || null,
      billing_anchor_day: body.billing_anchor_day ?? 1,
      payment_terms: body.payment_terms?.trim() ?? '',
      created_at: now,
      updated_at: now,
    });
    nextId += 1;
    customers = [...customers, created];
    return HttpResponse.json(created, { status: 201 });
  }),

  http.patch(`${BASE}/customers/:id`, async ({ params, request }) => {
    const index = customers.findIndex((candidate) => candidate.id === params.id);
    if (index === -1) return errorResponse(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
    const current = customers[index]!;

    const expected = readIfMatch(request);
    if (expected === undefined) {
      return errorResponse(428, 'IF_MATCH_REQUIRED', 'If-Match header is required');
    }
    if (expected !== current.version) {
      return errorResponse(412, 'STALE_VERSION', 'This record was changed by someone else');
    }

    const body = (await request.json()) as Partial<CustomerWrite> & { is_active?: boolean };
    const errors = validate(body);
    if (Object.keys(errors).length > 0) {
      return errorResponse(422, 'VALIDATION_FAILED', 'Some fields are invalid', {
        field_errors: errors,
      });
    }
    const usdot =
      'usdot_number' in body ? normalizeDigits(body.usdot_number) : current.usdot_number;
    if (usdotTaken(usdot, current.id)) {
      return errorResponse(409, 'USDOT_ALREADY_IN_USE', 'Another active customer has this USDOT', {
        field_errors: { usdot_number: ['USDOT_ALREADY_IN_USE'] },
      });
    }

    const { is_active, ...fields } = body;
    const updated: Customer = {
      ...current,
      ...Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [
          key,
          typeof value === 'string' ? value.trim() || null : value,
        ]),
      ),
      usdot_number: usdot,
      display_name: fields.display_name?.trim() || current.display_name,
      payment_terms: fields.payment_terms?.trim() ?? current.payment_terms ?? '',
      is_active: is_active ?? current.is_active,
      version: current.version + 1,
      updated_at: new Date().toISOString(),
    };
    customers = customers.map((candidate, i) => (i === index ? updated : candidate));
    return HttpResponse.json(updated);
  }),
];
