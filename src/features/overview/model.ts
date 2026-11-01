import type { Customer, CustomerListItem } from '@/features/customers/types';
import type { Payment } from '@/features/payments/types';
import type { Vehicle } from '@/features/vehicles/types';
import { addDays } from '@/lib/dates';

// Plain rules behind the dashboard cards, kept apart from the screen so they are easy to test.

export function hasParkingOn(vehicle: Vehicle, day: string): boolean {
  const parking = vehicle.parking;
  return Boolean(
    vehicle.is_active &&
    parking &&
    parking.starts_on <= day &&
    (!parking.ends_on || parking.ends_on > day),
  );
}

// Monthly parking whose last day falls within the next `days` days. Ends are exclusive.
export function parkingEndingSoon(vehicles: Vehicle[], today: string, days = 30): Vehicle[] {
  const limit = addDays(today, days);
  return vehicles.filter(
    (vehicle) =>
      vehicle.is_active &&
      vehicle.parking?.ends_on &&
      vehicle.parking.ends_on > today &&
      vehicle.parking.ends_on <= limit,
  );
}

export function withoutParking(vehicles: Vehicle[]): Vehicle[] {
  return vehicles.filter((vehicle) => vehicle.is_active && !vehicle.parking);
}

export function missingContact(customers: Customer[]): Customer[] {
  return customers.filter((customer) => customer.is_active && !customer.phone && !customer.email);
}

// Customers who owe the most past-due money first, so the card leads with the biggest problem.
export function topOverdue<T extends Pick<CustomerListItem, 'overdue_balance'>>(
  customers: T[],
  limit = 3,
): T[] {
  return [...customers]
    .sort((a, b) => b.overdue_balance.amount - a.overdue_balance.amount)
    .slice(0, limit);
}

// The part of the outstanding balance that is not late yet. Never negative.
export function notYetDue(outstandingCents: number, overdueCents: number): number {
  return Math.max(0, outstandingCents - overdueCents);
}

// True when a list came back with fewer rows than exist, so counts built from it are a floor.
export function isTruncated(page: { total: number; items: unknown[] } | undefined): boolean {
  return page !== undefined && page.total > page.items.length;
}

export type ActivityKind = 'payment' | 'reversal' | 'vehicle' | 'customerAdded' | 'customerUpdated';

export interface ActivityEntry {
  key: string;
  kind: ActivityKind;
  at: string;
  to: string;
  name: string;
  cents?: number;
  vehicle?: Vehicle;
}

// The latest things that happened, built from the records themselves (there is no activity API yet).
export function recentActivity(
  customers: Customer[],
  vehicles: Vehicle[],
  payments: Payment[],
  limit = 5,
): ActivityEntry[] {
  // Stryker disable next-line ArrayDeclaration: a seeded bogus entry has no time and is filtered out below.
  const entries: ActivityEntry[] = [];
  for (const payment of payments) {
    const to = `/customers/${payment.customer_id}?tab=transactions`;
    entries.push({
      key: `payment-${payment.id}`,
      kind: 'payment',
      at: payment.created_at,
      to,
      name: payment.customer_name,
      cents: payment.amount.amount,
    });
    if (payment.reversal) {
      entries.push({
        key: `reversal-${payment.id}`,
        kind: 'reversal',
        at: payment.reversal.created_at,
        to,
        name: payment.customer_name,
        cents: payment.amount.amount,
      });
    }
  }
  for (const vehicle of vehicles) {
    entries.push({
      key: `vehicle-${vehicle.id}`,
      kind: 'vehicle',
      at: vehicle.created_at,
      to: `/vehicles/${vehicle.id}`,
      name: vehicle.customer_name,
      vehicle,
    });
  }
  for (const customer of customers) {
    const to = `/customers/${customer.id}`;
    entries.push({
      key: `added-${customer.id}`,
      kind: 'customerAdded',
      at: customer.created_at,
      to,
      name: customer.display_name,
    });
    if (customer.updated_at > customer.created_at) {
      entries.push({
        key: `updated-${customer.id}`,
        kind: 'customerUpdated',
        at: customer.updated_at,
        to,
        name: customer.display_name,
      });
    }
  }
  return entries
    .filter((entry) => !Number.isNaN(Date.parse(entry.at)))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || a.key.localeCompare(b.key))
    .slice(0, limit);
}

// Today shows a time, this year shows a month and day, older shows the full date.
export function formatWhen(instant: string, language: string, now = new Date()): string {
  const value = new Date(instant);
  if (value.toDateString() === now.toDateString()) {
    return new Intl.DateTimeFormat(language, { timeStyle: 'short' }).format(value);
  }
  if (value.getFullYear() === now.getFullYear()) {
    return new Intl.DateTimeFormat(language, { month: 'short', day: 'numeric' }).format(value);
  }
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(value);
}
