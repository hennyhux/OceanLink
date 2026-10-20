import { describe, expect, it } from 'vitest';

import en from './locales/en.json';
import zhCN from './locales/zh-CN.json';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : flatten(value, `${prefix}${key}.`),
  );
}

// Every source file, read as text, so we can look for t('...') calls.
const sources = import.meta.glob('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

// Plural keys are stored as key_one / key_other, so a plain key is valid if either exists.
function hasKey(keys: Set<string>, key: string): boolean {
  return keys.has(key) || keys.has(`${key}_one`) || keys.has(`${key}_other`);
}

describe('translations', () => {
  const enKeys = new Set(flatten(en as Tree));
  const zhKeys = new Set(flatten(zhCN as Tree));

  it('has the same keys in English and Chinese', () => {
    const missingInZh = [...enKeys].filter((key) => !zhKeys.has(key));
    const missingInEn = [...zhKeys].filter((key) => !enKeys.has(key));
    expect({ missingInZh, missingInEn }).toEqual({ missingInZh: [], missingInEn: [] });
  });

  it('defines every key that the code asks for', () => {
    const used = new Set<string>();
    const callPattern = /\bt\(\s*['"]([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)['"]/g;
    // Keys passed around as plain strings, such as messageKey: 'customers.saved'.
    const literalPattern =
      /['"]((?:common|customers|vehicles|payments|parking|account|auth|app|nav|overview)\.[a-zA-Z0-9_.]+)['"]/g;

    for (const [file, text] of Object.entries(sources)) {
      if (file.includes('.test.') || file.includes('/mocks/')) continue;
      for (const match of text.matchAll(callPattern)) used.add(match[1]!);
      for (const match of text.matchAll(literalPattern)) used.add(match[1]!);
    }

    // Guards against the scan silently finding nothing.
    expect(used.size).toBeGreaterThan(100);

    const missing = [...used].filter((key) => !hasKey(enKeys, key) || !hasKey(zhKeys, key));
    expect(missing).toEqual([]);
  });
});
