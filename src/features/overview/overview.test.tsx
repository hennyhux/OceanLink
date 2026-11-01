import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { tokens } from '@/app/theme';
import { CUSTOMER_IDS, db, findVehicle, today } from '@/mocks/db';
import { server } from '@/mocks/server';
import { addDays } from '@/lib/dates';
import { renderApp, signIn, useViewport } from '@/test/renderApp';

// The pure dashboard rules are unit tested in model.test.ts.
describe('overview dashboard', () => {
  it('shows the four headline numbers with their context', async () => {
    await signIn();
    renderApp({ route: '/' });

    const pastDue = await screen.findByRole('region', { name: 'Past due' });
    const amount = await within(pastDue).findByText('$50.00');
    expect(amount).toHaveStyle({ color: tokens.error });
    expect(pastDue).toHaveTextContent('1 customer');
    expect(within(pastDue).getByRole('link', { name: 'Follow up' })).toHaveAttribute(
      'href',
      '/customers?overdue=1',
    );

    const paid = screen.getByRole('region', { name: 'Paid this month' });
    await waitFor(() => expect(paid).toHaveTextContent('$300.00'));
    await waitFor(() => expect(paid).toHaveTextContent('1 payment'));

    expect(screen.getByRole('region', { name: 'Not billed yet' })).toHaveTextContent('$280.00');

    const customers = screen.getByRole('region', { name: 'Active customers' });
    await waitFor(() => expect(customers).toHaveTextContent('4'));
    expect(customers).toHaveTextContent('5 total · 1 inactive');
  });

  it('lists what needs attention, most urgent first', async () => {
    await signIn();
    // Pacific's truck parking ends in 10 days; Dmitri has no phone or email.
    findVehicle('v0000001-0000-4000-8000-000000000004')!.parking!.ends_on = addDays(today(), 10);
    const dmitri = db.customers.find((item) => item.id === CUSTOMER_IDS.dmitri)!;
    dmitri.phone = null;
    dmitri.email = null;
    renderApp({ route: '/' });

    const card = await screen.findByRole('region', { name: 'Needs attention' });
    const items = await within(card).findAllByRole('listitem');
    expect(items[0]).toHaveTextContent('远航货运有限公司');
    expect(items[0]).toHaveTextContent('$50.00 overdue · owes $150.00 in total');
    expect(card).toHaveTextContent("1 vehicle's monthly parking ends in the next 30 days");
    expect(card).toHaveTextContent('1 customer has no phone or email');
    expect(card).toHaveTextContent('Dmitri Volkov');
    // Units 12, 14, the trailer, and 6ABC789 have no monthly parking.
    expect(card).toHaveTextContent('4 vehicles have no monthly parking set up');
    expect(within(card).getByRole('link', { name: 'View all past due customers' })).toHaveAttribute(
      'href',
      '/customers?overdue=1',
    );
  });

  it('summarizes payments and the business without double counting', async () => {
    await signIn();
    renderApp({ route: '/' });
    const summary = await screen.findByRole('region', { name: 'Payment summary' });
    await waitFor(() => expect(summary).toHaveTextContent('Unpaid invoices$150.00'));
    expect(summary).toHaveTextContent('Past due$50.00');
    expect(summary).toHaveTextContent('Not due yet$100.00');
    expect(summary).toHaveTextContent('$280.00');

    const snapshot = screen.getByRole('region', { name: 'Business snapshot' });
    await waitFor(() => expect(snapshot).toHaveTextContent('Vehicles with monthly parking'));
    const value = (label: string) =>
      within(snapshot).getByText(label).closest('div')!.parentElement!.querySelector('dd')!
        .textContent;
    expect(value('Customers')).toBe('5');
    expect(value('Trucks')).toBe('6');
    expect(value('Vehicles with monthly parking')).toBe('1');
    expect(value('Customers past due')).toBe('1');
  });

  it('shows recent activity built from real records', async () => {
    await signIn();
    renderApp({ route: '/' });
    const card = await screen.findByRole('region', { name: 'Recent activity' });
    const rows = await within(card).findAllByRole('listitem');
    expect(rows).toHaveLength(5);
    // The seeded payment is the newest record.
    expect(rows[0]).toHaveTextContent('$300.00 payment from 远航货运有限公司');
    expect(within(rows[0]!).getByRole('link')).toHaveAttribute(
      'href',
      `/customers/${CUSTOMER_IDS.yuanhang}?tab=transactions`,
    );
  });

  it('keeps the other cards when the summary fails, and never shows made-up numbers', async () => {
    await signIn();
    server.use(
      http.get('/api/v1/reports/summary', () => HttpResponse.json({ code: 'X' }, { status: 503 })),
    );
    renderApp({ route: '/' });
    const paid = await screen.findByRole('region', { name: 'Paid this month' });
    expect(
      await within(paid).findByText('Could not load this. Nothing was changed.'),
    ).toBeInTheDocument();
    expect(within(paid).queryByText('$0.00')).not.toBeInTheDocument();
    // The attention list does not depend on the summary.
    const attention = screen.getByRole('region', { name: 'Needs attention' });
    expect(await within(attention).findByText('远航货运有限公司')).toBeInTheDocument();
  });

  it('fits a phone: compact cards that open with a tap, and no icons taking width', async () => {
    await signIn();
    useViewport(390);
    renderApp({ route: '/' });
    const pastDue = await screen.findByRole('region', { name: 'Past due' });
    await within(pastDue).findByText('$50.00');
    // The whole card is the link; its name still says where it goes.
    expect(within(pastDue).getByRole('link', { name: 'Follow up' })).toHaveAttribute(
      'href',
      '/customers?overdue=1',
    );
    expect(within(pastDue).queryByText('Follow up', { selector: 'a' })).not.toBeInTheDocument();
    // The top bar has no breadcrumb on the Overview; the page title says where you are.
    expect(screen.queryByRole('navigation', { name: 'You are here' })).not.toBeInTheDocument();
  });

  it('works in Chinese', async () => {
    await signIn();
    renderApp({ route: '/', language: 'zh-CN' });
    expect(await screen.findByRole('heading', { name: '概览', level: 1 })).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: '需要处理' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '最近动态' })).toBeInTheDocument();
  });
});
