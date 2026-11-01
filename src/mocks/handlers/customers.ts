import { HttpResponse, http } from 'msw';

import type { Customer, CustomerListItem, CustomerWrite } from '@/features/customers/types';

import { countsAsTruck, db, findCustomer, ledger } from '../db';
import { BASE, checkVersion, clean, fail, fieldError, guard, isTrue, paged } from './util';

const WRITE_FIELDS: ReadonlyArray<keyof CustomerWrite> = [
  'type',
  'display_name',
  'contact_name',
  'phone',
  'email',
  'usdot_number',
  'address_line1',
  'address_line2',
  'city',
  'state',
  'postal_code',
  'notes',
];

function matches(customer: Customer, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const values = [
    customer.display_name,
    customer.contact_name,
    customer.phone,
    customer.email,
    customer.usdot_number,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());
  const digits = needle.replace(/\D/g, '');
  return values.some(
    (value) =>
      value.includes(needle) || (digits.length >= 3 && value.replace(/\D/g, '').includes(digits)),
  );
}

function listItem(customer: Customer): CustomerListItem {
  const account = ledger(customer.id);
  return {
    ...customer,
    net_balance: account.net_balance,
    overdue_balance: account.overdue,
    truck_count: db.vehicles.filter(
      (item) => item.customer_id === customer.id && item.is_active && countsAsTruck(item),
    ).length,
  };
}

// Returns the cleaned write fields, or an error response.
function validate(
  body: Record<string, unknown>,
  current: Customer | undefined,
): Partial<CustomerWrite> | Response {
  const unknown = Object.keys(body).filter(
    (key) => !(WRITE_FIELDS as string[]).includes(key) && !(current && key === 'is_active'),
  );
  if (unknown.length) return fieldError(422, 'VALIDATION_FAILED', unknown[0]!, 'NOT_ALLOWED');

  const fields: Partial<CustomerWrite> = {};
  for (const key of WRITE_FIELDS) {
    if (!(key in body)) continue;
    if (key === 'type') {
      if (body.type !== 'individual' && body.type !== 'business') {
        return fieldError(422, 'VALIDATION_FAILED', 'type', 'REQUIRED');
      }
      fields.type = body.type;
    } else {
      fields[key] = clean(body[key]) as never;
    }
  }
  const merged = { ...current, ...fields };
  if (!merged.display_name) return fieldError(422, 'VALIDATION_FAILED', 'display_name', 'REQUIRED');
  if (merged.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(merged.email)) {
    return fieldError(422, 'VALIDATION_FAILED', 'email', 'INVALID_EMAIL');
  }
  if (merged.usdot_number && !/^\d{1,8}$/.test(merged.usdot_number)) {
    return fieldError(422, 'VALIDATION_FAILED', 'usdot_number', 'INVALID_USDOT');
  }
  return fields;
}

function usdotTaken(usdot: string | null | undefined, exceptId?: string): boolean {
  return Boolean(
    usdot &&
    db.customers.some(
      (customer) =>
        customer.is_active && customer.id !== exceptId && customer.usdot_number === usdot,
    ),
  );
}

export const customerHandlers = [
  http.get(`${BASE}/customers`, ({ request, cookies }) => {
    const result = guard(request, cookies);
    if ('response' in result) return result.response;
    const url = new URL(request.url);
    const q = url.searchParams.get('q') ?? '';
    const items = db.customers
      .filter((customer) => isTrue(url, 'include_inactive') || customer.is_active)
      .filter((customer) => matches(customer, q))
      .sort(
        (a, b) => a.display_name.localeCompare(b.display_name, 'zh-CN') || a.id.localeCompare(b.id),
      )
      .map(listItem)
      .filter((item) => !isTrue(url, 'overdue_only') || item.overdue_balance.amount > 0);
    return HttpResponse.json(paged(items, url));
  }),

  http.post(`${BASE}/customers`, async ({ request, cookies }) => {
    const result = guard(request, cookies, { write: true });
    if ('response' in result) return result.response;
    const body = (await request.json()) as Record<string, unknown>;
    if ('is_active' in body)
      return fieldError(422, 'VALIDATION_FAILED', 'is_active', 'NOT_ALLOWED');
    const fields = validate(body, undefined);
    if (fields instanceof Response) return fields;
    if (usdotTaken(fields.usdot_number)) {
      return fieldError(409, 'USDOT_ALREADY_IN_USE', 'usdot_number');
    }
    const now = new Date().toISOString();
    const customer: Customer = {
      id: crypto.randomUUID(),
      version: 1,
      type: fields.type ?? 'business',
      display_name: fields.display_name ?? '',
      contact_name: fields.contact_name ?? null,
      phone: fields.phone ?? null,
      email: fields.email ?? null,
      usdot_number: fields.usdot_number ?? null,
      address_line1: fields.address_line1 ?? null,
      address_line2: fields.address_line2 ?? null,
      city: fields.city ?? null,
      state: fields.state ?? null,
      postal_code: fields.postal_code ?? null,
      notes: fields.notes ?? null,
      is_active: true,
      created_at: now,
      updated_at: now,
    };
    db.customers.push(customer);
    return HttpResponse.json(customer, { status: 201 });
  }),

  http.get(`${BASE}/customers/:id`, ({ request, cookies, params }) => {
    const result = guard(request, cookies);
    if ('response' in result) return result.response;
    const customer = findCustomer(String(params.id));
    return customer ? HttpResponse.json(customer) : fail(404, 'CUSTOMER_NOT_FOUND');
  }),

  http.patch(`${BASE}/customers/:id`, async ({ request, cookies, params }) => {
    const result = guard(request, cookies, { write: true });
    if ('response' in result) return result.response;
    const customer = findCustomer(String(params.id));
    if (!customer) return fail(404, 'CUSTOMER_NOT_FOUND');
    const stale = checkVersion(request, customer.version);
    if (stale) return stale;
    const body = (await request.json()) as Record<string, unknown>;
    const fields = validate(body, customer);
    if (fields instanceof Response) return fields;
    const isActive = typeof body.is_active === 'boolean' ? body.is_active : customer.is_active;
    const usdot = 'usdot_number' in fields ? fields.usdot_number : customer.usdot_number;
    if (isActive && usdotTaken(usdot, customer.id)) {
      return fieldError(409, 'USDOT_ALREADY_IN_USE', 'usdot_number');
    }
    Object.assign(customer, fields, {
      is_active: isActive,
      version: customer.version + 1,
      updated_at: new Date().toISOString(),
    });
    return HttpResponse.json(customer);
  }),

  http.get(`${BASE}/customers/:id/ledger`, ({ request, cookies, params }) => {
    const result = guard(request, cookies);
    if ('response' in result) return result.response;
    const customer = findCustomer(String(params.id));
    return customer ? HttpResponse.json(ledger(customer.id)) : fail(404, 'CUSTOMER_NOT_FOUND');
  }),
];
