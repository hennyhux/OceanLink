import { setupWorker } from 'msw/browser';

import { handlers } from './handlers';

export async function startMockWorker(): Promise<void> {
  const worker = setupWorker(...handlers);
  await worker.start({
    // Anything we did not mock must fail loudly rather than slip through.
    onUnhandledRequest(request, print) {
      if (new URL(request.url).pathname.startsWith('/api/')) {
        print.error();
      }
    },
  });
  console.warn('[OceanLink] Mock API enabled. This is development data only.');
}
