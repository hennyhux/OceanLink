import { HttpResponse, http, type HttpHandler } from 'msw';
import type { CustomerListItem } from '@/features/customers/types';
import type { Paged } from '@/lib/api/paging';
import { mockCustomerLedger } from './paymentStore';
import { listMockCustomers } from './customerHandlers';
import { mockVehicles } from './vehicleHandlers';

export const customerOverviewHandlers: HttpHandler[] = [
  http.get('/api/v1/customers', ({ request }) => {
    const url = new URL(request.url);
    const page = listMockCustomers({
      q: url.searchParams.get('q') ?? '',
      includeInactive: url.searchParams.get('include_inactive') === 'true',
      page: Number(url.searchParams.get('page') ?? '1'),
      pageSize: Number(url.searchParams.get('page_size') ?? '20'),
    });
    const vehicles = mockVehicles();
    const result: Paged<CustomerListItem> = {
      ...page,
      items: page.items.map((customer) => ({
        ...customer,
        net_balance: mockCustomerLedger(customer.id).net_balance,
        truck_count: vehicles.filter(
          (vehicle) =>
            vehicle.customer_id === customer.id &&
            vehicle.is_active &&
            (vehicle.vehicle_type === 'truck' || vehicle.vehicle_type === 'combination'),
        ).length,
      })),
    };
    return HttpResponse.json(result);
  }),
];
