import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/renderApp';
import { signedIn } from '@/test/signedIn';
import { server } from '@/mocks/server';
import { config } from '@/lib/config';
import { customersApi } from '@/features/customers/api';
import { vehiclesApi } from './api';
import { parkingToWrite, type VehicleParkingWrite } from './parkingModel';
import type { Vehicle } from './types';

const id = 'v0000001-0000-4000-8000-000000000001';
const customerId = 'c0000001-0000-4000-8000-000000000001';
const setup = parkingToWrite({
  pool_id: 'mock-standard',
  starts_on: '2026-10-01',
  ends_on: '',
  rate: '200',
  effective_on: '2026-10-01',
  reason: 'Initial monthly rate',
});

async function adminSave(vehicle: Vehicle, body: VehicleParkingWrite) {
  return fetch(`${config.apiBaseUrl}/vehicles/${vehicle.id}/parking`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'If-Match': `"${vehicle.version}"`,
      Cookie: 'oceanlink_mock_session=11111111-1111-4111-8111-111111111111',
    },
    body: JSON.stringify(body),
  });
}

describe('vehicle-owned monthly parking', () => {
  it('sets a vehicle monthly rate without creating a contract or changing debt', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: `/vehicles/${id}/edit` });
    await screen.findByRole('heading', { name: 'Monthly parking' });
    await user.click(screen.getByRole('combobox', { name: 'Capacity category' }));
    await user.click(await screen.findByRole('option', { name: 'Standard (demo)' }));
    await user.type(screen.getByLabelText(/Billing starts/), '2026-10-01');
    await user.type(screen.getByLabelText(/Monthly vehicle rate/), '200.29');
    await user.type(screen.getByLabelText(/Reason for this change/), 'Initial monthly rate');
    await user.click(screen.getByRole('button', { name: 'Save monthly parking' }));
    expect(await screen.findByText('Monthly parking saved.')).toBeInTheDocument();
    expect((await vehiclesApi.get(id)).parking?.monthly_rate.amount).toBe(20029);
    await user.click(screen.getByRole('link', { name: '远航货运有限公司' }));
    await screen.findByText('Last payment received');
    expect(screen.getByText('Last payment received').parentElement).toHaveTextContent('$300.00');
    expect(screen.getByText('Outstanding balance').parentElement).toHaveTextContent('$150.00');
    expect(screen.queryByRole('link', { name: 'Parking agreements' })).not.toBeInTheDocument();
  });

  it('keeps future rate history and leaves the current price unchanged', async () => {
    const vehicle = await vehiclesApi.saveParking(id, 1, setup);
    const effective = `${new Date().getUTCFullYear() + 2}-01-01`;
    const response = await adminSave(vehicle, {
      ...setup,
      monthly_rate: { amount: 25000, currency: 'USD' },
      effective_on: effective,
      reason: 'New rate',
    });
    expect(response.status).toBe(200);
    const updated = (await response.json()) as Vehicle;
    expect(updated.parking?.monthly_rate.amount).toBe(20000);
    expect(updated.parking?.rate_history.map((rate) => rate.monthly_rate.amount)).toEqual([
      20000, 25000,
    ]);
    const bad = await adminSave(updated, {
      ...setup,
      monthly_rate: { amount: 30000, currency: 'USD' },
      effective_on: '2026-10-01',
    });
    expect(bad.status).toBe(409);
    expect((await vehiclesApi.get(id)).parking?.rate_history).toHaveLength(2);
  });

  it('rejects stale writes and unauthorized changes to an existing rate', async () => {
    const vehicle = await vehiclesApi.saveParking(id, 1, setup);
    await expect(vehiclesApi.saveParking(id, 1, setup)).rejects.toMatchObject({ status: 412 });
    await expect(
      vehiclesApi.saveParking(id, vehicle.version, {
        ...setup,
        monthly_rate: { amount: 99900, currency: 'USD' },
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('copies customer defaults without retroactively changing existing parking', async () => {
    const customer = await customersApi.get(customerId);
    const changed = await customersApi.update(customer.id, customer.version, {
      billing_anchor_day: 15,
      payment_terms: 'Pay by transfer',
    });
    await vehiclesApi.saveParking(id, 1, setup);
    await customersApi.update(customer.id, changed.version, {
      billing_anchor_day: 20,
      payment_terms: 'New terms',
    });
    expect((await vehiclesApi.get(id)).parking).toMatchObject({
      billing_anchor_day: 15,
      payment_terms: 'Pay by transfer',
    });
  });

  it('counts capacity by vehicle and rejects an eleventh concurrent parking setup', async () => {
    for (let index = 0; index < 10; index += 1) {
      const vehicle = await vehiclesApi.create({
        customer_id: customerId,
        vehicle_type: 'truck',
        unit_number: `parking-${index}`,
        usdot_number: '1234567',
        plate_number: null,
        plate_jurisdiction: null,
      });
      await vehiclesApi.saveParking(vehicle.id, vehicle.version, setup);
    }
    await expect(vehiclesApi.saveParking(id, 1, setup)).rejects.toMatchObject({
      status: 409,
      code: 'CAPACITY_UNAVAILABLE',
    });
    expect((await vehiclesApi.get(id)).parking).toBeNull();
  });

  it('requires service to end before archiving and preserves price history', async () => {
    const vehicle = await vehiclesApi.saveParking(id, 1, setup);
    await expect(vehiclesApi.setActive(id, vehicle.version, false)).rejects.toMatchObject({
      code: 'PARKING_STILL_ACTIVE',
    });
    const response = await adminSave(vehicle, {
      ...setup,
      ends_on: '2026-10-02',
      reason: 'Service ended',
    });
    expect(response.status).toBe(200);
    const ended = (await response.json()) as Vehicle;
    expect(
      (await vehiclesApi.setActive(id, ended.version, false)).parking?.rate_history,
    ).toHaveLength(1);
  });

  it('warns before leaving unsaved parking fields and redirects old contract links', async () => {
    signedIn();
    const user = userEvent.setup();
    const rendered = renderApp({ route: `/vehicles/${id}/edit` });
    await user.type(await screen.findByLabelText(/Monthly vehicle rate/), '200');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    const dialog = await screen.findByRole('dialog', { name: 'Leave this page?' });
    await user.click(within(dialog).getByRole('button', { name: 'Leave without saving' }));
    await screen.findByRole('heading', { name: 'Vehicles', level: 1 });
    rendered.unmount();
    renderApp({ route: '/agreements' });
    expect(await screen.findByRole('heading', { name: 'Vehicles', level: 1 })).toBeInTheDocument();
  });

  it('preserves entered rates on network failure', async () => {
    signedIn();
    server.use(http.post('/api/v1/vehicles/:id/parking', () => HttpResponse.error()));
    const user = userEvent.setup();
    renderApp({ route: `/vehicles/${id}/edit` });
    await screen.findByRole('heading', { name: 'Monthly parking' });
    await user.click(screen.getByRole('combobox', { name: 'Capacity category' }));
    await user.click(await screen.findByRole('option', { name: 'Standard (demo)' }));
    await user.type(screen.getByLabelText(/Billing starts/), '2026-10-01');
    await user.type(screen.getByLabelText(/Monthly vehicle rate/), '200');
    await user.type(screen.getByLabelText(/Reason for this change/), 'Initial rate');
    await user.click(screen.getByRole('button', { name: 'Save monthly parking' }));
    await waitFor(() => expect(screen.getByText(/Could not confirm the save/)).toBeInTheDocument());
    expect(screen.getByLabelText(/Monthly vehicle rate/)).toHaveValue('200');
  });
});
