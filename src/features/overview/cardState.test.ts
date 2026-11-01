import { describe, expect, it, vi } from 'vitest';

import { cardState } from './cardState';

const query = (overrides: Partial<Parameters<typeof cardState>[0]> = {}) => ({
  isPending: false,
  isError: false,
  data: { ok: true } as unknown,
  refetch: vi.fn(),
  ...overrides,
});

describe('cardState', () => {
  it('has data once every query has data', () => {
    expect(cardState(query(), query())).toEqual({
      isPending: false,
      isError: false,
      hasData: true,
      onRetry: expect.any(Function),
    });
  });

  it('is pending, without data, while any one query is still loading', () => {
    const state = cardState(query(), query({ isPending: true, data: undefined }));
    expect(state.isPending).toBe(true);
    expect(state.hasData).toBe(false);
    expect(state.isError).toBe(false);
  });

  it('is an error when any one query failed with nothing to show', () => {
    const state = cardState(query(), query({ isError: true, data: undefined }));
    expect(state.isError).toBe(true);
    expect(state.hasData).toBe(false);
  });

  it('keeps showing earlier data when a background refresh fails', () => {
    const state = cardState(query({ isError: true }));
    expect(state.isError).toBe(false);
    expect(state.hasData).toBe(true);
  });

  it('retries every query exactly once', () => {
    const first = query();
    const second = query({ isError: true, data: undefined });
    cardState(first, second).onRetry();
    expect(first.refetch).toHaveBeenCalledTimes(1);
    expect(second.refetch).toHaveBeenCalledTimes(1);
  });
});
