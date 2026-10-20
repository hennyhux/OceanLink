import { fireEvent, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { authApi } from '@/features/auth/api';
import { server } from '@/mocks/server';
import { createMockPayment, paymentRequests } from '@/mocks/paymentStore';
import { renderApp } from '@/test/renderApp';
import { paymentsApi } from './api';
import { paymentWriteSchema } from './model';

const customerId = 'c0000001-0000-4000-8000-000000000002';
const adminId = '11111111-1111-4111-8111-111111111111';
async function signIn(role = 'admin') {
  const session = await authApi.login({
    email: `${role}@example.com`,
    password: `${role}-password`,
  });
  server.use(http.get('/api/v1/auth/session', () => HttpResponse.json(session)));
}

describe('staff payment workflows', () => {
  it('uses concise receipt rows on narrow screens without a horizontally scrolling table', async () => {
    await signIn();
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
    createMockPayment(
      {
        customer_id: customerId,
        amount: { amount: 5000, currency: 'USD' },
        effective_on: '2026-10-20',
        method: 'cash',
        reference: 'MOBILE-REFERENCE',
        notes: '',
      },
      { id: adminId, name: 'Demo administrator', role: 'admin' },
    );
    renderApp({ route: '/payments' });
    await screen.findByText('$50.00');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const row = screen.getByText('$50.00').closest('li')!;
    expect(within(row).getByText('Cash', { exact: false })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'View receipt' })).toBeInTheDocument();
    expect(within(row).queryByText('MOBILE-REFERENCE')).not.toBeInTheDocument();
  });

  it('shows a scannable receipt table and keeps staff/reference details out of the list', async () => {
    await signIn();
    createMockPayment(
      {
        customer_id: customerId,
        amount: { amount: 80000, currency: 'USD' },
        effective_on: '2026-10-20',
        method: 'cash',
        reference: 'REFERENCE-IN-DETAILS',
        notes: 'Private receipt note',
      },
      { id: adminId, name: 'Demo administrator', role: 'admin' },
    );
    const user = userEvent.setup();
    renderApp({ route: '/payments' });
    const table = await screen.findByRole('table', { name: 'Payments received' });
    const row = within(table).getByText('$800.00').closest('tr')!;
    expect(within(row).getByText('Cash')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'View receipt' })).toBeInTheDocument();
    expect(within(row).queryByText(/Demo administrator/)).not.toBeInTheDocument();
    expect(within(row).queryByText('REFERENCE-IN-DETAILS')).not.toBeInTheDocument();
    await user.click(within(row).getByRole('button', { name: 'View receipt' }));
    const detail = await screen.findByRole('dialog', { name: 'Receipt details' });
    expect(await within(detail).findByText(/REFERENCE-IN-DETAILS/)).toBeInTheDocument();
  });

  it('keeps advanced filters collapsed until requested, applies them, and clears them', async () => {
    await signIn();
    const user = userEvent.setup();
    renderApp({ route: '/payments' });
    const filters = await screen.findByRole('button', { name: 'Filters' });
    expect(filters).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('combobox', { name: 'Payment method' })).not.toBeInTheDocument();
    await user.click(filters);
    expect(filters).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('combobox', { name: 'Payment method' }));
    await user.click(await screen.findByRole('option', { name: 'Cash' }));
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(await screen.findByRole('button', { name: 'Filters (1)' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByRole('button', { name: 'Filters' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('disables recording while offline', async () => {
    await signIn();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const user = userEvent.setup();
    renderApp({ route: `/customers/${customerId}` });
    await user.click(await screen.findByRole('button', { name: 'Record payment' }));
    const dialog = await screen.findByRole('dialog', { name: 'Record payment' });
    expect(await within(dialog).findByText(/You are offline/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Record payment' })).toBeDisabled();
  });

  it('prevents a second submission while the first receipt is pending', async () => {
    await signIn();
    let calls = 0;
    server.use(
      http.post('/api/v1/payments', async ({ request }) => {
        calls += 1;
        const body = paymentWriteSchema.parse(await request.json());
        const payment = createMockPayment(body, {
          id: adminId,
          name: 'Demo administrator',
          role: 'admin',
        });
        await delay(300);
        return HttpResponse.json(payment, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderApp({ route: `/customers/${customerId}` });
    await user.click(await screen.findByRole('button', { name: 'Record payment' }));
    const dialog = await screen.findByRole('dialog', { name: 'Record payment' });
    await user.type(within(dialog).getByLabelText(/Amount received/), '100');
    await user.click(within(dialog).getByRole('button', { name: 'Record payment' }));
    const pending = within(dialog).getByRole('button', { name: 'Saving…' });
    expect(pending).toBeDisabled();
    fireEvent.click(pending);
    await screen.findByText('Payment recorded.');
    expect(calls).toBe(1);
  });

  it('records a payment from the customer page and refreshes balance and last payment', async () => {
    await signIn();
    const user = userEvent.setup();
    renderApp({ route: `/customers/${customerId}` });
    await user.click(await screen.findByRole('button', { name: 'Record payment' }));
    const dialog = await screen.findByRole('dialog', { name: 'Record payment' });
    await user.type(within(dialog).getByLabelText(/Amount received/), '300.29');
    await user.type(within(dialog).getByLabelText(/Reference/), 'CASH-1');
    await user.click(within(dialog).getByRole('button', { name: 'Record payment' }));
    expect(await screen.findByText('Payment recorded.')).toBeInTheDocument();
    expect((await screen.findByText('Customer credit')).parentElement).toHaveTextContent('$300.29');
    expect(screen.getByText('Last payment received').parentElement).toHaveTextContent('Cash');
    expect((await paymentsApi.list({ customer_id: customerId })).total).toBe(1);
  });

  it('requires a customer and positive amount without losing entries', async () => {
    await signIn();
    const user = userEvent.setup();
    renderApp({ route: '/payments' });
    await user.click(await screen.findByRole('button', { name: 'Record payment' }));
    const dialog = await screen.findByRole('dialog', { name: 'Record payment' });
    await user.type(within(dialog).getByLabelText(/Amount received/), '0');
    await user.click(within(dialog).getByRole('button', { name: 'Record payment' }));
    expect(await screen.findByText('Please choose the customer who paid.')).toBeInTheDocument();
    expect(screen.getByText(/Enter an amount greater than zero/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Amount received/)).toHaveValue('0');
  });

  it('reconciles a committed receipt after a lost response without recording it twice', async () => {
    await signIn();
    server.use(
      http.post(
        '/api/v1/payments',
        async ({ request }) => {
          const body = paymentWriteSchema.parse(await request.json());
          const payment = createMockPayment(body, {
            id: adminId,
            name: 'Demo administrator',
            role: 'admin',
          });
          paymentRequests.set(`${adminId}:${request.headers.get('idempotency-key')}`, {
            fingerprint: JSON.stringify({ operation: 'record', body }),
            payment_id: payment.id,
            status: 201,
            recorded_at: Date.now(),
          });
          return HttpResponse.error();
        },
        { once: true },
      ),
    );
    const user = userEvent.setup();
    renderApp({ route: `/customers/${customerId}` });
    await user.click(await screen.findByRole('button', { name: 'Record payment' }));
    const dialog = await screen.findByRole('dialog', { name: 'Record payment' });
    await user.type(within(dialog).getByLabelText(/Amount received/), '300');
    await user.click(within(dialog).getByRole('button', { name: 'Record payment' }));
    expect(await screen.findByText(/The result is not confirmed yet/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Amount received/)).toHaveAttribute('readonly');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: 'Check result' }));
    expect(await screen.findByText('Payment recorded.')).toBeInTheDocument();
    expect((await paymentsApi.list({ customer_id: customerId })).total).toBe(1);
    expect((await screen.findByText('Customer credit')).parentElement).toHaveTextContent('$300.00');
  });

  it('shows receipt history and reverses an incorrect entry only after a reason', async () => {
    await signIn();
    const receipt = await paymentsApi.record(
      {
        customer_id: customerId,
        amount: { amount: 12500, currency: 'USD' },
        effective_on: '2026-10-01',
        method: 'check',
        reference: 'CHECK-TO-REVERSE',
        notes: 'Wrong amount entered',
      },
      crypto.randomUUID(),
    );
    const user = userEvent.setup();
    renderApp({ route: `/customers/${customerId}` });
    await user.click(await screen.findByRole('button', { name: 'View receipt' }));
    const dialog = await screen.findByRole('dialog', { name: 'Receipt details' });
    await user.click(
      await within(dialog).findByRole('button', { name: 'Reverse incorrect entry' }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Confirm reversal' }));
    expect(await screen.findByText('Enter a reason within 1,000 characters.')).toBeInTheDocument();
    await user.type(
      within(dialog).getByLabelText(/Reason for reversal/),
      'Amount was entered incorrectly',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Confirm reversal' }));
    expect(await screen.findByText(/The incorrect receipt was reversed/)).toBeInTheDocument();
    expect((await paymentsApi.get(receipt.id)).status).toBe('reversed');
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('No payments received yet.')).toBeInTheDocument();
  });

  it('hides reversal from operators and completes the receipt flow in Chinese', async () => {
    await signIn('operator');
    const user = userEvent.setup();
    renderApp({ route: `/customers/${customerId}`, language: 'zh-CN' });
    await user.click(await screen.findByRole('button', { name: '记录收款' }));
    const dialog = await screen.findByRole('dialog', { name: '记录收款' });
    await user.type(within(dialog).getByLabelText(/实际收到的金额/), '50');
    await user.click(within(dialog).getByRole('button', { name: '记录收款' }));
    await screen.findByText('收款已记录。');
    const history = screen.getAllByRole('button', { name: '查看收款详情' });
    await user.click(history[0]!);
    const detail = await screen.findByRole('dialog', { name: '收款详情' });
    await within(detail).findByText('操作记录');
    expect(
      within(detail).queryByRole('button', { name: '撤销错误的收款记录' }),
    ).not.toBeInTheDocument();
  });
});
