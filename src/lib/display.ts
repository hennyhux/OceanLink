import type { MoneyTone } from '@/components/Money';

// Positive means the customer owes money, negative means they have credit.
export function balanceTone(cents: number): MoneyTone {
  if (cents > 0) return 'owed';
  if (cents < 0) return 'credit';
  return 'neutral';
}

export function balanceLabelKey(cents: number): 'balance.owes' | 'balance.credit' {
  return cents < 0 ? 'balance.credit' : 'balance.owes';
}

// "Pacific Haul LLC" becomes "PH"; Chinese names use their first character.
export function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  if (/[\u3400-\u9fff]/.test(trimmed[0] ?? '')) return trimmed[0]!;
  const words = trimmed.split(/\s+/).filter((word) => /[a-z0-9]/i.test(word[0] ?? ''));
  return (
    words
      .slice(0, 2)
      .map((word) => word[0])
      .join('') || trimmed[0]!
  ).toUpperCase();
}
