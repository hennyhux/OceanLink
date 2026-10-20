import { describe, expect, it } from 'vitest';

import { safeReturnTo } from './navigation';

describe('safeReturnTo', () => {
  it('keeps same-site paths, including a search part', () => {
    expect(safeReturnTo('/customers/abc', '/x')).toBe('/customers/abc');
    expect(safeReturnTo('/vehicles?q=12&page=2', '/x')).toBe('/vehicles?q=12&page=2');
  });

  it('falls back when nothing is given', () => {
    expect(safeReturnTo(null, '/x')).toBe('/x');
    expect(safeReturnTo(undefined, '/x')).toBe('/x');
    expect(safeReturnTo('', '/x')).toBe('/x');
  });

  it.each([
    ['another site', 'https://evil.example'],
    ['a protocol-relative link', '//evil.example'],
    ['a backslash trick', '/\\evil.example'],
    ['a relative path', 'customers'],
    ['a tab that browsers remove', '/\t/evil.example'],
    ['a newline', '/\n/evil.example'],
    ['a javascript link', 'javascript:alert(1)'],
  ])('rejects %s', (_name, value) => {
    expect(safeReturnTo(value, '/x')).toBe('/x');
  });
});
