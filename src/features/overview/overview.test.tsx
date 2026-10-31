import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { authApi } from '@/features/auth/api';
import { server } from '@/mocks/server';
import { renderApp } from '@/test/renderApp';
import { theme } from '@/app/theme';

async function signIn() {
  const session = await authApi.login({ email: 'admin@example.com', password: 'admin-password' });
  server.use(http.get('/api/v1/auth/session', () => HttpResponse.json(session)));
}

describe('overview KPIs', () => {
  it('shows six dashboard KPIs from the current ledger and records', async () => {
    await signIn();
    renderApp({ route: '/', language: 'en' });

    expect(await screen.findByText('Customers owe in total')).toBeInTheDocument();
    expect(screen.getByText('Customers owe in total').parentElement).toHaveTextContent('$150.00');
    expect(screen.getByText('Customers owe in total').nextElementSibling).toHaveStyle({
      color: theme.palette.error.main,
    });
    const pastDue = screen.getByRole('link', { name: 'Past due — follow up' });
    expect(pastDue).toHaveAttribute('href', '/customers?overdue=1');
    expect(pastDue.parentElement).toHaveTextContent('$50.00');
    expect(screen.getByText('Not due yet').parentElement).toHaveTextContent('$100.00');
    expect(screen.getByText('Unbilled parking charges').parentElement).toHaveTextContent('$0.00');
    expect(screen.getByText('Payments received this month').parentElement).toHaveTextContent(
      '$300.00',
    );
    expect(screen.getByText(/Total customers:/).parentElement).toHaveTextContent(
      'Total customers: 5',
    );
    expect(screen.getByText(/Total trucks:/).parentElement).toHaveTextContent('Total trucks: 6');
    expect(
      screen.queryByText('Current balances · Payments received this month'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Customers with a balance due' }),
    ).not.toBeInTheDocument();
  });

  it('shows the overview KPIs in Chinese without a balance-due customer section', async () => {
    await signIn();
    renderApp({ route: '/', language: 'zh-CN' });

    expect(await screen.findByRole('heading', { name: '概览' })).toBeInTheDocument();
    expect(await screen.findByText('客户共欠')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '已过期，需要催收' })).toBeInTheDocument();
    expect(screen.getByText('还没到期')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '有应付余额的客户' })).not.toBeInTheDocument();
  });

  it('does not display fabricated zero KPIs when the summary request fails', async () => {
    await signIn();
    server.use(http.get('/api/v1/reports/summary', () => HttpResponse.json({}, { status: 503 })));
    renderApp({ route: '/', language: 'en' });

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load overview metrics');
    expect(screen.queryByText('Customers owe in total')).not.toBeInTheDocument();
  });

  it('provides header actions, and Record payment opens the existing payment dialog', async () => {
    await signIn();
    const user = userEvent.setup();
    renderApp({ route: '/', language: 'en' });

    const recordPayment = await screen.findByRole('link', { name: 'Record payment' });
    expect(screen.getByRole('link', { name: 'Add customer' })).toHaveAttribute(
      'href',
      '/customers/new',
    );
    await user.click(recordPayment);
    expect(await screen.findByRole('dialog', { name: 'Record payment' })).toBeInTheDocument();
  });
});
