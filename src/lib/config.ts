const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1';

// Resolve against the page origin so the same code works in the browser and in jsdom tests.
const apiBaseUrl =
  typeof window !== 'undefined'
    ? new URL(rawBaseUrl, window.location.origin).toString()
    : rawBaseUrl;

const mocksRequested = import.meta.env.VITE_ENABLE_MOCKS === 'true';
const isDemoBuild = import.meta.env.MODE === 'demo' && import.meta.env.VITE_DEMO_BUILD === 'true';

if (mocksRequested && import.meta.env.PROD && !isDemoBuild) {
  throw new Error('Mock mode is not allowed in a production build.');
}

export const config = {
  apiBaseUrl: apiBaseUrl.replace(/\/+$/, ''),
  // Production demos are synthetic and explicit; normal production builds remain mock-free.
  mocksEnabled: mocksRequested && (import.meta.env.DEV || isDemoBuild),
  languageStorageKey: 'oceanlink.language',
} as const;
