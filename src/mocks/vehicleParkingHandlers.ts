import { http, HttpResponse } from 'msw';
import {
  parkingSchema,
  parkingToWrite,
  type VehicleParkingWrite,
} from '@/features/vehicles/parkingModel';
import { findMockCustomer } from './customerHandlers';
import { currentMockParking, findMockVehicle, saveMockVehicleParking } from './vehicleHandlers';

const fail = (status: number, code: string) =>
  HttpResponse.json({ code, message: code, request_id: 'mock-parking' }, { status });

export const vehicleParkingHandlers = [
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
    const customer = findMockCustomer(vehicle.customer_id);
    if (!customer || ((!vehicle.is_active || !customer.is_active) && !vehicle.parking))
      return fail(409, 'INVALID_PARKING');
    const previous = vehicle.parking;
    const latest = previous?.rate_history.at(-1);
    const rateChanged = latest?.monthly_rate.amount !== write.monthly_rate.amount;
    const today = new Date().toISOString().slice(0, 10);
    const admin = cookies.oceanlink_mock_session === '11111111-1111-4111-8111-111111111111';
    if (previous) {
      if (write.starts_on !== previous.starts_on) return fail(409, 'SERVICE_HISTORY_IMMUTABLE');
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
          starts_on: write.starts_on,
          ends_on: write.ends_on,
          monthly_rate: previous?.monthly_rate ?? write.monthly_rate,
          rate_history: history,
        }),
      ),
    );
  }),
];
