import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import en from './locales/en.json';
import zhCN from './locales/zh-CN.json';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : flatten(value, `${prefix}${key}.`),
  );
}

// Plural forms differ by language (English has _one, Chinese only _other).
const base = (key: string) => key.replace(/_(one|other)$/, '');
const enKeys = new Set(flatten(en as Tree).map(base));
const zhKeys = new Set(flatten(zhCN as Tree).map(base));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'mocks' ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

// Every quoted string that looks like a translation key in a namespace we own.
// MUI palette paths such as 'common.white' share a namespace name but are not text.
const NOT_TEXT = new Set(['common.white', 'common.black']);
const NAMESPACES = Object.keys(en);
const used = new Set<string>();
for (const file of sourceFiles(join(process.cwd(), 'src'))) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(/['"`]([a-z][a-zA-Z]*(?:\.[a-zA-Z0-9_]+)+)['"`]/g)) {
    const key = match[1]!;
    if (NAMESPACES.includes(key.split('.')[0]!) && !NOT_TEXT.has(key)) used.add(key);
  }
}

describe('translations', () => {
  it('has the same keys in English and Chinese', () => {
    expect([...enKeys].filter((key) => !zhKeys.has(key))).toEqual([]);
    expect([...zhKeys].filter((key) => !enKeys.has(key))).toEqual([]);
  });

  it('has every key the code uses', () => {
    expect([...used].filter((key) => !enKeys.has(key)).sort()).toEqual([]);
  });

  it('never uses em dashes (project writing rule)', () => {
    for (const text of [JSON.stringify(en), JSON.stringify(zhCN)]) {
      expect(text).not.toMatch(/\u2014|\u2015/);
    }
  });
});
