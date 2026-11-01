// Plain rules behind the dashboard search, kept apart from the screen so they are easy to test.

export type SearchGroupKey = 'customers' | 'vehicles' | 'payments';
export type SearchFilter = SearchGroupKey | 'all';

export interface HighlightParts {
  before: string;
  match: string;
  after: string;
}

// Splits text around the first case-insensitive match of the query, or returns null.
export function highlightParts(text: string, query: string): HighlightParts | null {
  const needle = query.trim().toLowerCase();
  if (!needle) return null;
  const index = text.toLowerCase().indexOf(needle);
  if (index < 0) return null;
  const end = index + needle.length;
  return { before: text.slice(0, index), match: text.slice(index, end), after: text.slice(end) };
}

export interface GroupStatus {
  key: SearchGroupKey;
  isError: boolean;
  // Undefined until this query has a result for the current text.
  total: number | undefined;
}

// A group is worth showing while it is loading, has failed, or has at least one match.
export function groupHasMatches(group: GroupStatus, settled: boolean): boolean {
  return group.isError || !settled || (group.total ?? 0) > 0;
}

export function isSettled(groups: GroupStatus[]): boolean {
  return groups.every((group) => group.isError || group.total !== undefined);
}

export function totalMatches(groups: GroupStatus[]): number {
  return groups.reduce((sum, group) => sum + (group.total ?? 0), 0);
}

// The filter from the URL, unless it names a group with nothing to show.
export function resolveFilter(
  requested: string,
  groups: GroupStatus[],
  settled: boolean,
): SearchFilter {
  const group = groups.find((item) => item.key === requested);
  return group && groupHasMatches(group, settled) ? group.key : 'all';
}

export function visibleGroups<T extends GroupStatus>(
  groups: T[],
  filter: SearchFilter,
  settled: boolean,
): T[] {
  return filter === 'all'
    ? groups.filter((group) => groupHasMatches(group, settled))
    : groups.filter((group) => group.key === filter);
}

export type SearchSummary =
  | { kind: 'searching' }
  // `empty` means every group answered with nothing, so one "no matches" message replaces the groups.
  | { kind: 'done'; count: number; partial: boolean; empty: boolean };

export function searchSummary(groups: GroupStatus[]): SearchSummary {
  if (!isSettled(groups)) return { kind: 'searching' };
  const count = totalMatches(groups);
  const partial = groups.some((group) => group.isError);
  return { kind: 'done', count, partial, empty: count === 0 && !partial };
}

// "Show all" only helps when the group was cut short.
export function needsShowAll(total: number | undefined, shown: number): boolean {
  return (total ?? 0) > shown;
}

// "/" jumps to search unless the user is typing somewhere or a dialog is open.
export function isSearchShortcut(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>,
  insideEditableOrDialog: boolean,
): boolean {
  return (
    event.key === '/' &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !insideEditableOrDialog
  );
}
