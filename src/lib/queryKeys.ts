import type { QueryClient } from '@tanstack/react-query';

// Query key roots. Every list or detail key starts with one of these.
export const keys = {
  customers: ['customers'] as const,
  vehicles: ['vehicles'] as const,
  ledger: ['ledger'] as const,
  payments: ['payments'] as const,
  invoices: ['invoices'] as const,
  overview: ['overview'] as const,
};

export type Change =
  | 'customerSaved'
  | 'customerStatus'
  | 'vehicleCreated'
  | 'vehicleSaved'
  | 'parkingSaved'
  | 'paymentChanged'
  | 'monthlyChargesIssued'
  | 'oneTimeChargeIssued';

// What each change can affect on screen (UX_REBUILD.md section 9.1).
const AFFECTS: Record<Change, ReadonlyArray<readonly string[]>> = {
  customerSaved: [keys.customers, keys.overview, keys.vehicles],
  customerStatus: [keys.customers],
  vehicleCreated: [keys.vehicles, keys.ledger, keys.overview, keys.customers],
  vehicleSaved: [keys.vehicles],
  parkingSaved: [keys.vehicles, keys.ledger, keys.overview],
  paymentChanged: [keys.payments, keys.ledger, keys.customers, keys.overview],
  monthlyChargesIssued: [keys.ledger, keys.payments, keys.invoices, keys.customers, keys.overview],
  oneTimeChargeIssued: [keys.ledger, keys.invoices, keys.customers, keys.overview],
};

export async function refreshAfter(client: QueryClient, change: Change): Promise<void> {
  await Promise.all(AFFECTS[change].map((queryKey) => client.invalidateQueries({ queryKey })));
}
