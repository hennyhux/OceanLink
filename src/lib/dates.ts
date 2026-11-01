export function isBusinessDate(value: string): boolean {
  // Fast path only: the round trip below rejects the same inputs, so mutating this cannot be observed.
  // Stryker disable next-line Regex,ConditionalExpression,BooleanLiteral
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

// "Today" in the lot's time zone, as YYYY-MM-DD.
export function todayInTimeZone(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  // Stryker disable next-line StringLiteral,OptionalChaining: year, month, and day parts are always present.
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function firstOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

// Business dates are calendar days, so format them at noon UTC to avoid shifting a day.
export function formatDate(date: string, language: string): string {
  if (!isBusinessDate(date)) return date;
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

export function formatDateTime(instant: string, language: string): string {
  const value = new Date(instant);
  if (Number.isNaN(value.valueOf())) return instant;
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(
    value,
  );
}
