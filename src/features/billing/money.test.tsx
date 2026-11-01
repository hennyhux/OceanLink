import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { tokens } from '@/app/theme';
import { vehiclesApi } from '@/features/vehicles/api';
import { CUSTOMER_IDS, db, findPayment, today } from '@/mocks/db';
import { server } from '@/mocks/server';
import { renderApp, signIn } from '@/test/renderApp';

async function recordFromCustomer(user: ReturnType<typeof userEvent.setup>, amount: string) {
  await user.click(await screen.findByRole('button', { name: 'Record payment' }));
  const dialog = await screen.findByRole('dialog', { name: 'Record payment' });
  await waitFor(() => expect(within(dialog).getByLabelText(/^Date received/)).not.toBeDisabled());
  await user.type(within(dialog).getByLabelText(/^Amount received/), amount);
  await user.click(within(dialog).getByRole('button', { name: 'Review payment' }));
  return screen.getByRole('dialog');
}

describe('required financial example (REQUIREMENTS 17.1)', () => {
  it('issues $200 + $250, takes a $300 payment as credit, and the customer then owes $150 in red', async () => {
    await signIn();
    for (const [unit, amount] of [
      ['A1', 20000],
      ['A2', 25000],
    ] as const) {
      await vehiclesApi.create({
        customer_id: CUSTOMER_IDS.dmitri,
        vehicle_type: 'truck',
        unit_number: unit,
        usdot_number: '3456789',
        plate_number: null,
        plate_jurisdiction: null,
        parking: {
          starts_on: today(),
          ends_on: null,
          monthly_rate: { amount, currency: 'USD' },
          effective_on: today(),
          reason: 'Setup',
        },
      });
    }
    const user = userEvent.setup();
    renderApp({ route: `/customers/${CUSTOMER_IDS.dmitri}` });

    // Pay first, so the payment becomes credit that issuing can use.
    const review = await recordFromCustomer(user, '300');
    expect(review).toHaveTextContent('This records money you already received');
    await user.click(within(review).getByRole('button', { name: 'Confirm and record' }));
    expect(await screen.findByText('Payment recorded.')).toBeInTheDocument();
    const account = screen.getByRole('region', { name: 'Customer account' });
    expect((await within(account).findAllByText('Customer credit')).length).toBeGreaterThan(0);

    await user.click(within(account).getByRole('button', { name: 'Review monthly charges' }));
    const dialog = await screen.findByRole('dialog', { name: 'Review monthly charges' });
    expect(await within(dialog).findByText('Unit A1')).toBeInTheDocument();
    expect(within(dialog).getByText('Total charges').closest('tr')).toHaveTextContent('$450.00');
    expect(
      within(dialog).getByRole('checkbox', { name: /Use \$300\.00 of the customer's credit/ }),
    ).toBeChecked();
    expect(
      within(dialog).getByText('Customer will owe after issuing').parentElement,
    ).toHaveTextContent('$150.00');
    await user.click(within(dialog).getByRole('button', { name: 'Issue charges' }));
    expect(await within(dialog).findByText('Monthly charges issued')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));

    const owes = await within(account).findByText('Owes');
    await waitFor(() => expect(owes.nextElementSibling).toHaveTextContent('$150.00'));
    expect(owes.nextElementSibling).toHaveStyle({ color: tokens.error });
  }, 20_000);
});

describe('recording payments', () => {
  it('reuses the same key after an unknown result, so the payment is saved once', async () => {
    await signIn('operator');
    const keys: string[] = [];
    let first = true;
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'POST' && request.url.endsWith('/payments'))
        keys.push(request.headers.get('idempotency-key') ?? '');
    });
    server.use(
      http.post('/api/v1/payments', () => {
        if (!first) return undefined;
        first = false;
        return HttpResponse.json({ code: 'INTERNAL_ERROR', message: 'x' }, { status: 500 });
      }),
    );
    const user = userEvent.setup();
    renderApp({ route: `/customers/${CUSTOMER_IDS.pacific}` });
    const review = await recordFromCustomer(user, '125');
    expect(review).toHaveTextContent('Only an admin can reverse a payment.');
    await user.click(within(review).getByRole('button', { name: 'Confirm and record' }));

    expect(await within(review).findByText('We could not confirm the result')).toBeInTheDocument();
    // No way to go back and send a fresh request while the result is unknown.
    expect(within(review).queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
    await user.click(within(review).getByRole('button', { name: 'Check again' }));
    expect(await screen.findByText('Payment recorded.')).toBeInTheDocument();
    server.events.removeAllListeners();

    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(
      db.payments.filter((payment) => payment.customer_id === CUSTOMER_IDS.pacific),
    ).toHaveLength(1);
  });

  it('opens from the Overview button, and the Overview total updates without a reload', async () => {
    await signIn();
    const user = userEvent.setup();
    const { router } = renderApp({ route: '/' });
    const paidCard = await screen.findByRole('region', { name: 'Paid this month' });
    expect(await within(paidCard).findByText('$300.00')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Record payment' }));
    const dialog = await screen.findByRole('dialog', { name: 'Record payment' });
    await user.type(within(dialog).getByRole('combobox', { name: /^Customer/ }), '远航');
    await user.click(await screen.findByRole('option', { name: /远航货运有限公司/ }));
    await waitFor(() => expect(within(dialog).getByLabelText(/^Date received/)).not.toBeDisabled());
    await user.type(within(dialog).getByLabelText(/^Amount received/), '150');
    await user.click(within(dialog).getByRole('button', { name: 'Review payment' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm and record' }),
    );
    expect(await screen.findByText('Payment recorded.')).toBeInTheDocument();

    // Both the payment total and unpaid invoice totals refresh after automatic allocation.
    await router.navigate('/');
    const paid = await screen.findByRole('region', { name: 'Paid this month' });
    await waitFor(() => expect(paid).toHaveTextContent('$450.00'));
    expect(paid).toHaveTextContent('2 payments');
    const summary = screen.getByRole('region', { name: 'Payment summary' });
    await waitFor(() => expect(summary).toHaveTextContent('Unpaid invoices$0.00'));
    expect(summary).toHaveTextContent('Past due$0.00');
  });

  it('lets only admins reverse a payment, with a reason, and explains it is not a refund', async () => {
    await signIn('admin');
    const user = userEvent.setup();
    renderApp({ route: '/payments' });
    const table = await screen.findByRole('table', { name: 'Payments' });
    await user.click(
      within(table).getByRole('button', { name: /View receipt for 远航货运有限公司/ }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Payment receipt' });
    await user.click(await within(dialog).findByRole('button', { name: 'Reverse payment' }));
    expect(dialog).toHaveTextContent('It is not a refund.');
    await user.click(within(dialog).getByRole('button', { name: 'Reverse payment' }));
    expect(await within(dialog).findByText('Please give a reason.')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/^Why is this being reversed/), 'Entered twice');
    await user.click(within(dialog).getByRole('button', { name: 'Reverse payment' }));
    expect(await screen.findByText('Payment reversed.')).toBeInTheDocument();
    expect(findPayment('p0000001-0000-4000-8000-000000000001')?.status).toBe('reversed');
  });

  it('hides reversal from staff', async () => {
    await signIn('operator');
    const user = userEvent.setup();
    renderApp({ route: '/payments' });
    const table = await screen.findByRole('table', { name: 'Payments' });
    await user.click(within(table).getByRole('button', { name: /View receipt for/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Payment receipt' });
    await within(dialog).findByText('WIRE-1001');
    expect(
      within(dialog).queryByRole('button', { name: 'Reverse payment' }),
    ).not.toBeInTheDocument();
  });
});

describe('one-time charges', () => {
  it('reviews, then creates and issues the charge with two different keys', async () => {
    await signIn();
    const keys: string[] = [];
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'POST' && request.url.includes('/invoices'))
        keys.push(request.headers.get('idempotency-key') ?? '');
    });
    const user = userEvent.setup();
    renderApp({ route: `/customers/${CUSTOMER_IDS.pacific}` });
    await user.click(await screen.findByRole('button', { name: 'Add one-time charge' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add one-time charge' });
    await waitFor(() => expect(within(dialog).getByLabelText(/^Due date/)).not.toBeDisabled());
    await user.type(within(dialog).getByLabelText(/^What is this charge for/), 'Gate repair');
    await user.type(within(dialog).getByLabelText(/^Amount/), '55.50');
    await user.click(within(dialog).getByRole('button', { name: 'Review charge' }));
    const review = await screen.findByRole('dialog', { name: 'Review one-time charge' });
    expect(review).toHaveTextContent('No payment is recorded.');
    await user.click(within(review).getByRole('button', { name: 'Issue charge' }));
    expect(await screen.findByText(/Invoice OL-\d+ issued for \$55\.50\./)).toBeInTheDocument();
    server.events.removeAllListeners();

    expect(keys).toHaveLength(2);
    expect(keys[0]).not.toBe(keys[1]);
    const account = screen.getByRole('region', { name: 'Customer account' });
    const owes = await within(account).findByText('Owes');
    await waitFor(() => expect(owes.nextElementSibling).toHaveTextContent('$55.50'));
  });
});
