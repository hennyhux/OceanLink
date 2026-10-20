import type { Vehicle } from '@/features/vehicles/types';
import type { MonthlyCharge } from '@/features/billing/model';

const iso = (value: Date) => value.toISOString().slice(0, 10);
const daysBetween = (start: string, end: string) =>
  (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000;
function boundary(year: number, month: number, anchor: number): Date {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(anchor, lastDay)));
}

export function monthlyCharges(vehicles: Vehicle[], through: string): MonthlyCharge[] {
  const charges: MonthlyCharge[] = [];
  for (const vehicle of vehicles) {
    const parking = vehicle.parking;
    if (!parking || parking.starts_on > through) continue;
    const start = new Date(`${parking.starts_on}T00:00:00Z`);
    const year = start.getUTCFullYear();
    let month = start.getUTCMonth();
    if (iso(boundary(year, month, parking.billing_anchor_day)) > parking.starts_on) month -= 1;
    const rates = [...parking.rate_history].sort((left, right) =>
      left.effective_on.localeCompare(right.effective_on),
    );
    for (;;) {
      const periodStart = iso(boundary(year, month, parking.billing_anchor_day));
      const periodEnd = iso(boundary(year, month + 1, parking.billing_anchor_day));
      if (periodStart > through || (parking.ends_on && periodStart >= parking.ends_on)) break;
      const serviceStart = periodStart > parking.starts_on ? periodStart : parking.starts_on;
      const serviceEnd =
        parking.ends_on && parking.ends_on < periodEnd ? parking.ends_on : periodEnd;
      if (serviceStart <= through && serviceStart < serviceEnd) {
        const periods = [
          serviceStart,
          ...rates
            .map((rate) => rate.effective_on)
            .filter((date) => date > serviceStart && date < serviceEnd),
          serviceEnd,
        ];
        let weighted = 0n;
        for (let index = 0; index < periods.length - 1; index += 1) {
          const from = periods[index]!;
          const until = periods[index + 1]!;
          const rate =
            rates.filter((item) => item.effective_on <= from).at(-1)?.monthly_rate ??
            rates[0]?.monthly_rate ??
            parking.monthly_rate;
          weighted += BigInt(rate.amount) * BigInt(daysBetween(from, until));
        }
        const periodDays = daysBetween(periodStart, periodEnd);
        const denominator = BigInt(periodDays);
        const amount = Number((weighted * 2n + denominator) / (denominator * 2n));
        charges.push({
          key: `${vehicle.id}:${periodStart}:${periodEnd}`,
          vehicle_id: vehicle.id,
          vehicle_label: vehicle.unit_number ?? vehicle.plate_number ?? vehicle.usdot_number ?? '',
          starts_on: serviceStart,
          ends_on: serviceEnd,
          service_days: daysBetween(serviceStart, serviceEnd),
          period_days: periodDays,
          amount: { amount, currency: 'USD' },
        });
      }
      month += 1;
    }
  }
  return charges;
}
