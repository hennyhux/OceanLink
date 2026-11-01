import '@testing-library/jest-dom/vitest';

import { configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { resetDb } from '@/mocks/db';
import { server } from '@/mocks/server';

// Pages load lazily; the first load in a test file can take more than a second.
configure({ asyncUtilTimeout: 4000 });

// Node's fetch rejects jsdom's AbortSignal. Drop signals in tests; cancellation is not under test.
const NativeRequest = globalThis.Request;
class TestRequest extends NativeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(input, init ? { ...init, signal: undefined } : init);
  }
}
globalThis.Request = TestRequest;
const nativeFetch = globalThis.fetch;
globalThis.fetch = (input, init) =>
  nativeFetch(input, init ? { ...init, signal: undefined } : init);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  // A fresh database also drops every session, so each test starts signed out.
  resetDb();
  window.localStorage.clear();
});
afterAll(() => server.close());

// jsdom has no matchMedia. Match min-width queries so tests get the wide desktop layout.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: /min-width/.test(query),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

window.scrollTo = () => {};
