import { HttpResponse, http } from 'msw';

import type {
  ParkingWrite,
  Vehicle,
  VehicleCreate,
  VehicleParking,
  VehicleType,
} from '@/features/vehicles/types';
import { VEHICLE_TYPES } from '@/features/vehicles/types';
import { isBusinessDate } from '@/lib/dates';

import { db, findCustomer, findVehicle, today, vehicleView } from '../db';
import { BASE, checkVersion, clean, fail, fieldError, guard, isTrue, paged } from './util';

interface Identity {
  usdot_number: string | null;
  unit_number: string | null;
  plate_number: string | null;
  plate_jurisdiction: string | null;
}

const normalizePlate = (value: string | null | undefined) =>
  (value ?? '').replace(/[^a-z0-9]/gi, '').toUpperCase();

function matches(item: Vehicle, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const plateNeedle = normalizePlate(needle);
  return [item.unit_number, item.plate_number, item.usdot_number, item.customer_name]
    .filter((value): value is string => Boolean(value))
    .some(
      (value) =>
        value.toLowerCase().includes(needle) ||
        (plateNeedle.length >= 2 && normalizePlate(value).includes(plateNeedle)),
    );
}

// Rules from REQUIREMENTS 7.1.
function identityErrors(v: Identity): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  if (v.usdot_number && !/^\d{1,8}$/.test(v.usdot_number)) errors.usdot_number = ['INVALID_USDOT'];
  if (v.plate_number && !v.plate_jurisdiction) errors.plate_jurisdiction = ['REQUIRED'];
  if (v.plate_jurisdiction && !v.plate_number) errors.plate_number = ['REQUIRED'];
  if (!v.plate_number && !v.usdot_number) errors.usdot_number = ['IDENTIFIER_REQUIRED'];
  if (v.usdot_number && !v.plate_number && !v.unit_number) errors.unit_number = ['REQUIRED'];
  return errors;
}

function duplicate(v: Identity, exceptId?: string): Response | undefined {
  const others = db.vehicles.filter((item) => item.is_active && item.id !== exceptId);
  if (
    v.plate_number &&
    v.plate_jurisdiction &&
    others.some(
      (item) =>
        normalizePlate(item.plate_number) === normalizePlate(v.plate_number) &&
        item.plate_jurisdiction?.toUpperCase() === v.plate_jurisdiction?.toUpperCase(),
    )
  ) {
    return fieldError(409, 'PLATE_ALREADY_IN_USE', 'plate_number');
  }
  if (
    v.usdot_number &&
    v.unit_number &&
    others.some(
      (item) =>
        item.usdot_number === v.usdot_number &&
        item.unit_number?.toLowerCase() === v.unit_number?.toLowerCase(),
    )
  ) {
    return fieldError(409, 'UNIT_NUMBER_ALREADY_IN_USE', 'unit_number');
  }
  return undefined;
}

// Basic shape checks shared by first setups and later changes (BACKEND_REQUIREMENTS 6.5).
function parkingShapeError(body: Partial<ParkingWrite> | undefined): string | undefined {
  if (!body || !isBusinessDate(body.starts_on ?? '') || !isBusinessDate(body.effective_on ?? '')) {
    return 'starts_on';
  }
  if (body.ends_on !== null && body.ends_on !== undefined) {
    if (!isBusinessDate(body.ends_on) || body.ends_on <= body.starts_on!) return 'ends_on';
  }
  const amount = body.monthly_rate?.amount;
  if (
    typeof amount !== 'number' ||
    !Number.isSafeInteger(amount) ||
    amount < 0 ||
    amount > 999_999_999 ||
    body.monthly_rate?.currency !== 'USD'
  ) {
    return 'monthly_rate';
  }
  const reason = body.reason?.trim() ?? '';
  if (!reason || reason.length > 1000) return 'reason';
  return undefined;
}

function firstParking(write: ParkingWrite): VehicleParking {
  return {
    starts_on: write.starts_on,
    ends_on: write.ends_on ?? null,
    monthly_rate: write.monthly_rate,
    rate_history: [
      {
        effective_on: write.effective_on,
        monthly_rate: write.monthly_rate,
        reason: write.reason.trim(),
      },
    ],
  };
}

function save(item: Vehicle, changes: Partial<Vehicle>): Vehicle {
  Object.assign(item, changes, { version: item.version + 1, updated_at: new Date().toISOString() });
  return item;
}

