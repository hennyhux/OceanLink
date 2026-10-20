import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/mocks/server';
import { renderApp } from '@/test/renderApp';

const BASE = '/api/v1';

const adminSession = {
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'admin@example.com',
    name: 'Ada Admin',
    role: 'admin',
    is_active: true,
    preferred_language: 'en',
    must_change_password: false,
  },
  session: {
    idle_expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
    absolute_expires_at: new Date(Date.now() + 8 * 3_600_000).toISOString(),
  },
};

function signedIn() {
  server.use(http.get(`${BASE}/auth/session`, () => HttpResponse.json(adminSession)));
}

const YUANHANG = 'c0000001-0000-4000-8000-000000000001';
const PACIFIC = 'c0000001-0000-4000-8000-000000000002';
const UNIT_14 = 'v0000001-0000-4000-8000-000000000002';

describe('vehicles list', () => {
  it('lists active vehicles and hides inactive ones by default', async () => {
    signedIn();
    renderApp({ route: '/vehicles' });

    expect(await screen.findByRole('link', { name: 'Unit 12' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Unit 14' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'TRL 4821' })).toBeInTheDocument();
    // Inactive: Unit 3 (Jinqiao) and OLD 1234 (Pacific).
    expect(screen.queryByRole('link', { name: 'Unit 3' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'OLD 1234' })).not.toBeInTheDocument();
  });

  it('tells apart two trucks that share one USDOT number', async () => {
    signedIn();
    renderApp({ route: '/vehicles' });

    await screen.findByRole('link', { name: 'Unit 12' });
    // Both rows show the same USDOT, but each row is named by its own unit number.
    const rowOf = (unit: string) => screen.getByRole('link', { name: unit }).closest('tr')!;
    expect(within(rowOf('Unit 12')).getByText('USDOT 1234567')).toBeInTheDocument();
    expect(within(rowOf('Unit 14')).getByText('USDOT 1234567')).toBeInTheDocument();
    expect(rowOf('Unit 12')).not.toBe(rowOf('Unit 14'));
  });

  it('searches by USDOT, plate (ignoring spaces), and customer name', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: '/vehicles' });
    const search = await screen.findByRole('searchbox', { name: 'Search vehicles' });

    await user.type(search, '1234567');
    expect(await screen.findByRole('link', { name: 'Unit 12' })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: '6ABC789' })).not.toBeInTheDocument(),
    );

    await user.clear(search);
    await user.type(search, 'trl4821');
    expect(await screen.findByRole('link', { name: 'TRL 4821' })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: 'Unit 12' })).not.toBeInTheDocument(),
    );

    await user.clear(search);
    await user.type(search, '李强');
    expect(await screen.findByRole('link', { name: '6ABC789' })).toBeInTheDocument();
  });

  it('shows inactive vehicles when asked', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: '/vehicles' });

    await screen.findByRole('link', { name: 'Unit 12' });
    await user.click(screen.getByRole('checkbox', { name: 'Show inactive vehicles' }));
    expect(await screen.findByRole('link', { name: 'OLD 1234' })).toBeInTheDocument();
  });

  it('shows a no-results state', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: '/vehicles' });
    await user.type(await screen.findByRole('searchbox', { name: 'Search vehicles' }), 'zzzzzz');
    expect(await screen.findByText('No vehicles match')).toBeInTheDocument();
  });
});

