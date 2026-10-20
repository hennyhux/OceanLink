export interface Money {
  amount: number;
  currency: 'USD';
}

export function usdToCents(value: string): number {
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(value.trim())) throw new Error('Invalid USD amount');
  const [whole = '0', fraction = ''] = value.trim().split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function formatMoney(amount: number, language: string): string {
  return new Intl.NumberFormat(language, { style: 'currency', currency: 'USD' }).format(
    amount / 100,
  );
}
