export interface Money {
  amount: number;
  currency: 'USD';
}

// Up to 7 whole dollars digits and 2 cents digits, no sign.
export const USD_INPUT = /^\d{1,7}(\.\d{1,2})?$/;

export function isUsdInput(value: string): boolean {
  return USD_INPUT.test(value.trim());
}

// Converts typed dollars to integer cents without floating point math.
export function usdToCents(value: string): number {
  const trimmed = value.trim();
  if (!USD_INPUT.test(trimmed)) throw new Error('Invalid USD amount');
  // Stryker disable next-line StringLiteral: split always yields a first part, so this default never applies.
  const [whole = '0', fraction = ''] = trimmed.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function centsToInput(cents: number): string {
  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, '0');
  return `${whole}.${fraction}`;
}

export function usd(amount: number): Money {
  return { amount, currency: 'USD' };
}

export function formatMoney(cents: number, language: string): string {
  return new Intl.NumberFormat(language, { style: 'currency', currency: 'USD' }).format(
    cents / 100,
  );
}
