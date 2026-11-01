import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { tokens } from '@/app/theme';
import { CUSTOMER_IDS, db } from '@/mocks/db';
import { server } from '@/mocks/server';
import { renderApp, signIn, useViewport } from '@/test/renderApp';

const rowOf = (name: string) => screen.getByRole('link', { name }).closest('tr')!;

describe('customer list', () => {
  it('shows amounts owed in red with words, credit in green, and no truck count', async () => {
    await signIn();
    db.payments.push({
      ...db.payments[0]!,
      id: 'p-credit',
      customer_id: CUSTOMER_IDS.dmitri,
      amount: { amount: 2500, currency: 'USD' },
    });
    renderApp({ route: '/customers' });
    await screen.findByRole('link', { name: '远航货运有限公司' });

    const owing = rowOf('远航货运有限公司');
    const owed = within(owing).getByText('$150.00');
    expect(owed).toHaveStyle({ color: tokens.error });
    expect(owed).toHaveTextContent('Owes');
    expect(within(owing).getByText(/^Overdue/)).toHaveTextContent('Overdue: $50.00');

    const credit = rowOf('Dmitri Volkov');
    expect(within(credit).getByText('Customer credit')).toBeInTheDocument();
    expect(within(credit).getByText('$25.00')).toHaveStyle({ color: tokens.success });
    expect(within(rowOf('Pacific Haul LLC')).getByText('$0.00')).toHaveStyle({
      color: tokens.text,
    });

    expect(screen.queryByRole('columnheader', { name: /truck/i })).not.toBeInTheDocument();
    expect(screen.getByText('4 customers')).toBeInTheDocument();
  });

  it('keeps search and filters in the address so Back returns to them', async () => {
    await signIn();
    const user = userEvent.setup();
    const { router } = renderApp({ route: '/customers' });
    await screen.findByRole('link', { name: 'Pacific Haul LLC' });

    await user.click(
      screen.getByRole('checkbox', { name: 'Only customers with overdue balances' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: 'Pacific Haul LLC' })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('link', { name: '远航货运有限公司' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?overdue=1');

    await user.click(
      screen.getByRole('checkbox', { name: 'Only customers with overdue balances' }),
    );
    await user.type(screen.getByRole('searchbox', { name: 'Search customers' }), '2345678');
    await waitFor(() => expect(router.state.location.search).toBe('?q=2345678'));
    expect(await screen.findByRole('link', { name: 'Pacific Haul LLC' })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: '李强' })).not.toBeInTheDocument(),
    );

    await user.clear(screen.getByRole('searchbox', { name: 'Search customers' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search customers' }), 'zzzz');
    expect(await screen.findByText('No customers match.')).toBeInTheDocument();
  });

  it('shows cards with the same facts on a phone', async () => {
    await signIn();
    useViewport(390);
    renderApp({ route: '/customers' });
    const link = await screen.findByRole('link', { name: '远航货运有限公司' });
    const card = link.closest('li')!;
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(within(card).getByText('$150.00')).toHaveStyle({ color: tokens.error });
    expect(within(card).getByText('Active')).toBeInTheDocument();
  });
});

describe('customer detail', () => {
  it('brings account, contact, and vehicles together, with the vehicle count on its tab', async () => {
    await signIn();
    renderApp({ route: `/customers/${CUSTOMER_IDS.yuanhang}` });
    await screen.findByRole('heading', { name: '远航货运有限公司', level: 1 });

    const account = screen.getByRole('region', { name: 'Customer account' });
    const label = await within(account).findByText('Owes');
    const hero = label.nextElementSibling;
    expect(hero).toHaveTextContent('$150.00');
    expect(hero).toHaveStyle({ color: tokens.error });
    expect(within(account).getAllByText(/^Overdue/)[0]).toHaveTextContent('Overdue: $50.00');
    expect(
      within(account).getByText('Oct 1, 2026 · Bank transfer', { exact: false }),
    ).toBeInTheDocument();
    expect(within(account).queryByText(/truck/i)).not.toBeInTheDocument();

    expect(await screen.findByRole('tab', { name: 'Vehicles (3)' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('link', { name: 'Unit 12' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'TRL 4821' })).toBeInTheDocument();
    expect(screen.getAllByText('Not set up').length).toBeGreaterThan(0);
  });

  it('never turns a failed balance into $0.00', async () => {
    await signIn();
    server.use(
      http.get('/api/v1/customers/:id/ledger', () =>
        HttpResponse.json({ code: 'X' }, { status: 503 }),
      ),
    );
    renderApp({ route: `/customers/${CUSTOMER_IDS.yuanhang}` });
    expect(await screen.findByText('Could not load this account')).toBeInTheDocument();
    const account = screen.getByRole('region', { name: 'Customer account' });
    expect(within(account).queryByText('$0.00')).not.toBeInTheDocument();
  });

  it('lists payments and issued charges in Transactions, newest first', async () => {
    await signIn();
    const user = userEvent.setup();
    renderApp({ route: `/customers/${CUSTOMER_IDS.yuanhang}?tab=transactions` });
    const table = await screen.findByRole('table', { name: 'Transactions' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Opening balance');
    expect(
      within(table).getByRole('button', { name: 'Payment, Bank transfer' }),
    ).toBeInTheDocument();

    await user.click(within(table).getByRole('button', { name: 'Payment, Bank transfer' }));
    expect(await screen.findByRole('dialog', { name: 'Payment receipt' })).toHaveTextContent(
      'WIRE-1001',
    );
  });

  it('asks before deactivating and explains that the balance stays', async () => {
    await signIn();
    const user = userEvent.setup();
    renderApp({ route: `/customers/${CUSTOMER_IDS.pacific}?tab=details` });
    await user.click(await screen.findByRole('button', { name: 'Deactivate customer' }));
    const dialog = await screen.findByRole('dialog', { name: 'Deactivate Pacific Haul LLC?' });
    expect(dialog).toHaveTextContent('Their balance stays');
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    expect(await screen.findByText('Customer deactivated.')).toBeInTheDocument();
    expect(await screen.findByText(/This customer is inactive/)).toBeInTheDocument();
  });
});

describe('customer forms', () => {
  it('lists problems at the top, keeps typing, and adds the customer', async () => {
    await signIn();
    const user = userEvent.setup();
    renderApp({ route: '/customers/new' });
    await screen.findByRole('heading', { name: 'Add customer', level: 1 });

    await user.type(screen.getByLabelText(/^USDOT number/), '12AB');
    await user.click(screen.getByRole('button', { name: 'Save customer' }));
    const summary = await screen.findByText('Please fix 2 problems before saving');
    expect(summary.closest('[role="alert"]')).toHaveTextContent(
      "Please enter the customer's name.",
    );
    expect(screen.getByLabelText(/^Business name/)).toHaveFocus();
    expect(screen.getByLabelText(/^USDOT number/)).toHaveValue('12AB');

    await user.clear(screen.getByLabelText(/^USDOT number/));
    await user.type(screen.getByLabelText(/^Business name/), 'Harbor Freight Co');
    await user.click(screen.getByRole('button', { name: 'Save customer' }));
    expect(
      await screen.findByRole('heading', { name: 'Harbor Freight Co', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Customer added.')).toBeInTheDocument();
  });

  it('puts a USDOT conflict on the field', async () => {
    await signIn();
    const user = userEvent.setup();
    renderApp({ route: '/customers/new' });
    await user.type(await screen.findByLabelText(/^Business name/), 'Copycat LLC');
    await user.type(screen.getByLabelText(/^USDOT number/), '2345678');
    await user.click(screen.getByRole('button', { name: 'Save customer' }));
    expect(
      await screen.findByText('Another active customer already has this USDOT number.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^USDOT number/)).toHaveFocus();
  });

  it('warns when someone else saved first and keeps the edits until Reload', async () => {
    await signIn();
    const user = userEvent.setup();
    renderApp({ route: `/customers/${CUSTOMER_IDS.pacific}/edit` });
    const phone = await screen.findByLabelText(/^Phone/);
    db.customers.find((item) => item.id === CUSTOMER_IDS.pacific)!.version += 1;

    await user.clear(phone);
    await user.type(phone, '(555) 999-0000');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Someone else changed this record')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Phone/)).toHaveValue('(555) 999-0000');

    await user.click(screen.getByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(screen.getByLabelText(/^Phone/)).toHaveValue('(555) 010-1002'));
  });
});