export const vehicleHandlers = [
  http.get(`${BASE}/vehicles`, ({ request, cookies }) => {
    const result = guard(request, cookies);
    if ('response' in result) return result.response;
    const url = new URL(request.url);
    const customerId = url.searchParams.get('customer_id');
    const items = db.vehicles
      .map(vehicleView)
      .filter((item) => isTrue(url, 'include_inactive') || item.is_active)
      .filter((item) => !customerId || item.customer_id === customerId)
      .filter((item) => matches(item, url.searchParams.get('q') ?? ''));
    return HttpResponse.json(paged(items, url));
  }),

  http.post(`${BASE}/vehicles`, async ({ request, cookies }) => {
    const result = guard(request, cookies, { write: true });
    if ('response' in result) return result.response;
    const body = (await request.json()) as Partial<VehicleCreate>;
    const owner = findCustomer(body.customer_id ?? '');
    if (!owner) return fieldError(422, 'VALIDATION_FAILED', 'customer_id', 'REQUIRED');
    if (!VEHICLE_TYPES.includes(body.vehicle_type as VehicleType)) {
      return fieldError(422, 'VALIDATION_FAILED', 'vehicle_type', 'REQUIRED');
    }
    const identity: Identity = {
      usdot_number: clean(body.usdot_number),
      unit_number: clean(body.unit_number),
      plate_number: clean(body.plate_number),
      plate_jurisdiction: clean(body.plate_jurisdiction)?.toUpperCase() ?? null,
    };
    const errors = identityErrors(identity);
    if (Object.keys(errors).length) return fail(422, 'VALIDATION_FAILED', { field_errors: errors });
    const taken = duplicate(identity);
    if (taken) return taken;

    // Parking is validated before anything is saved, so a bad setup leaves no vehicle behind.
    let parking: VehicleParking | null = null;
    if (body.parking !== undefined) {
      if (
        parkingShapeError(body.parking) ||
        body.parking.effective_on !== body.parking.starts_on ||
        !owner.is_active
      ) {
        return fail(422, 'INVALID_PARKING');
      }
      parking = firstParking(body.parking);
    }
    const now = new Date().toISOString();
    const created: Vehicle = {
      id: crypto.randomUUID(),
      version: 1,
      customer_id: owner.id,
      customer_name: owner.display_name,
      vehicle_type: body.vehicle_type as VehicleType,
      ...identity,
      is_active: true,
      created_at: now,
      updated_at: now,
      parking,
    };
    db.vehicles.push(created);
    return HttpResponse.json(vehicleView(created), { status: 201 });
  }),

  http.get(`${BASE}/vehicles/:id`, ({ request, cookies, params }) => {
    const result = guard(request, cookies);
    if ('response' in result) return result.response;
    const item = findVehicle(String(params.id));
    return item ? HttpResponse.json(vehicleView(item)) : fail(404, 'VEHICLE_NOT_FOUND');
  }),

  http.patch(`${BASE}/vehicles/:id`, async ({ request, cookies, params }) => {
    const result = guard(request, cookies, { write: true });
    if ('response' in result) return result.response;
    const item = findVehicle(String(params.id));
    if (!item) return fail(404, 'VEHICLE_NOT_FOUND');
    const stale = checkVersion(request, item.version);
    if (stale) return stale;
    const body = (await request.json()) as Record<string, unknown>;
    if ('customer_id' in body)
      return fieldError(422, 'VALIDATION_FAILED', 'customer_id', 'NOT_ALLOWED');

    const identity: Identity = {
      usdot_number: 'usdot_number' in body ? clean(body.usdot_number) : item.usdot_number,
      unit_number: 'unit_number' in body ? clean(body.unit_number) : item.unit_number,
      plate_number: 'plate_number' in body ? clean(body.plate_number) : item.plate_number,
      plate_jurisdiction:
        'plate_jurisdiction' in body
          ? (clean(body.plate_jurisdiction)?.toUpperCase() ?? null)
          : item.plate_jurisdiction,
    };
    const errors = identityErrors(identity);
    if (Object.keys(errors).length) return fail(422, 'VALIDATION_FAILED', { field_errors: errors });
    const isActive = typeof body.is_active === 'boolean' ? body.is_active : item.is_active;
    if (isActive) {
      const taken = duplicate(identity, item.id);
      if (taken) return taken;
    }
    if (!isActive && item.is_active && item.parking) {
      const ended = item.parking.ends_on && item.parking.ends_on <= today();
      if (!ended) return fail(409, 'PARKING_STILL_ACTIVE');
    }
    const vehicleType =
      typeof body.vehicle_type === 'string' &&
      VEHICLE_TYPES.includes(body.vehicle_type as VehicleType)
        ? (body.vehicle_type as VehicleType)
        : item.vehicle_type;
    return HttpResponse.json(
      vehicleView(save(item, { ...identity, vehicle_type: vehicleType, is_active: isActive })),
    );
  }),

  http.post(`${BASE}/vehicles/:id/parking`, async ({ request, cookies, params }) => {
    const result = guard(request, cookies, { write: true });
    if ('response' in result) return result.response;
    const item = findVehicle(String(params.id));
    if (!item) return fail(404, 'VEHICLE_NOT_FOUND');
    const stale = checkVersion(request, item.version);
    if (stale) return stale;
    const body = (await request.json()) as ParkingWrite;
    const badField = parkingShapeError(body);
    if (badField) return fieldError(422, 'VALIDATION_FAILED', badField, 'INVALID');

    const previous = item.parking;
    if (!previous) {
      const owner = findCustomer(item.customer_id);
      if (!item.is_active || !owner?.is_active) return fail(409, 'INVALID_PARKING');
      if (body.effective_on !== body.starts_on) return fail(422, 'INVALID_EFFECTIVE_DATE');
      return HttpResponse.json(vehicleView(save(item, { parking: firstParking(body) })));
    }

    const latest = previous.rate_history.at(-1)!;
    const rateChanged = latest.monthly_rate.amount !== body.monthly_rate.amount;
    const endChanged = (body.ends_on ?? null) !== previous.ends_on;
    if (body.starts_on !== previous.starts_on) return fail(409, 'SERVICE_HISTORY_IMMUTABLE');
    if ((rateChanged || endChanged) && result.actor.role !== 'admin') {
      return fail(403, 'ADMIN_REQUIRED');
    }
    if (rateChanged && (body.effective_on <= today() || body.effective_on <= latest.effective_on)) {
      return fail(409, 'INVALID_EFFECTIVE_DATE');
    }
    if (!rateChanged && body.effective_on !== latest.effective_on) {
      return fail(409, 'INVALID_EFFECTIVE_DATE');
    }
    const history = rateChanged
      ? [
          ...previous.rate_history,
          {
            effective_on: body.effective_on,
            monthly_rate: body.monthly_rate,
            reason: body.reason.trim(),
          },
        ]
      : previous.rate_history;
    return HttpResponse.json(
      vehicleView(
        save(item, {
          parking: { ...previous, ends_on: body.ends_on ?? null, rate_history: history },
        }),
      ),
    );
  }),
];
