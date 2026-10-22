import { http, HttpResponse, type HttpHandler } from 'msw';
import { todayInTimeZone } from '@/lib/dates';
import { listMockCustomers } from './customerHandlers';
import { mockCustomerLedger, mockPayments } from './paymentStore';
import { mockVehicles } from './vehicleHandlers';

const STAFF_IDS = new Set([
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
]);
const money = (amount: number) => ({ amount, currency: 'USD' as const });

export const overviewHandlers: HttpHandler[] = [
  http.get('/api/v1/reports/summary', ({ cookies }) => {
    if (!STAFF_IDS.has(cookies.oceanlink_mock_session ?? ''))
      return HttpResponse.json({ code: 'SESSION_EXPIRED' }, { status: 401 });

    const today = todayInTimeZone('UTC');
    const monthStart = `${today.slice(0, 7)}-01`;
    const customers = listMockCustomers({ includeInactive: true, pageSize: 100 }).items;
    const ledgers = customers.map((customer) => mockCustomerLedger(customer.id));
    const paymentsThisMonth = mockPayments()
      .filter(
        (payment) =>
          payment.status === 'received' &&
          payment.effective_on >= monthStart &&
          payment.effective_on <= today,
      )
      .reduce((sum, payment) => sum + payment.amount.amount, 0);

    return HttpResponse.json({
      overdue_invoices: money(ledgers.reduce((sum, ledger) => sum + ledger.overdue.amount, 0)),
      outstanding_invoices: money(
        ledgers.reduce((sum, ledger) => sum + ledger.outstanding.amount, 0),
      ),
      unbilled_parking: money(
        ledgers.reduce((sum, ledger) => sum + (ledger.unbilled_parking?.amount ?? 0), 0),
      ),
      payments_received_this_month: money(paymentsThisMonth),
      total_customers: customers.length,
      total_trucks: mockVehicles().filter(
        (vehicle) =>
          (vehicle.vehicle_type === 'truck' || vehicle.vehicle_type === 'combination'),
      ).length,
    });
  }),
];