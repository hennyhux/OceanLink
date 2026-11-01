export interface CardState {
  isPending: boolean;
  isError: boolean;
  hasData: boolean;
  onRetry: () => void;
}

interface QueryLike {
  isPending: boolean;
  isError: boolean;
  data?: unknown;
  refetch: () => unknown;
}

// Combines the queries one card needs. The card shows data only once every query has some.
export function cardState(...queries: QueryLike[]): CardState {
  return {
    isPending: queries.some((query) => query.isPending),
    isError: queries.some((query) => query.isError && query.data === undefined),
    hasData: queries.every((query) => query.data !== undefined),
    onRetry: () => queries.forEach((query) => void query.refetch()),
  };
}
