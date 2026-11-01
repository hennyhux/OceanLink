import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import { AppProviders } from '@/app/AppProviders';
import { createAppRouter } from '@/app/router';
import { config } from '@/lib/config';
import { setupI18n } from '@/lib/i18n';

async function bootstrap(): Promise<void> {
  setupI18n();
  if (config.mocksEnabled) {
    const { startMockWorker } = await import('@/mocks/browser');
    await startMockWorker();
  }
  const root = document.getElementById('root');
  if (!root) throw new Error('Root element #root not found');
  createRoot(root).render(
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
  // Plain text on purpose: translations may not be ready this early.
  if (root)
    root.textContent =
      'OceanLink could not start. Please reload the page. / OceanLink 无法启动，请刷新页面。';
});
