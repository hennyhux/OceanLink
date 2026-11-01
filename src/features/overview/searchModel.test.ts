import { describe, expect, it } from 'vitest';

import {
  groupHasMatches,
  highlightParts,
  isSearchShortcut,
  isSettled,
  needsShowAll,
  resolveFilter,
  searchSummary,
  totalMatches,
  visibleGroups,
  type GroupStatus,
  type SearchGroupKey,
} from './searchModel';

const group = (key: SearchGroupKey, total: number | undefined, isError = false): GroupStatus => ({
  key,
  total,
  isError,
});

const keys = (groups: GroupStatus[]) => groups.map((item) => item.key);

describe('highlightParts', () => {
  it('splits around a case-insensitive match and keeps the original casing', () => {
    expect(highlightParts('Pacific Haul LLC', 'haul')).toEqual({
      before: 'Pacific ',
      match: 'Haul',
      after: ' LLC',
    });
  });

  it('matches at the very start of the text', () => {
    expect(highlightParts('Pacific Haul', 'PAC')).toEqual({
      before: '',
      match: 'Pac',
      after: 'ific Haul',
    });
  });

  it('ignores spaces around the query and marks only the first match', () => {
    expect(highlightParts('WIRE-1001 · 1001', '  1001 ')).toEqual({
      before: 'WIRE-',
      match: '1001',
      after: ' · 1001',
    });
  });

  it('works with Chinese text', () => {
    expect(highlightParts('金桥物流', '金桥')).toEqual({
      before: '',
      match: '金桥',
      after: '物流',
    });
  });

  it.each([
    ['no match', 'Pacific', 'harbor'],
    ['an empty query', 'Pacific', ''],
    ['a query of only spaces', 'Pacific', '   '],
  ])('returns null for %s', (_, text, query) => {
    expect(highlightParts(text, query)).toBeNull();
  });
});

describe('groupHasMatches', () => {
  it.each([
    ['has matches', group('customers', 2), true, true],
    ['has no matches once settled', group('customers', 0), true, false],
    ['is still loading', group('customers', undefined), false, true],
    ['has no matches yet but others are loading', group('customers', 0), false, true],
    ['failed', group('customers', undefined, true), true, true],
  ])('a group that %s -> %s', (_, status, settled, expected) => {
    expect(groupHasMatches(status, settled)).toBe(expected);
  });
});

describe('isSettled and totalMatches', () => {
  it('is settled when every group has answered or failed', () => {
    expect(isSettled([group('customers', 0), group('vehicles', undefined, true)])).toBe(true);
  });

  it('is not settled while any group is still waiting', () => {
    expect(isSettled([group('customers', 3), group('vehicles', undefined)])).toBe(false);
  });

  it('adds up totals and counts unanswered groups as zero', () => {
    expect(
      totalMatches([group('customers', 3), group('vehicles', undefined), group('payments', 4)]),
    ).toBe(7);
  });
});

describe('resolveFilter', () => {
  const groups = [group('customers', 1), group('vehicles', 0), group('payments', 2)];

  it('uses the group named in the URL when it has matches', () => {
    expect(resolveFilter('payments', groups, true)).toBe('payments');
  });

  it('falls back to all when the named group has nothing to show', () => {
    expect(resolveFilter('vehicles', groups, true)).toBe('all');
  });

  it('keeps the named group while results are still loading', () => {
    expect(resolveFilter('vehicles', groups, false)).toBe('vehicles');
  });

  it.each(['', 'invoices', 'all'])('falls back to all for %j', (requested) => {
    expect(resolveFilter(requested, groups, true)).toBe('all');
  });
});

describe('visibleGroups', () => {
  const groups = [group('customers', 1), group('vehicles', 0), group('payments', 2)];

  it('shows every group with matches, in order, when the filter is all', () => {
    expect(keys(visibleGroups(groups, 'all', true))).toEqual(['customers', 'payments']);
  });

  it('shows every group while results are still loading', () => {
    expect(keys(visibleGroups(groups, 'all', false))).toEqual([
      'customers',
      'vehicles',
      'payments',
    ]);
  });

  it('shows only the chosen group', () => {
    expect(keys(visibleGroups(groups, 'payments', true))).toEqual(['payments']);
  });
});

describe('searchSummary', () => {
  it('is searching until every group has answered', () => {
    expect(searchSummary([group('customers', 2), group('vehicles', undefined)])).toEqual({
      kind: 'searching',
    });
  });

  it('reports the total across groups', () => {
    expect(searchSummary([group('customers', 2), group('vehicles', 3)])).toEqual({
      kind: 'done',
      count: 5,
      partial: false,
      empty: false,
    });
  });

  it('is empty only when every group answered with nothing', () => {
    expect(searchSummary([group('customers', 0), group('vehicles', 0)])).toEqual({
      kind: 'done',
      count: 0,
      partial: false,
      empty: true,
    });
  });

  it('is partial, and never "empty", when a group failed', () => {
    expect(searchSummary([group('customers', undefined, true), group('vehicles', 0)])).toEqual({
      kind: 'done',
      count: 0,
      partial: true,
      empty: false,
    });
  });
});

describe('needsShowAll', () => {
  it.each([
    [7, 5, true],
    [5, 5, false],
    [0, 0, false],
    [undefined, 0, false],
  ])('total %s with %i shown -> %s', (total, shown, expected) => {
    expect(needsShowAll(total, shown)).toBe(expected);
  });
});

describe('isSearchShortcut', () => {
  const key = (overrides: Partial<KeyboardEvent> = {}) => ({
    key: '/',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...overrides,
  });

  it('accepts a plain "/" outside a text field', () => {
    expect(isSearchShortcut(key(), false)).toBe(true);
  });

  it('leaves "/" alone while typing or inside a dialog', () => {
    expect(isSearchShortcut(key(), true)).toBe(false);
  });

  it.each([
    ['another key', { key: 'k' }],
    ['Ctrl+/', { ctrlKey: true }],
    ['Cmd+/', { metaKey: true }],
    ['Alt+/', { altKey: true }],
  ])('ignores %s', (_, overrides) => {
    expect(isSearchShortcut(key(overrides), false)).toBe(false);
  });
});
