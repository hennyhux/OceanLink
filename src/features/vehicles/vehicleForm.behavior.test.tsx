import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/mocks/server';
import { renderApp } from '@/test/renderApp';
import { signedIn } from '@/test/signedIn';

const BASE = '/api/v1';
const YUANHANG = 'c0000001-0000-4000-8000-000000000001';
const PACIFIC = 'c0000001-0000-4000-8000-000000000002';
const UNIT_14 = 'v0000001-0000-4000-8000-000000000002';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('vehicle form: collapsed section', () => {
  it('opens the section and focuses the field when an error is inside it', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: `/vehicles/new?customer_id=${PACIFIC}` });

    await screen.findByRole('heading', { name: 'Add vehicle', level: 1 });
    await user.click(screen.getByRole('radio', { name: 'License plate' }));
    await user.type(screen.getByLabelText(/^Plate number/), '9ZZZ999');
    await user.type(screen.getByLabelText(/^State or province/), 'CA');

    // A bad USDOT number sits in the collapsed section while identifying by plate.
    const usdot = screen.getByRole('textbox', { name: /^USDOT number \(optional\)/ });
    await user.clear(usdot);
    await user.type(usdot, 'ABC');
    const toggle = screen.getByRole('button', { name: /Also add a USDOT number/ });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(screen.getByRole('button', { name: 'Add vehicle' }));

    expect(await screen.findByText('USDOT number must be 1 to 8 digits.')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(usdot).toHaveFocus());
  });

  it('opens the section when switching method leaves a value in it', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: `/vehicles/new?customer_id=${PACIFIC}` });

    await screen.findByRole('heading', { name: 'Add vehicle', level: 1 });
    // The customer's USDOT number was filled in, so it must stay visible after switching.
    await user.click(screen.getByRole('radio', { name: 'License plate' }));
    expect(screen.getByRole('button', { name: /Also add a USDOT number/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('textbox', { name: /^USDOT number \(optional\)/ })).toHaveValue(
      '2345678',
    );
  });

  it('does not ask for a unit number when a plate and state are given', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: `/vehicles/new?customer_id=${PACIFIC}` });

    await screen.findByRole('heading', { name: 'Add vehicle', level: 1 });
    await user.click(screen.getByRole('button', { name: /Also add a license plate/ }));
    await user.type(screen.getByLabelText(/^Plate number/), '9QQQ111');
    await user.type(screen.getByLabelText(/^State or province/), 'CA');
    await user.click(screen.getByRole('button', { name: 'Add vehicle' }));

    expect(await screen.findByText('Vehicle added.')).toBeInTheDocument();
  });
});

