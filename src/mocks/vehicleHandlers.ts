import { HttpResponse, http, type HttpHandler } from 'msw';

import type { Vehicle, VehicleWrite } from '@/features/vehicles/types';
import type { ApiErrorBody } from '@/lib/api/errors';
import type { Paged } from '@/lib/api/paging';

import { findMockCustomer } from './customerHandlers';
import type { VehicleParking } from '@/features/vehicles/parkingModel';

const BASE = '/api/v1';

function errorResponse(
  status: number,
  code: string,
  message: string,
  extra?: Partial<ApiErrorBody>,
) {
  const body: ApiErrorBody = { code, message, request_id: `mock-veh-${Date.now()}`, ...extra };
  return HttpResponse.json(body, { status });
}

const CUSTOMER_IDS = {
  yuanhang: 'c0000001-0000-4000-8000-000000000001',
  pacific: 'c0000001-0000-4000-8000-000000000002',
  liqiang: 'c0000001-0000-4000-8000-000000000003',
  jinqiao: 'c0000001-0000-4000-8000-000000000005',
} as const;

function makeVehicle(
  partial: Partial<Vehicle> & Pick<Vehicle, 'id' | 'customer_id' | 'vehicle_type'>,
): Vehicle {
  const now = '2026-09-02T12:00:00Z';
  return {
    version: 1,
    customer_name: findMockCustomer(partial.customer_id)?.display_name ?? '',
    unit_number: null,
    plate_number: null,
    plate_jurisdiction: null,
    usdot_number: null,
    is_active: true,
    created_at: now,
    updated_at: now,
    parking: null,
    ...partial,
  };
}

// Synthetic vehicles. Development only. Two trucks share one USDOT number on purpose.
export function seedVehicles(): Vehicle[] {
  return [
    makeVehicle({
      id: 'v0000001-0000-4000-8000-000000000001',
      customer_id: CUSTOMER_IDS.yuanhang,
      vehicle_type: 'truck',
      usdot_number: '1234567',
      unit_number: '12',
    }),
    makeVehicle({
      id: 'v0000001-0000-4000-8000-000000000002',
      customer_id: CUSTOMER_IDS.yuanhang,
      vehicle_type: 'truck',
      usdot_number: '1234567',
      unit_number: '14',
    }),
    makeVehicle({
      id: 'v0000001-0000-4000-8000-000000000003',
      customer_id: CUSTOMER_IDS.yuanhang,
      vehicle_type: 'trailer',
      plate_number: 'TRL 4821',
      plate_jurisdiction: 'CA',
    }),
    makeVehicle({
      id: 'v0000001-0000-4000-8000-000000000004',
      customer_id: CUSTOMER_IDS.pacific,
      vehicle_type: 'combination',
      usdot_number: '2345678',
      unit_number: '7',
      plate_number: '8XYZ123',
      plate_jurisdiction: 'CA',
    }),
    makeVehicle({
      id: 'v0000001-0000-4000-8000-000000000005',
      customer_id: CUSTOMER_IDS.liqiang,
      vehicle_type: 'truck',
      plate_number: '6ABC789',
      plate_jurisdiction: 'CA',
    }),
    makeVehicle({
      id: 'v0000001-0000-4000-8000-000000000006',
      customer_id: CUSTOMER_IDS.pacific,
      vehicle_type: 'truck',
      plate_number: 'OLD 1234',
      plate_jurisdiction: 'CA',
      is_active: false,
    }),
    makeVehicle({
      id: 'v0000001-0000-4000-8000-000000000007',
      customer_id: CUSTOMER_IDS.jinqiao,
      vehicle_type: 'truck',
      usdot_number: '4567890',
      unit_number: '3',
      is_active: false,
    }),
  ];
}

let vehicles: Vehicle[] = seedVehicles();
let nextId = 8;

export function findMockVehicle(id: string): Vehicle | undefined {
  return vehicles.find((vehicle) => vehicle.id === id);
}

export function mockVehicles(): Vehicle[] {
  return vehicles;
}

export function saveMockVehicleParking(id: string, parking: VehicleParking): Vehicle {
  const current = findMockVehicle(id)!;
  const updated = {
    ...current,
    parking,
    version: current.version + 1,
    updated_at: new Date().toISOString(),
  };
  vehicles = vehicles.map((vehicle) => (vehicle.id === id ? updated : vehicle));
  return updated;
}

