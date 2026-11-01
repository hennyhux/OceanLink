import type { MonthlyCharge } from '@/features/billing/types';
import type { Vehicle } from '@/features/vehicles/types';

// Billing period math from BACKEND_REQUIREMENTS 6.7. Development mock only, but the backend
// team uses it as a reference, so keep it readable and keep its tests passing.

const iso = (value: Date) => value.toISOString().slice(0, 10);
const daysBetween = (start: string, end: string) =>
  Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);

// The anchor day in a given month, or the month's last day when the month is too short.
function boundary(year: number, month: number, anchor: number): Date {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(anchor, lastDay)));
}

export function vehicleLabel(vehicle: Vehicle): string {
  return vehicle.unit_number ?? vehicle.plate_number ?? vehicle.usdot_number ?? '';
}

// Every monthly charge from the service start through `through` (billing is in advance).
export function monthlyCharges(vehicles: Vehicle[], through: string): MonthlyCharge[] {
  const charges: MonthlyCharge[] = [];
  for (const vehicle of vehicles) {
    const parking = vehicle.parking;
    if (!parking || parking.starts_on > through) continue;
    const start = new Date(`${parking.starts_on}T00:00:00Z`);
    const year = start.getUTCFullYear();
    const anchor = start.getUTCDate();
    const rates = [...parking.rate_history].sort((a, b) =>
      a.effective_on.localeCompare(b.effective_on),
    );

    for (let month = start.getUTCMonth(); ; month += 1) {
      const periodStart = iso(boundary(year, month, anchor));
      const periodEnd = iso(boundary(year, month + 1, anchor));
      if (periodStart > through) break;
      if (parking.ends_on && periodStart >= parking.ends_on) break;

      const serviceStart = periodStart > parking.starts_on ? periodStart : parking.starts_on;
      const serviceEnd =
        parking.ends_on && parking.ends_on < periodEnd ? parking.ends_on : periodEnd;
      if (serviceStart >= serviceEnd) continue;

      // Split the service days at any rate change inside the period.
      const cuts = [
        serviceStart,
        ...rates
          .map((rate) => rate.effective_on)
          .filter((date) => date > serviceStart && date < serviceEnd),
        serviceEnd,
      ];
      let weighted = 0n;
      for (let index = 0; index < cuts.length - 1; index += 1) {
        const from = cuts[index]!;
        const until = cuts[index + 1]!;
        const rate =
          rates.filter((item) => item.effective_on <= from).at(-1)?.monthly_rate ??
          rates[0]?.monthly_rate ??
          parking.monthly_rate;
        weighted += BigInt(rate.amount) * BigInt(daysBetween(from, until));
      }
      // Round half up, once per line.
      const periodDays = daysBetween(periodStart, periodEnd);
      const days = BigInt(periodDays);
      const amount = Number((weighted * 2n + days) / (days * 2n));

      charges.push({
        key: `${vehicle.id}:${periodStart}:${periodEnd}`,
        vehicle_id: vehicle.id,
        vehicle_label: vehicleLabel(vehicle),
        starts_on: serviceStart,
        ends_on: serviceEnd,
        service_days: daysBetween(serviceStart, serviceEnd),
        period_days: periodDays,
        amount: { amount, currency: 'USD' },
      });
    }
  }
  return charges;
}
