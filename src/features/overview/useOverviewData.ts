import { useCustomerList } from '@/features/customers/api';
import { usePayments } from '@/features/payments/api';
import { useVehicleList } from '@/features/vehicles/api';
import { useLot } from '@/hooks/useLot';
import { firstOfMonth, todayInTimeZone } from '@/lib/dates';

import { useOverviewMetrics } from './api';

// How many records the attention and activity cards look through. One lot is small, and the
// cards say so when there are more records than this.
export const SCAN_SIZE = 100;

// Every query the dashboard needs. Each card shows its own loading or error state, so one
// slow or failed request never hides the others.
export function useOverviewData() {
  const lot = useLot();
  const today = lot.data ? todayInTimeZone(lot.data.time_zone) : '';
  return {
    today,
    lot,
    summary: useOverviewMetrics(),
    overdueCustomers: useCustomerList({ overdue_only: true, page_size: SCAN_SIZE }),
    activeCustomers: useCustomerList({ page_size: 1 }),
    allCustomers: useCustomerList({ include_inactive: true, page_size: SCAN_SIZE }),
    vehicles: useVehicleList({ include_inactive: true, page_size: SCAN_SIZE }),
    recentPayments: usePayments({ page_size: 10 }),
    monthPayments: usePayments(
      {
        from: today ? firstOfMonth(today) : undefined,
        to: today || undefined,
        status: 'received',
        page_size: 1,
      },
      Boolean(today),
    ),
  };
}

export type OverviewData = ReturnType<typeof useOverviewData>;