export function currentMockParking(vehicle: Vehicle): Vehicle {
  if (!vehicle.parking) return vehicle;
  const today = new Date().toISOString().slice(0, 10);
  const applicable = vehicle.parking.rate_history
    .filter((rate) => rate.effective_on <= today)
    .at(-1);
  return {
    ...vehicle,
    parking: {
      ...vehicle.parking,
      monthly_rate: applicable?.monthly_rate ?? vehicle.parking.rate_history[0]!.monthly_rate,
    },
  };
}

export function resetMockVehicles(): void {
  vehicles = seedVehicles();
  nextId = 8;
}

const normalizePlate = (value: string | null | undefined) =>
  (value ?? '').replace(/[^a-z0-9]/gi, '').toUpperCase();

function matchesQuery(vehicle: Vehicle, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const plateNeedle = normalizePlate(needle).toLowerCase();
  const haystack = [
    vehicle.unit_number,
    vehicle.plate_number,
    vehicle.usdot_number,
    vehicle.customer_name,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());
  return haystack.some(
    (value) =>
      value.includes(needle) ||
      (plateNeedle.length >= 2 && normalizePlate(value).toLowerCase().includes(plateNeedle)),
  );
}

function readIfMatch(request: Request): number | undefined {
  const raw = request.headers.get('if-match');
  if (!raw) return undefined;
  const parsed = Number(raw.replace(/"/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

type Fields = Partial<Omit<VehicleWrite, 'customer_id'>>;

// Rules from REQUIREMENTS.md 7.1: a vehicle needs a plate with its jurisdiction, or a USDOT number.
function validate(merged: {
  usdot_number: string | null;
  unit_number: string | null;
  plate_number: string | null;
  plate_jurisdiction: string | null;
}): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  const { usdot_number, unit_number, plate_number, plate_jurisdiction } = merged;
  if (usdot_number && !/^\d{1,8}$/.test(usdot_number)) {
    errors.usdot_number = ['INVALID_USDOT'];
  }
  if (plate_number && !plate_jurisdiction) errors.plate_jurisdiction = ['REQUIRED'];
  if (plate_jurisdiction && !plate_number) errors.plate_number = ['REQUIRED'];
  if (!plate_number && !usdot_number) {
    errors.usdot_number = ['IDENTIFIER_REQUIRED'];
  }
  // A USDOT-only vehicle must have a unit number so it can be told apart from the others.
  if (usdot_number && !plate_number && !unit_number) {
    errors.unit_number = ['REQUIRED'];
  }
  return errors;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

function findDuplicate(
  merged: {
    usdot_number: string | null;
    unit_number: string | null;
    plate_number: string | null;
    plate_jurisdiction: string | null;
  },
  currentId?: string,
): { code: string; field: string } | undefined {
  const others = vehicles.filter((v) => v.is_active && v.id !== currentId);
  if (merged.plate_number && merged.plate_jurisdiction) {
    const plate = normalizePlate(merged.plate_number);
    const jurisdiction = merged.plate_jurisdiction.toUpperCase();
    if (
      others.some(
        (v) =>
          normalizePlate(v.plate_number) === plate &&
          v.plate_jurisdiction?.toUpperCase() === jurisdiction,
      )
    ) {
      return { code: 'PLATE_ALREADY_IN_USE', field: 'plate_number' };
    }
  }
  if (merged.usdot_number && merged.unit_number) {
    if (
      others.some(
        (v) =>
          v.usdot_number === merged.usdot_number &&
          v.unit_number?.toLowerCase() === merged.unit_number?.toLowerCase(),
      )
    ) {
      return { code: 'UNIT_NUMBER_ALREADY_IN_USE', field: 'unit_number' };
    }
  }
  return undefined;
}

export const vehicleHandlers: HttpHandler[] = [
  http.get(`${BASE}/vehicles`, ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q') ?? '';
    const customerId = url.searchParams.get('customer_id');
    const includeInactive = url.searchParams.get('include_inactive') === 'true';
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('page_size') ?? '20')));

    const filtered = vehicles
      // Keep customer names current if a customer was renamed.
      .map((v) => ({
        ...currentMockParking(v),
        customer_name: findMockCustomer(v.customer_id)?.display_name ?? '',
      }))
      .filter((v) => includeInactive || v.is_active)
      .filter((v) => !customerId || v.customer_id === customerId)
      .filter((v) => matchesQuery(v, q))
      .sort(
        (a, b) =>
          a.customer_name.localeCompare(b.customer_name, 'zh-Hans-CN') ||
          (a.unit_number ?? a.plate_number ?? '').localeCompare(
            b.unit_number ?? b.plate_number ?? '',
            undefined,
            { numeric: true },
          ),
      );

    const start = (page - 1) * pageSize;
    const body: Paged<Vehicle> = {
      items: filtered.slice(start, start + pageSize),
      page,
      page_size: pageSize,
      total: filtered.length,
    };
    return HttpResponse.json(body);
  }),

  http.get(`${BASE}/vehicles/:id`, ({ params }) => {
    const vehicle = vehicles.find((candidate) => candidate.id === params.id);
    if (!vehicle) return errorResponse(404, 'VEHICLE_NOT_FOUND', 'Vehicle not found');
    return HttpResponse.json({
      ...currentMockParking(vehicle),
      customer_name: findMockCustomer(vehicle.customer_id)?.display_name ?? '',
    });
  }),

  http.post(`${BASE}/vehicles`, async ({ request }) => {
    const body = (await request.json()) as Partial<VehicleWrite>;
    if (!body.customer_id || !findMockCustomer(body.customer_id)) {
      return errorResponse(422, 'VALIDATION_FAILED', 'Customer is required', {
        field_errors: { customer_id: ['REQUIRED'] },
      });
    }
    const merged = {
      usdot_number: clean(body.usdot_number),
      unit_number: clean(body.unit_number),
      plate_number: clean(body.plate_number),
      plate_jurisdiction: clean(body.plate_jurisdiction),
    };
    const errors = validate(merged);
    if (Object.keys(errors).length > 0) {
      return errorResponse(422, 'VALIDATION_FAILED', 'Some fields are invalid', {
        field_errors: errors,
      });
    }
    const duplicate = findDuplicate(merged);
    if (duplicate) {
      return errorResponse(409, duplicate.code, 'This vehicle is already registered', {
        field_errors: { [duplicate.field]: [duplicate.code] },
      });
    }
    const now = new Date().toISOString();
    const created = makeVehicle({
      id: `v0000001-0000-4000-8000-${String(nextId).padStart(12, '0')}`,
      customer_id: body.customer_id,
      vehicle_type: body.vehicle_type ?? 'truck',
      ...merged,
      created_at: now,
      updated_at: now,
    });
    nextId += 1;
    vehicles = [...vehicles, created];
    return HttpResponse.json(created, { status: 201 });
  }),

  http.patch(`${BASE}/vehicles/:id`, async ({ params, request }) => {
    const index = vehicles.findIndex((candidate) => candidate.id === params.id);
    if (index === -1) return errorResponse(404, 'VEHICLE_NOT_FOUND', 'Vehicle not found');
    const current = vehicles[index]!;

    const expected = readIfMatch(request);
    if (expected === undefined) {
      return errorResponse(428, 'IF_MATCH_REQUIRED', 'If-Match header is required');
    }
    if (expected !== current.version) {
      return errorResponse(412, 'STALE_VERSION', 'This record was changed by someone else');
    }

    const body = (await request.json()) as Fields & { is_active?: boolean };
    const merged = {
      usdot_number: 'usdot_number' in body ? clean(body.usdot_number) : current.usdot_number,
      unit_number: 'unit_number' in body ? clean(body.unit_number) : current.unit_number,
      plate_number: 'plate_number' in body ? clean(body.plate_number) : current.plate_number,
      plate_jurisdiction:
        'plate_jurisdiction' in body ? clean(body.plate_jurisdiction) : current.plate_jurisdiction,
    };
    const errors = validate(merged);
    if (Object.keys(errors).length > 0) {
      return errorResponse(422, 'VALIDATION_FAILED', 'Some fields are invalid', {
        field_errors: errors,
      });
    }
    const willBeActive = body.is_active ?? current.is_active;
    if (
      !willBeActive &&
      current.parking &&
      (!current.parking.ends_on || current.parking.ends_on > new Date().toISOString().slice(0, 10))
    ) {
      return errorResponse(409, 'PARKING_STILL_ACTIVE', 'End monthly parking before archiving');
    }
    if (willBeActive) {
      const duplicate = findDuplicate(merged, current.id);
      if (duplicate) {
        return errorResponse(409, duplicate.code, 'This vehicle is already registered', {
          field_errors: { [duplicate.field]: [duplicate.code] },
        });
      }
    }

    const updated: Vehicle = {
      ...current,
      ...merged,
      vehicle_type: body.vehicle_type ?? current.vehicle_type,
      is_active: willBeActive,
      version: current.version + 1,
      updated_at: new Date().toISOString(),
    };
    vehicles = vehicles.map((candidate, i) => (i === index ? updated : candidate));
    return HttpResponse.json({
      ...updated,
      customer_name: findMockCustomer(updated.customer_id)?.display_name ?? '',
    });
  }),
];