describe('vehicle create', () => {
  it('defaults to USDOT, never asks for a plate, and requires a unit number', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: `/vehicles/new?customer_id=${PACIFIC}` });

    await screen.findByRole('heading', { name: 'Add vehicle', level: 1 });
    expect(screen.getByRole('radio', { name: 'USDOT number' })).toBeChecked();
    // Filled in from the customer.
    expect(screen.getByRole('textbox', { name: /^USDOT number/ })).toHaveValue('2345678');
    // A plate is never required when identifying by USDOT; it is only an optional extra.
    expect(screen.getByLabelText(/^Plate number \(optional\)/)).not.toBeRequired();

    await user.click(screen.getByRole('button', { name: 'Add vehicle' }));
    expect(
      await screen.findByText(/Please enter the unit number so this truck can be told apart/),
    ).toBeInTheDocument();
    expect(screen.queryByText('Please enter the plate number.')).not.toBeInTheDocument();
  });

  it('creates a USDOT vehicle from the customer page and returns there', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: `/customers/${PACIFIC}` });

    await screen.findByRole('heading', { name: 'Pacific Haul LLC', level: 1 });
    await user.click(await screen.findByRole('link', { name: 'Add vehicle' }));

    await screen.findByRole('heading', { name: 'Add vehicle', level: 1 });
    await user.type(screen.getByLabelText(/^Unit number/), '21');
    await user.click(screen.getByRole('button', { name: 'Add vehicle' }));

    // Back on the customer page with a confirmation and the new vehicle listed.
    expect(await screen.findByText('Vehicle added.')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Unit 21' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pacific Haul LLC', level: 1 })).toBeInTheDocument();
  });

  it('lets the user pick a customer by searching when none is chosen yet', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: '/vehicles/new' });

    await screen.findByRole('heading', { name: 'Add vehicle', level: 1 });
    await user.type(screen.getByLabelText(/^Customer/), 'Pacific');
    await user.click(await screen.findByRole('option', { name: /Pacific Haul LLC/ }));
    // Picking the customer fills in their USDOT number.
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: /^USDOT number/ })).toHaveValue('2345678'),
    );

    await user.type(screen.getByLabelText(/^Unit number/), '30');
    await user.click(screen.getByRole('button', { name: 'Add vehicle' }));
    expect(await screen.findByText('Vehicle added.')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Unit 30' })).toBeInTheDocument();
  });

  it('requires a customer when none is chosen', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: '/vehicles/new' });

    await screen.findByRole('heading', { name: 'Add vehicle', level: 1 });
    await user.click(screen.getByRole('button', { name: 'Add vehicle' }));
    expect(await screen.findByText('Please choose a customer.')).toBeInTheDocument();
  });

  it('shows plate and state fields when identifying by license plate, and needs both', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: `/vehicles/new?customer_id=${YUANHANG}` });

    await screen.findByRole('heading', { name: 'Add vehicle', level: 1 });
    await user.click(screen.getByRole('radio', { name: 'License plate' }));
    expect(screen.getByLabelText(/^Plate number/)).toBeRequired();
    expect(screen.getByLabelText(/^State or province/)).toBeRequired();
    // The USDOT field now lives in the collapsed section as optional.
    expect(screen.getByLabelText(/^USDOT number \(optional\)/)).not.toBeRequired();

    await user.click(screen.getByRole('button', { name: 'Add vehicle' }));
    expect(await screen.findByText('Please enter the plate number.')).toBeInTheDocument();
    expect(screen.getByText('Please enter the state or province.')).toBeInTheDocument();
  });

  it('creates a plate-only vehicle without a USDOT number', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: `/vehicles/new?customer_id=${PACIFIC}` });

    await screen.findByRole('heading', { name: 'Add vehicle', level: 1 });
    await user.click(screen.getByRole('radio', { name: 'License plate' }));
    // Clear the USDOT number that was filled in from the customer.
    await user.clear(screen.getByLabelText(/^USDOT number \(optional\)/));
    await user.type(screen.getByLabelText(/^Plate number/), '9NEW555');
    await user.type(screen.getByLabelText(/^State or province/), 'ca');
    await user.click(screen.getByRole('button', { name: 'Add vehicle' }));

    expect(await screen.findByText('Vehicle added.')).toBeInTheDocument();
    // State is saved in capitals.
    expect(await screen.findByText(/Plate 9NEW555 \(CA\)/)).toBeInTheDocument();
  });

  it('shows the duplicate unit error next to the field and keeps entries', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: `/vehicles/new?customer_id=${YUANHANG}` });

    await screen.findByRole('heading', { name: 'Add vehicle', level: 1 });
    // Unit 12 under USDOT 1234567 already exists.
    await user.type(screen.getByLabelText(/^Unit number/), '12');
    await user.click(screen.getByRole('button', { name: 'Add vehicle' }));

    expect(
      await screen.findByText(
        'Another active vehicle with this USDOT number already has this unit number.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Unit number/)).toHaveValue('12');
    expect(screen.getByLabelText(/^Unit number/)).toHaveFocus();
  });

  it('shows the duplicate plate error even when the plate field is in the collapsed section', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: `/vehicles/new?customer_id=${YUANHANG}` });

    await screen.findByRole('heading', { name: 'Add vehicle', level: 1 });
    await user.type(screen.getByLabelText(/^Unit number/), '40');
    await user.click(screen.getByRole('button', { name: /Also add a license plate/ }));
    await user.type(screen.getByLabelText(/^Plate number/), 'TRL4821');
    await user.type(screen.getByLabelText(/^State or province/), 'CA');
    await user.click(screen.getByRole('button', { name: 'Add vehicle' }));

    expect(
      await screen.findByText('Another active vehicle already has this plate.'),
    ).toBeInTheDocument();
  });

  it('warns, without blocking, when the USDOT differs from the customer', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: `/vehicles/new?customer_id=${YUANHANG}` });

    await screen.findByRole('heading', { name: 'Add vehicle', level: 1 });
    const usdot = screen.getByRole('textbox', { name: /^USDOT number/ });
    await user.clear(usdot);
    await user.type(usdot, '9999999');
    expect(
      await screen.findByText(/This is different from the customer’s USDOT number \(1234567\)/),
    ).toBeInTheDocument();
  });

  it('keeps entries and shows a network message when the save fails', async () => {
    signedIn();
    server.use(http.post(`${BASE}/vehicles`, () => HttpResponse.error()));
    const user = userEvent.setup();
    renderApp({ route: `/vehicles/new?customer_id=${YUANHANG}` });

    await screen.findByRole('heading', { name: 'Add vehicle', level: 1 });
    await user.type(screen.getByLabelText(/^Unit number/), '55');
    await user.click(screen.getByRole('button', { name: 'Add vehicle' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t save');
    expect(screen.getByLabelText(/^Unit number/)).toHaveValue('55');
  });

  it('ignores an unsafe returnTo and goes to the vehicle list', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({
      route: `/vehicles/new?customer_id=${YUANHANG}&returnTo=${encodeURIComponent('//evil.example')}`,
    });

    await screen.findByRole('heading', { name: 'Add vehicle', level: 1 });
    await user.type(screen.getByLabelText(/^Unit number/), '56');
    await user.click(screen.getByRole('button', { name: 'Add vehicle' }));
    expect(await screen.findByRole('heading', { name: 'Vehicles', level: 1 })).toBeInTheDocument();
  });
});

