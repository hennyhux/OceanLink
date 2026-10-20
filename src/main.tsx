import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import { AppProviders } from '@/app/AppProviders';
import { createAppRouter } from '@/app/router';
import { config } from '@/lib/config';
import { setupI18n } from '@/lib/i18n';

async function enableMocksIfRequested(): Promise<void> {
  if (!config.mocksEnabled) return;
  const { startMockWorker } = await import('@/mocks/browser');
  await startMockWorker();
}

async function bootstrap(): Promise<void> {
  setupI18n();
  await enableMocksIfRequested();

  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Root element #root not found');

  createRoot(rootElement).render(
    <StrictMode>
      <AppProviders>
        <RouterProvider router={createAppRouter()} />
      </AppProviders>
    </StrictMode>,
  );
}

void bootstrap().catch((error: unknown) => {
  console.error(error);
  const root = document.getElementById('root');
  if (root) {
    // Plain text on purpose: i18n may not be ready if startup failed this early.
    root.textContent =
      'OceanLink could not start. Please reload the page. / OceanLink 无法启动，请刷新页面。';
  }
});
