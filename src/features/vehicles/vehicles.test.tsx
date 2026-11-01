import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { CUSTOMER_IDS, db, findVehicle, today } from '@/mocks/db';
import { server } from '@/mocks/server';
import { addDays } from '@/lib/dates';
import { usd } from '@/lib/money';
import { renderApp, signIn } from '@/test/renderApp';

const UNIT_14 = 'v0000001-0000-4000-8000-000000000002';
const UNIT_7 = 'v0000001-0000-4000-8000-000000000004';
const fromCustomer = (id: string) =>
  `/vehicles/new?customer_id=${id}&returnTo=${encodeURIComponent(`/customers/${id}?tab=vehicles`)}`;

describe('vehicle list', () => {
  it('names each truck by unit and shows its monthly rate', async () => {
    await signIn();
    renderApp({ route: '/vehicles' });
    const table = await screen.findByRole('table', { name: 'Vehicles' });
    const row = within(table).getByRole('link', { name: 'Unit 7' }).closest('tr')!;
    expect(row).toHaveTextContent('$280.00');
    expect(row).toHaveTextContent('Truck with trailer');
    expect(within(table).getByRole('link', { name: 'Unit 14' }).closest('tr')).toHaveTextContent(
      'Not set up',
    );
    // Inactive vehicles are hidden unless asked for.
    expect(within(table).queryByRole('link', { name: 'OLD 1234' })).not.toBeInTheDocument();
  });
});

describe('add vehicle', () => {
  it('saves the vehicle and its monthly amount together, then returns to the customer', async () => {
    await signIn();
    const user = userEvent.setup();
    const sent: unknown[] = [];
    server.events.on('request:start', async ({ request }) => {
      if (request.method === 'POST' && request.url.endsWith('/vehicles'))
        sent.push(await request.clone().json());
    });
    renderApp({ route: fromCustomer(CUSTOMER_IDS.dmitri) });
    await screen.findByRole('heading', { name: 'Add vehicle', level: 1 });
    // Filled in from the customer.
    expect(screen.getByRole('textbox', { name: /^USDOT number/ })).toHaveValue('3456789');
    expect(screen.queryByLabelText(/^Billing starts/)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/^Unit number/), '21');
    await user.type(screen.getByLabelText(/^Monthly amount/), '325.50');
    await user.type(await screen.findByLabelText(/^Billing starts/), today());
    await user.click(screen.getByRole('button', { name: 'Add vehicle' }));

    expect(
      await screen.findByRole('heading', { name: 'Dmitri Volkov', level: 1 }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: 'Vehicles (1)' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Unit 21' }).closest('tr')).toHaveTextContent(
      '$325.50',
    );
    server.events.removeAllListeners();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      unit_number: '21',
      parking: {
        starts_on: today(),
        effective_on: today(),
        monthly_rate: usd(32550),
        ends_on: null,
      },
    });
  });

  it('asks for a start date once an amount is typed, and keeps entries', async () => {
    await signIn();
    const user = userEvent.setup();
    renderApp({ route: fromCustomer(CUSTOMER_IDS.dmitri) });
    await user.type(await screen.findByLabelText(/^Unit number/), '21');
    await user.type(screen.getByLabelText(/^Monthly amount/), '-20');
    await user.click(screen.getByRole('button', { name: 'Add vehicle' }));
    expect(await screen.findByText('Please fix 2 problems before saving')).toBeInTheDocument();
    expect(screen.getAllByText('Enter a dollar amount like 300 or 300.50.').length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText('Please choose the date billing starts.').length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/^Monthly amount/)).toHaveValue('-20');
    expect(db.vehicles.some((item) => item.unit_number === '21')).toBe(false);
  });

  it('requires a unit number for a USDOT-only truck and opens folded fields for plate errors', async () => {
    await signIn();
    const user = userEvent.setup();
    renderApp({ route: fromCustomer(CUSTOMER_IDS.yuanhang) });
    await user.click(await screen.findByRole('button', { name: 'Add vehicle' }));
    expect(await screen.findAllByText(/Please enter the unit number/)).not.toHaveLength(0);

    await user.click(screen.getByRole('radio', { name: 'License plate' }));
    expect(screen.getByLabelText(/^Plate number/)).toBeRequired();
    // The customer's USDOT moved into the folded section, so it opens to show it.
    expect(screen.getByLabelText(/^USDOT number \(optional\)/)).toBeVisible();
  });

  it('shows a duplicate unit number next to the field', async () => {
    await signIn();
    const user = userEvent.setup();
    renderApp({ route: fromCustomer(CUSTOMER_IDS.yuanhang) });
    await user.type(await screen.findByLabelText(/^Unit number/), '12');
    await user.click(screen.getByRole('button', { name: 'Add vehicle' }));
    expect(
      await screen.findByText(
        'Another active vehicle with this USDOT number already has this unit number.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Unit number/)).toHaveFocus();
  });
});