describe('vehicle edit', () => {
  it('loads existing values, keeps the owner fixed, saves, and returns to the list', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: `/vehicles/${UNIT_14}/edit` });

    const unit = await screen.findByLabelText(/^Unit number/);
    expect(unit).toHaveValue('14');
    expect(screen.getByRole('link', { name: '远航货运有限公司' })).toBeInTheDocument();
    expect(screen.getByText('The customer cannot be changed here.')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Customer/)).not.toBeInTheDocument();

    await user.clear(unit);
    await user.type(unit, '15');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Changes saved.')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Unit 15' })).toBeInTheDocument();
  });

  it('explains a stale version and offers a reload', async () => {
    signedIn();
    server.use(
      http.patch(`${BASE}/vehicles/${UNIT_14}`, () =>
        HttpResponse.json({ code: 'STALE_VERSION', message: 'stale' }, { status: 412 }),
      ),
    );
    const user = userEvent.setup();
    renderApp({ route: `/vehicles/${UNIT_14}/edit` });

    const unit = await screen.findByLabelText(/^Unit number/);
    await user.type(unit, '9');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Someone else changed this record')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });

  it('asks before leaving with unsaved changes', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: `/vehicles/${UNIT_14}/edit` });

    const unit = await screen.findByLabelText(/^Unit number/);
    await user.type(unit, '9');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    const dialog = await screen.findByRole('dialog', { name: 'Leave this page?' });
    await user.click(within(dialog).getByRole('button', { name: 'Leave without saving' }));
    expect(await screen.findByRole('heading', { name: 'Vehicles', level: 1 })).toBeInTheDocument();
  });

  it('shows not found for an unknown vehicle', async () => {
    signedIn();
    renderApp({ route: '/vehicles/does-not-exist/edit' });
    expect(await screen.findByText('Vehicle not found')).toBeInTheDocument();
  });

  it('deactivates after confirmation and can reactivate', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: `/vehicles/${UNIT_14}/edit` });

    await screen.findByRole('heading', { name: 'Edit vehicle', level: 1 });
    await user.click(screen.getByRole('button', { name: 'Deactivate vehicle' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }));

    expect(await screen.findByText('Vehicle deactivated.')).toBeInTheDocument();
    expect(await screen.findByText(/This vehicle is inactive/)).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Reactivate vehicle' }));
    expect(await screen.findByText('Vehicle reactivated.')).toBeInTheDocument();
  });
});

describe('vehicles in Chinese', () => {
  it('shows the vehicle form and list in Chinese without English leftovers', async () => {
    signedIn();
    renderApp({ route: '/vehicles', language: 'zh-CN' });

    expect(await screen.findByRole('heading', { name: '车辆', level: 1 })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: '车辆编号 12' })).toBeInTheDocument();
    expect(screen.getAllByText('启用中').length).toBeGreaterThan(0);
  });

  it('asks for the unit number in Chinese when identifying by USDOT', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: `/vehicles/new?customer_id=${PACIFIC}`, language: 'zh-CN' });

    await screen.findByRole('heading', { name: '添加车辆', level: 1 });
    expect(screen.getByRole('radio', { name: 'USDOT 号码' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: '添加车辆' }));
    expect(await screen.findByText(/请填写车辆编号/)).toBeInTheDocument();
  });
});

describe('customer page vehicles', () => {
  it('lists the customer’s vehicles with their identifiers', async () => {
    signedIn();
    renderApp({ route: `/customers/${YUANHANG}` });

    expect(await screen.findByRole('link', { name: 'Unit 12' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Unit 14' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'TRL 4821' })).toBeInTheDocument();
    // Another customer's vehicle is not shown here.
    expect(screen.queryByRole('link', { name: '6ABC789' })).not.toBeInTheDocument();
  });

  it('shows an empty message for a customer with no vehicles', async () => {
    signedIn();
    renderApp({ route: '/customers/c0000001-0000-4000-8000-000000000004' });
    expect(await screen.findByText('No vehicles yet for this customer.')).toBeInTheDocument();
  });
});
