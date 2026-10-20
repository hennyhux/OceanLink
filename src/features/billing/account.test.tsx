import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/renderApp';
import { signedIn } from '@/test/signedIn';
import { server } from '@/mocks/server';

describe('customer invoice and payment summary', () => {
  it('shows debt and the latest payment without depending on vehicle rates', async () => {
    signedIn();
    renderApp({ route: '/customers/c0000001-0000-4000-8000-000000000001' });
    const owed = await screen.findByText('Outstanding balance');
    expect(owed.parentElement).toHaveTextContent('$150.00');
    expect(screen.getByText('Last payment received').parentElement).toHaveTextContent('$300.00');
    expect(screen.getByText('Last payment received').parentElement).toHaveTextContent(
      'Bank transfer',
    );
    expect(screen.getByText('Active trucks').parentElement).toHaveTextContent('2');
  });
  it('shows no payment explicitly in Chinese', async () => {
    signedIn();
    renderApp({ route: '/customers/c0000001-0000-4000-8000-000000000002', language: 'zh-CN' });
    expect(await screen.findByText('还没有收款记录。')).toBeInTheDocument();
  });
  it('does not turn a failed account load into a zero balance', async () => {
    signedIn();
    server.use(
      http.get('/api/v1/customers/:id/ledger', () => HttpResponse.json({}, { status: 403 })),
    );
    renderApp({ route: '/customers/c0000001-0000-4000-8000-000000000001' });
    expect(await screen.findByText(/No zero balance has been assumed/)).toBeInTheDocument();
    expect(screen.queryByText('Outstanding balance')).not.toBeInTheDocument();
  });
  it('shows customer credit rather than a negative amount owed', async () => {
    signedIn();
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
  });
});