describe('vehicle monthly parking', () => {
  it('lets any staff member set up parking the first time', async () => {
    await signIn('operator');
    const user = userEvent.setup();
    renderApp({ route: `/vehicles/${UNIT_14}` });
    const section = await screen.findByRole('region', { name: 'Monthly parking' });
    await user.type(within(section).getByLabelText(/^Monthly amount/), '300');
    await user.type(within(section).getByLabelText(/^Billing starts/), today());
    await user.click(within(section).getByRole('button', { name: 'Save monthly parking' }));
    expect(await screen.findByText('Monthly parking saved.')).toBeInTheDocument();
    await waitFor(() => expect(findVehicle(UNIT_14)?.parking?.monthly_rate).toEqual(usd(30000)));
  });

  it('keeps rate and end-date changes for admins', async () => {
    await signIn('operator');
    renderApp({ route: `/vehicles/${UNIT_7}` });
    const section = await screen.findByRole('region', { name: 'Monthly parking' });
    expect(
      within(section).getByText('Only an admin can change the rate or the end date.'),
    ).toBeInTheDocument();
    expect(
      within(section).queryByRole('button', { name: 'Schedule a new rate' }),
    ).not.toBeInTheDocument();
  });

  it('schedules a future rate without changing history', async () => {
    await signIn('admin');
    const user = userEvent.setup();
    renderApp({ route: `/vehicles/${UNIT_7}` });
    const section = await screen.findByRole('region', { name: 'Monthly parking' });
    await user.click(within(section).getByRole('button', { name: 'Schedule a new rate' }));
    const dialog = await screen.findByRole('dialog', { name: 'Schedule a new rate' });
    await user.type(within(dialog).getByLabelText(/^New monthly amount/), '300');
    await user.type(within(dialog).getByLabelText(/^Starts on/), today());
    await user.type(within(dialog).getByLabelText(/^Reason/), 'Yearly increase');
    await user.click(within(dialog).getByRole('button', { name: 'Schedule rate' }));
    expect(await within(dialog).findByText(/Choose a future date/)).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText(/^Starts on/));
    await user.type(within(dialog).getByLabelText(/^Starts on/), addDays(today(), 40));
    await user.click(within(dialog).getByRole('button', { name: 'Schedule rate' }));
    expect(await screen.findByText('New rate scheduled.')).toBeInTheDocument();
    const history = await screen.findByRole('table', {
      name: 'Rate history and scheduled changes',
    });
    expect(within(history).getAllByRole('row')).toHaveLength(3);
    expect(within(history).getByText('Scheduled')).toBeInTheDocument();
    // The current rate does not change until the new date.
    expect(
      within(screen.getByRole('region', { name: 'Monthly parking' })).getAllByText('$280.00')
        .length,
    ).toBeGreaterThan(0);
  });

  it('will not deactivate a vehicle whose parking is still running', async () => {
    await signIn('admin');
    const user = userEvent.setup();
    renderApp({ route: `/vehicles/${UNIT_7}` });
    await user.click(await screen.findByRole('button', { name: 'Deactivate vehicle' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Deactivate' }),
    );
    expect(
      await screen.findByText(/End this vehicle's monthly parking before deactivating it/),
    ).toBeInTheDocument();
  });

  it('rejects bad parking on create without leaving a vehicle behind', async () => {
    await signIn();
    server.use(
      http.post('/api/v1/vehicles', () =>
        HttpResponse.json(
          { code: 'INVALID_PARKING', message: 'x', request_id: 'r-9' },
          { status: 422 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderApp({ route: fromCustomer(CUSTOMER_IDS.dmitri) });
    await user.type(await screen.findByLabelText(/^Unit number/), '21');
    await user.type(screen.getByLabelText(/^Monthly amount/), '10');
    await user.type(await screen.findByLabelText(/^Billing starts/), today());
    await user.click(screen.getByRole('button', { name: 'Add vehicle' }));
    expect(await screen.findByText(/so the vehicle was not added/)).toBeInTheDocument();
    expect(screen.getByText('Problem number: r-9')).toBeInTheDocument();
  });
});
