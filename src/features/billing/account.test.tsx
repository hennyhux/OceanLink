import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/renderApp';
import { signedIn } from '@/test/signedIn';
import { server } from '@/mocks/server';
import { theme } from '@/app/theme';

function signedInWithoutManualInvoices() {
  signedIn();
  server.use(
    http.get('/api/v1/invoices', () =>
      HttpResponse.json({ items: [], page: 1, page_size: 100, total: 0 }),
    ),
  );
}

describe('customer invoice and payment summary', () => {
  it('shows debt and the latest payment without depending on vehicle rates', async () => {
    signedInWithoutManualInvoices();
    renderApp({ route: '/customers/c0000001-0000-4000-8000-000000000001' });
    const owed = await screen.findByText('Outstanding balance');
    expect(owed.parentElement).toHaveTextContent('$150.00');
    expect(screen.getByText('Last payment received').parentElement).toHaveTextContent('$300.00');
    expect(screen.getByText('Last payment received').parentElement).toHaveTextContent(
      'Bank transfer',
    );
    expect(screen.queryByText('Active trucks')).not.toBeInTheDocument();
    expect(await screen.findByText('Active vehicles: 3')).toBeInTheDocument();
    expect(owed.nextElementSibling).toHaveStyle({ color: theme.palette.error.main });
    expect(screen.getByText('Overdue: $50.00')).toHaveStyle({
      color: theme.palette.error.main,
    });
    await userEvent.click(screen.getByRole('button', { name: 'Balance details' }));
    const overdue = screen.getByText('Overdue invoices').parentElement!;
    expect(within(overdue).getByText('$50.00')).toHaveStyle({
      color: theme.palette.error.main,
    });
  });
  it('shows no payment explicitly in Chinese', async () => {
    signedInWithoutManualInvoices();
    renderApp({ route: '/customers/c0000001-0000-4000-8000-000000000002', language: 'zh-CN' });
    expect(await screen.findByText('还没有收款记录。')).toBeInTheDocument();
  });
  it('does not turn a failed account load into a zero balance', async () => {
    signedInWithoutManualInvoices();
    server.use(
      http.get('/api/v1/customers/:id/ledger', () => HttpResponse.json({}, { status: 403 })),
    );
    renderApp({ route: '/customers/c0000001-0000-4000-8000-000000000001' });
    expect(await screen.findByText(/No zero balance has been assumed/)).toBeInTheDocument();
    expect(screen.queryByText('Outstanding balance')).not.toBeInTheDocument();
  });
  it('shows customer credit rather than a negative amount owed', async () => {
    signedInWithoutManualInvoices();
    const money = (amount: number) => ({ amount, currency: 'USD' });
    server.use(
      http.get('/api/v1/customers/:id/ledger', () =>
        HttpResponse.json({
          as_of: '2026-10-20T00:00:00Z',
          outstanding: money(0),
          overdue: money(0),
          unapplied_credit: money(5000),
          net_balance: money(-5000),
          last_payment: null,
        }),
      ),
    );
    renderApp({ route: '/customers/c0000001-0000-4000-8000-000000000001' });
    expect((await screen.findByText('Customer credit')).parentElement).toHaveTextContent('$50.00');
    expect(screen.getByText('Customer credit').nextElementSibling).toHaveStyle({
      color: theme.palette.text.primary,
    });
  });

  it('uses the full active vehicle total rather than counting the loaded page', async () => {
    signedInWithoutManualInvoices();
    server.use(
      http.get('/api/v1/vehicles', () =>
        HttpResponse.json({ items: [], page: 1, page_size: 100, total: 125 }),
      ),
    );
    renderApp({ route: '/customers/c0000001-0000-4000-8000-000000000001' });
    expect(await screen.findByText('Active vehicles: 125')).toBeInTheDocument();
  });

  it.each([0, 15000])(
    'colors an outstanding balance of %s correctly even without overdue invoices',
    async (amount) => {
      signedInWithoutManualInvoices();
      const money = (value: number) => ({ amount: value, currency: 'USD' });
      server.use(
        http.get('/api/v1/customers/:id/ledger', () =>
          HttpResponse.json({
            as_of: '2026-10-20T00:00:00Z',
            outstanding: money(amount),
            overdue: money(0),
            unapplied_credit: money(0),
            net_balance: money(amount),
            last_payment: null,
          }),
        ),
      );
      renderApp({ route: '/customers/c0000001-0000-4000-8000-000000000001' });
      const label = await screen.findByText('Outstanding balance');
      expect(label.nextElementSibling).toHaveStyle({
        color: amount > 0 ? theme.palette.error.main : theme.palette.text.primary,
      });
    },
  );
});
