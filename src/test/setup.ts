import '@testing-library/jest-dom/vitest';

import { HttpResponse, http } from 'msw';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';

import { resetMockCustomers } from '@/mocks/customerHandlers';
import { server } from '@/mocks/server';
import { resetMockVehicles } from '@/mocks/vehicleHandlers';
import { resetMockPayments } from '@/mocks/paymentStore';

// Vitest swaps in jsdom's AbortController/AbortSignal, but fetch and Request are Node's and
// reject a foreign signal. Drop signals in tests; cancellation is not under test here.
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
beforeEach(() => {
  // MSW keeps Set-Cookie values between tests. Start every test signed out unless it says otherwise.
  server.use(
    http.get('/api/v1/auth/session', () =>
      HttpResponse.json({ code: 'SESSION_EXPIRED', message: 'Not signed in' }, { status: 401 }),
    ),
  );
});
afterEach(() => {
  server.resetHandlers();
  resetMockCustomers();
  resetMockVehicles();
  resetMockPayments();
  window.localStorage.clear();
});
afterAll(() => server.close());

// jsdom does not implement matchMedia, which MUI's useMediaQuery needs.
// Match min-width queries so tests render the desktop layout by default.
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
