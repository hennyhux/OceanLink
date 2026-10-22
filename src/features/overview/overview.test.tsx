import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { authApi } from '@/features/auth/api';
import { server } from '@/mocks/server';
import { renderApp } from '@/test/renderApp';

async function signIn() {
  const session = await authApi.login({ email: 'admin@example.com', password: 'admin-password' });
  server.use(http.get('/api/v1/auth/session', () => HttpResponse.json(session)));
}

describe('overview KPIs', () => {
  it('shows six dashboard KPIs from the current ledger and records', async () => {
    await signIn();
    renderApp({ route: '/', language: 'en' });

    expect(await screen.findByText('Overdue invoices')).toBeInTheDocument();
    expect(screen.getByText('Overdue invoices').parentElement).toHaveTextContent('$50.00');
    expect(screen.getByText('Open invoice balance').parentElement).toHaveTextContent('$150.00');
    expect(screen.getByText('Unbilled parking charges').parentElement).toHaveTextContent('$0.00');
    expect(screen.getByText('Payments received this month').parentElement).toHaveTextContent(
      '$300.00',
    );
    expect(screen.getByText('Total customers').parentElement).toHaveTextContent('5');
    expect(screen.getByText('Total trucks').parentElement).toHaveTextContent('6');
  });

  it('does not display fabricated zero KPIs when the summary request fails', async () => {
    await signIn();
    server.use(
      http.get('/api/v1/reports/summary', () => HttpResponse.json({}, { status: 503 })),
    );
    renderApp({ route: '/', language: 'en' });

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load overview metrics');
    expect(screen.queryByText('Overdue invoices')).not.toBeInTheDocument();
  });

  it('links each KPI card to its relevant navigation section', async () => {
    await signIn();
    renderApp({ route: '/', language: 'en' });

    const overdue = await screen.findByText('Overdue invoices');
    expect(overdue.closest('a')).toHaveAttribute('href', '/customers');
      expect(overdue.closest('a')).toHaveStyle({ display: 'block' });
    expect(screen.getByText('Open invoice balance').closest('a')).toHaveAttribute(
      'href',
      '/customers',
    );
    expect(screen.getByText('Unbilled parking charges').closest('a')).toHaveAttribute(
      'href',
      '/customers',
    );
    expect(screen.getByText('Payments received this month').closest('a')).toHaveAttribute(
      'href',
      '/payments',
    );
    expect(screen.getByText('Total customers').closest('a')).toHaveAttribute('href', '/customers');
    expect(screen.getByText('Total trucks').closest('a')).toHaveAttribute('href', '/vehicles');
  });
});