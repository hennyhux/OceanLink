import { http, HttpResponse } from 'msw';
import {
  parkingSchema,
  parkingToWrite,
  type CapacityPool,
  type VehicleParkingWrite,
} from '@/features/vehicles/parkingModel';
import { findMockCustomer } from './customerHandlers';
import {
  currentMockParking,
  findMockVehicle,
  mockVehicles,
  saveMockVehicleParking,
} from './vehicleHandlers';

const pools: CapacityPool[] = [
  {
    id: 'mock-standard',
    label: 'Standard',
    capacity: 10,
    allowed_vehicle_types: ['truck', 'trailer', 'compact'],
  },
  {
    id: 'mock-oversize',
    label: 'Oversize',
    capacity: 10,
    allowed_vehicle_types: ['truck', 'trailer', 'combination'],
  },
];
const fail = (status: number, code: string) =>
  HttpResponse.json({ code, message: code, request_id: 'mock-parking' }, { status });

export const vehicleParkingHandlers = [
  http.get('/api/v1/lots/current/capacity-pools', () => HttpResponse.json(pools)),
  http.post('/api/v1/vehicles/:id/parking', async ({ params, request, cookies }) => {
    const vehicle = findMockVehicle(String(params.id));
    if (!vehicle) return fail(404, 'NOT_FOUND');
    if (request.headers.get('if-match') !== `"${vehicle.version}"`)
      return fail(412, 'STALE_VERSION');
    const body = (await request.json()) as VehicleParkingWrite;
    if (findMockVehicle(vehicle.id)?.version !== vehicle.version) return fail(412, 'STALE_VERSION');
    const parsed = parkingSchema.safeParse({
      ...body,
      ends_on: body.ends_on ?? '',
      rate: (body.monthly_rate?.amount / 100).toFixed(2),
    });
    if (
      !parsed.success ||
      !Number.isSafeInteger(body.monthly_rate?.amount) ||
      body.monthly_rate?.currency !== 'USD'
    )
      return fail(422, 'INVALID_PARKING');
    const write = parkingToWrite(parsed.data);
    const pool = pools.find((item) => item.id === write.pool_id);
    const customer = findMockCustomer(vehicle.customer_id);
    if (
      !customer ||
      ((!vehicle.is_active || !customer.is_active) && !vehicle.parking) ||
      !pool?.allowed_vehicle_types.includes(vehicle.vehicle_type)
    )
      return fail(409, 'INVALID_PARKING');
    const previous = vehicle.parking;
    const latest = previous?.rate_history.at(-1);
    const rateChanged = latest?.monthly_rate.amount !== write.monthly_rate.amount;
    const today = new Date().toISOString().slice(0, 10);
    const admin = cookies.oceanlink_mock_session === '11111111-1111-4111-8111-111111111111';
    if (previous) {
      if (write.starts_on !== previous.starts_on || write.pool_id !== previous.pool_id)
        return fail(409, 'SERVICE_HISTORY_IMMUTABLE');
      if ((rateChanged || write.ends_on !== previous.ends_on) && !admin)
        return fail(403, 'ADMIN_REQUIRED');
      if (
        rateChanged &&
        (write.effective_on <= today || write.effective_on <= latest!.effective_on)
      )
        return fail(409, 'INVALID_EFFECTIVE_DATE');
      if (!rateChanged && write.effective_on !== latest!.effective_on)
        return fail(409, 'INVALID_EFFECTIVE_DATE');
    } else if (write.effective_on !== write.starts_on) return fail(422, 'INVALID_EFFECTIVE_DATE');
    const events: [string, number][] = [[write.starts_on, 1]];
    for (const other of mockVehicles()) {
      const parking = other.parking;
      if (
        other.id === vehicle.id ||
        !parking ||
        parking.pool_id !== write.pool_id ||
        parking.starts_on >= (write.ends_on ?? '9999-12-31') ||
        (parking.ends_on ?? '9999-12-31') <= write.starts_on
      )
        continue;
      events.push([parking.starts_on > write.starts_on ? parking.starts_on : write.starts_on, 1]);
      if (parking.ends_on) events.push([parking.ends_on, -1]);
    }
    let committed = 0;
    for (const [, delta] of events.sort(
      (left, right) => left[0].localeCompare(right[0]) || left[1] - right[1],
    )) {
      committed += delta;
      if (committed > pool.capacity) return fail(409, 'CAPACITY_UNAVAILABLE');
    }
    const history = previous ? [...previous.rate_history] : [];
    if (!previous || rateChanged)
      history.push({
        effective_on: write.effective_on,
        monthly_rate: write.monthly_rate,
        reason: write.reason,
      });
    return HttpResponse.json(
      currentMockParking(
        saveMockVehicleParking(vehicle.id, {
          pool_id: pool.id,
          pool_label: pool.label,
          starts_on: write.starts_on,
          ends_on: write.ends_on,
          monthly_rate: previous?.monthly_rate ?? write.monthly_rate,
          rate_history: history,
          billing_anchor_day: previous?.billing_anchor_day ?? customer.billing_anchor_day ?? 1,
          payment_terms: previous?.payment_terms ?? customer.payment_terms ?? '',
        }),
      ),
    );
  }),
];
