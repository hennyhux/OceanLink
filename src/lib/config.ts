const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1';

// Resolve against the page origin so the same code works in the browser and in jsdom tests.
const apiBaseUrl =
  typeof window !== 'undefined'
    ? new URL(rawBaseUrl, window.location.origin).toString()
    : rawBaseUrl;

const mocksRequested = import.meta.env.VITE_ENABLE_MOCKS === 'true';

if (mocksRequested && import.meta.env.PROD) {
  throw new Error('Mock mode is not allowed in a production build.');
}

export const config = {
  apiBaseUrl: apiBaseUrl.replace(/\/+$/, ''),
  // Mocks only run in a dev build and only when asked for explicitly.
  mocksEnabled: mocksRequested && import.meta.env.DEV,
  languageStorageKey: 'oceanlink.language',
} as const;
