import type { ComponentType } from 'react';
import { createBrowserRouter, createMemoryRouter, Navigate, type RouteObject } from 'react-router';

import { NotFoundPage } from '@/components/MessagePages';
import { RequireAuth, RequirePasswordCurrent } from '@/features/auth/guards';
import { LoginPage } from '@/features/auth/LoginPage';

import { AppShell } from './AppShell';
import { VehicleEditRedirect } from './redirects';
import { RouteError } from './RouteError';

// Each page loads on demand so the first screen stays small.
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await load()).default,
});

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage />, errorElement: <RouteError /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <RequirePasswordCurrent>
          <AppShell />
        </RequirePasswordCurrent>
      </RequireAuth>
    ),
    errorElement: <RouteError />,
    children: [
      { index: true, lazy: page(() => import('@/features/overview/OverviewPage')) },
      { path: 'customers', lazy: page(() => import('@/features/customers/CustomersPage')) },
      { path: 'customers/new', lazy: page(() => import('@/features/customers/CustomerNewPage')) },
      {
        path: 'customers/:id',
        lazy: page(() => import('@/features/customers/CustomerDetailPage')),
      },
      {
        path: 'customers/:id/edit',
        lazy: page(() => import('@/features/customers/CustomerEditPage')),
      },
      { path: 'vehicles', lazy: page(() => import('@/features/vehicles/VehiclesPage')) },
      { path: 'vehicles/new', lazy: page(() => import('@/features/vehicles/VehicleNewPage')) },
      { path: 'vehicles/:id', lazy: page(() => import('@/features/vehicles/VehicleDetailPage')) },
      // Old bookmarks from the previous app.
      { path: 'vehicles/:id/edit', element: <VehicleEditRedirect /> },
      { path: 'agreements/*', element: <Navigate to="/vehicles" replace /> },
      { path: 'payments', lazy: page(() => import('@/features/payments/PaymentsPage')) },
      { path: 'invoices', lazy: page(() => import('@/features/placeholders/InvoicesPage')) },
      { path: 'reports', lazy: page(() => import('@/features/placeholders/ReportsPage')) },
      { path: 'settings/*', lazy: page(() => import('@/features/placeholders/SettingsPage')) },
      { path: 'profile', lazy: page(() => import('@/features/placeholders/ProfilePage')) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}

export function createTestRouter(initialEntries: string[]) {
  return createMemoryRouter(routes, { initialEntries });
}
