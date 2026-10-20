import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/renderApp';
import { authApi } from '@/features/auth/api';
import { vehiclesApi } from '@/features/vehicles/api';
import { paymentsApi } from '@/features/payments/api';
import { todayInTimeZone } from '@/lib/dates';
import { server } from '@/mocks/server';
import { billingReplay, issueBilling, billingRun } from '@/mocks/billingStore';
import { mockCustomerLedger, applyMockCredit } from '@/mocks/paymentStore';
import { billingApi } from './api';

const customerId = 'c0000001-0000-4000-8000-000000000004';
const today = todayInTimeZone('UTC');
async function setup() {
  const session = await authApi.login({ email: 'admin@example.com', password: 'admin-password' });
  server.use(http.get('/api/v1/auth/session', () => HttpResponse.json(session)));
  for (const [index, amount] of [20000, 25000].entries()) {
    const vehicle = await vehiclesApi.create({
      customer_id: customerId,
      vehicle_type: 'truck',
      unit_number: `truck-${index + 1}`,
      usdot_number: '3456789',
      plate_number: null,
      plate_jurisdiction: null,
    });
    const starts_on = `${today.slice(0, 7)}-01`;
    await vehiclesApi.saveParking(vehicle.id, vehicle.version, {
      pool_id: 'mock-standard',
      starts_on,
      ends_on: null,
      monthly_rate: { amount, currency: 'USD' },
      effective_on: starts_on,
      reason: 'Monthly setup',
    });
  }
}

describe('customer monthly billing workflow', () => {
  it('reviews two truck charges, applies credit, and updates the visible amount due', async () => {
    await setup();
    await paymentsApi.record(
      {
        customer_id: customerId,
        amount: { amount: 42000, currency: 'USD' },
        effective_on: today,
        method: 'cash',
        reference: null,
        notes: null,
      },
      crypto.randomUUID(),
    );
    const user = userEvent.setup();
    renderApp({ route: `/customers/${customerId}` });
    expect((await screen.findByText('Customer credit')).parentElement).toHaveTextContent('$420.00');
    expect(screen.getByText(/Not billed yet/)).toHaveTextContent('$450.00');
    await user.click(screen.getByRole('button', { name: 'Review monthly charges' }));
    const dialog = await screen.findByRole('dialog', { name: 'Review monthly charges' });
    expect(await within(dialog).findByText('Unit truck-1')).toBeInTheDocument();
    expect(within(dialog).getByText('Unit truck-2')).toBeInTheDocument();
    expect(
      within(dialog).getByRole('checkbox', {
        name: 'Apply $420.00 of existing credit to these charges',
      }),
    ).toBeChecked();
    await user.click(within(dialog).getByRole('button', { name: 'Issue charges' }));
    await within(dialog).findByText(/Monthly charges issued. Outstanding balance updated/);
    expect(dialog).not.toHaveTextContent(/OL-\d+/);
    expect(screen.getByText('Outstanding balance').parentElement).toHaveTextContent('$30.00');
    expect(screen.queryByText(/Not billed yet/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Review monthly charges' }));
    const again = await screen.findByRole('dialog', { name: 'Review monthly charges' });
    expect(
      await within(again).findByText('No unbilled parking periods through this date.'),
    ).toBeInTheDocument();
    expect(within(again).getByRole('button', { name: 'Issue charges' })).toBeDisabled();
  });

  it('reconciles a lost issuance response with the same idempotency key', async () => {
    await setup();
    let usedKey = '';
    let usedRunId = '';
    server.use(
      http.post(
        '/api/v1/billing-runs/:id/issue',
        async ({ request, params, cookies }) => {
          usedKey = request.headers.get('idempotency-key')!;
          const body = (await request.json()) as { apply_credit: boolean };
          const runId = String(params.id);
          usedRunId = runId;
          const actor = cookies.oceanlink_mock_session!;
          const run = billingRun(runId)!;
          const ledger = mockCustomerLedger(run.customer_id);
          const result = issueBilling(
            runId,
            `${actor}:${usedKey}`,
            body.apply_credit,
            ledger.unapplied_credit.amount,
            ledger.outstanding.amount,
          );
          if (body.apply_credit)
            applyMockCredit(run.customer_id, result.invoices, {
              id: actor,
              name: 'Demo administrator',
              role: 'admin',
            });
          return HttpResponse.error();
        },
        { once: true },
      ),
    );
    const user = userEvent.setup();
    renderApp({ route: `/customers/${customerId}` });
    await user.click(await screen.findByRole('button', { name: 'Review monthly charges' }));
    const dialog = await screen.findByRole('dialog', { name: 'Review monthly charges' });
    await within(dialog).findByText('Unit truck-1');
    await user.click(within(dialog).getByRole('button', { name: 'Issue charges' }));
    await within(dialog).findByText(/The result is not confirmed/);
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: 'Check result' }));
    await within(dialog).findByText(/Monthly charges issued/);
    expect(dialog).not.toHaveTextContent(/OL-\d+/);
    expect(screen.getByText('Outstanding balance').parentElement).toHaveTextContent('$450.00');
    const preview = await billingApi.preview(customerId, today);
    expect(preview.lines).toHaveLength(0);
    expect(usedKey).not.toBe('');
    expect(
      billingReplay(`11111111-1111-4111-8111-111111111111:${usedKey}`, usedRunId, true)?.status,
    ).toBe('issued');
  });

  it('keeps extra balance details collapsed and supports the Chinese summary', async () => {
    await setup();
    const user = userEvent.setup();
    renderApp({ route: `/customers/${customerId}`, language: 'zh-CN' });
    const details = await screen.findByRole('button', { name: '查看余额明细' });
    expect(details).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText(/尚未开账单/)).toHaveTextContent('US$450.00');
    await user.click(details);
    expect(details).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: '核对月租费用' })).toBeInTheDocument();
  });
});
