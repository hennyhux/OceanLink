import { setupWorker } from 'msw/browser';

import { enableSessionRestore } from './db';
import { handlers } from './handlers';

export async function startMockWorker(): Promise<void> {
  enableSessionRestore();
  await setupWorker(...handlers).start({ onUnhandledRequest: 'bypass', quiet: true });
}
