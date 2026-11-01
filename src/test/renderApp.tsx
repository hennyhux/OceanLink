import { QueryClient } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import { RouterProvider } from 'react-router';
import { vi } from 'vitest';

import { AppProviders } from '@/app/AppProviders';
import { createTestRouter } from '@/app/router';
import { authApi } from '@/features/auth/api';
import { changeLanguage, setupI18n, type Language } from '@/lib/i18n';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

export function renderApp(
  options: { route?: string; language?: Language } = {},
): RenderResult & { queryClient: QueryClient; router: ReturnType<typeof createTestRouter> } {
  const language = options.language ?? 'en';
  setupI18n(language);
  // Stored like a real choice, so signing in does not switch to the account's saved language.
  void changeLanguage(language);
  const queryClient = createTestQueryClient();
  const router = createTestRouter([options.route ?? '/']);
  const result = render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...result, queryClient, router };
}

// Signs in through the mock backend so later requests carry a real mock session.
export async function signIn(role: 'admin' | 'operator' = 'admin'): Promise<void> {
  await authApi.login({ email: `${role}@example.com`, password: `${role}-password` });
}

// Width in pixels for the responsive layout checks.
export function useViewport(width: number): void {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches: query.includes('max-width')
      ? width <= Number(/max-width:\s*([\d.]+)/.exec(query)?.[1] ?? 0)
      : width >= Number(/min-width:\s*([\d.]+)/.exec(query)?.[1] ?? Infinity),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
}
