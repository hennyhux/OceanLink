import { QueryClient } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import { RouterProvider } from 'react-router';

import { AppProviders } from '@/app/AppProviders';
import { createTestRouter } from '@/app/router';
import { setupI18n, type Language } from '@/lib/i18n';

interface RenderAppOptions {
  route?: string;
  language?: Language;
}

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

export function renderApp(options: RenderAppOptions = {}): RenderResult & {
  queryClient: QueryClient;
} {
  const language = options.language ?? 'en';
  const i18n = setupI18n(language);
  void i18n.changeLanguage(language);

  const queryClient = createTestQueryClient();
  const router = createTestRouter([options.route ?? '/']);

  const result = render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...result, queryClient };
}