describe('vehicle form: server messages', () => {
  it('shows a known error that has no field as a message above the form', async () => {
    signedIn();
    server.use(
      http.post(`${BASE}/vehicles`, () =>
        HttpResponse.json({ code: 'IDENTIFIER_REQUIRED', message: 'x' }, { status: 422 }),
      ),
    );
    const user = userEvent.setup();
    renderApp({ route: `/vehicles/new?customer_id=${YUANHANG}` });

    await screen.findByRole('heading', { name: 'Add vehicle', level: 1 });
    await user.type(screen.getByLabelText(/^Unit number/), '77');
    await user.click(screen.getByRole('button', { name: 'Add vehicle' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A vehicle needs a USDOT number or a license plate.',
    );
    expect(screen.getByLabelText(/^Unit number/)).toHaveValue('77');
  });

  it('maps a code-only duplicate error onto its field', async () => {
    signedIn();
    server.use(
      http.post(`${BASE}/vehicles`, () =>
        HttpResponse.json({ code: 'UNIT_NUMBER_ALREADY_IN_USE', message: 'x' }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    renderApp({ route: `/vehicles/new?customer_id=${YUANHANG}` });

    await screen.findByRole('heading', { name: 'Add vehicle', level: 1 });
    await user.type(screen.getByLabelText(/^Unit number/), '88');
    await user.click(screen.getByRole('button', { name: 'Add vehicle' }));

    expect(
      await screen.findByText(
        'Another active vehicle with this USDOT number already has this unit number.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Unit number/)).toHaveFocus();
  });
});

describe('vehicle edit: what is sent and stale data', () => {
  it('sends only the changed field and never the owner', async () => {
    signedIn();
    let body: Record<string, unknown> | undefined;
    let ifMatch: string | null = null;
    server.use(
      http.patch(`${BASE}/vehicles/${UNIT_14}`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        ifMatch = request.headers.get('if-match');
        return HttpResponse.json({
          id: UNIT_14,
          version: 2,
          customer_id: YUANHANG,
          customer_name: '远航货运有限公司',
          vehicle_type: 'truck',
          unit_number: '15',
          plate_number: null,
          plate_jurisdiction: null,
          usdot_number: '1234567',
          is_active: true,
          created_at: '2026-09-02T12:00:00Z',
          updated_at: '2026-09-03T12:00:00Z',
        });
      }),
    );
    const user = userEvent.setup();
    renderApp({ route: `/vehicles/${UNIT_14}/edit` });

    const unit = await screen.findByLabelText(/^Unit number/);
    await user.clear(unit);
    await user.type(unit, '15');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(body).toBeDefined());
    expect(body).toEqual({ unit_number: '15' });
    expect(body).not.toHaveProperty('customer_id');
    expect(ifMatch).toBe('"1"');
  });

  it('says nothing changed, and sends nothing, when the form is saved untouched', async () => {
    signedIn();
    let patched = false;
    server.use(
      http.patch(`${BASE}/vehicles/${UNIT_14}`, () => {
        patched = true;
        return new HttpResponse(null, { status: 500 });
      }),
    );
    const user = userEvent.setup();
    renderApp({ route: `/vehicles/${UNIT_14}/edit` });

    await screen.findByLabelText(/^Unit number/);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Nothing was changed.')).toBeInTheDocument();
    expect(patched).toBe(false);
  });

  it('restarts the form from the new version after a stale deactivate', async () => {
    signedIn();
    server.use(
      http.patch(`${BASE}/vehicles/${UNIT_14}`, () =>
        HttpResponse.json({ code: 'STALE_VERSION', message: 'stale' }, { status: 412 }),
      ),
    );
    const user = userEvent.setup();
    renderApp({ route: `/vehicles/${UNIT_14}/edit` });

    const unit = await screen.findByLabelText(/^Unit number/);
    await user.clear(unit);
    await user.type(unit, '99');
    await user.click(screen.getByRole('button', { name: 'Deactivate vehicle' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(
      Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Deactivate')!,
    );

    expect(
      await screen.findByText(/Someone else changed this record just now/),
    ).toBeInTheDocument();
    // The form starts again from what the server has, so old values cannot be saved over it.
    await waitFor(() => expect(screen.getByLabelText(/^Unit number/)).toHaveValue('14'));
  });

  it('keeps typed edits when the reload itself fails', async () => {
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
    await screen.findByText('Someone else changed this record');

    server.use(http.get(`${BASE}/vehicles/${UNIT_14}`, () => HttpResponse.error()));
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    await wait(300);
    expect(screen.getByLabelText(/^Unit number/)).toHaveValue('149');
  });
});

describe('vehicle list: search and return', () => {
  it('does not bring the old search back after it is cleared', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: '/vehicles' });

    const search = await screen.findByRole('searchbox', { name: 'Search vehicles' });
    await user.type(search, 'trl4821');
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: 'Unit 12' })).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    // Longer than the debounce, so an old value would have had time to come back.
    await wait(700);
    expect(search).toHaveValue('');
    expect(await screen.findByRole('link', { name: 'Unit 12' })).toBeInTheDocument();
  });

  it('clears the search box when the search is removed from outside', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: '/vehicles?q=trl4821' });

    const search = await screen.findByRole('searchbox', { name: 'Search vehicles' });
    expect(search).toHaveValue('trl4821');

    // The sidebar link goes to /vehicles with no search.
    await user.click(screen.getByRole('link', { name: 'Vehicles' }));
    await waitFor(() => expect(search).toHaveValue(''));
    expect(await screen.findByRole('link', { name: 'Unit 12' })).toBeInTheDocument();
  });

  it('comes back to the same search after editing a vehicle', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: '/vehicles?q=1234567' });

    await screen.findByRole('link', { name: 'Unit 14' });
    await user.click(screen.getByRole('link', { name: 'Edit Unit 14' }));
    await screen.findByRole('heading', { name: 'Edit vehicle', level: 1 });
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByRole('searchbox', { name: 'Search vehicles' })).toHaveValue(
      '1234567',
    );
    expect(await screen.findByRole('link', { name: 'Unit 14' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '6ABC789' })).not.toBeInTheDocument();
  });
});
