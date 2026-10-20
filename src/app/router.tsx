import { createBrowserRouter, createMemoryRouter, Navigate, type RouteObject } from 'react-router';

import { NotFoundPage } from '@/components/NotFoundPage';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { LoginPage } from '@/features/auth/LoginPage';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { RequireRole } from '@/features/auth/RequireRole';
import { CustomerDetailPage } from '@/features/customers/CustomerDetailPage';
import { CustomerEditPage } from '@/features/customers/CustomerEditPage';
import { CustomerNewPage } from '@/features/customers/CustomerNewPage';
import { CustomersPage } from '@/features/customers/CustomersPage';
import { OverviewPage } from '@/features/overview/OverviewPage';
import { NotImplementedPage } from '@/features/placeholders/NotImplementedPage';
import { VehicleEditPage } from '@/features/vehicles/VehicleEditPage';
import { VehicleNewPage } from '@/features/vehicles/VehicleNewPage';
import { VehiclesPage } from '@/features/vehicles/VehiclesPage';
import { PaymentsPage } from '@/features/payments/PaymentsPage';

import { AppShell } from './AppShell';
import { ADMIN_ONLY } from './navigation';

export const routes: RouteObject[] = [
  {
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: '/login', element: <LoginPage /> },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <OverviewPage /> },
              { path: 'customers', element: <CustomersPage /> },
              { path: 'customers/new', element: <CustomerNewPage /> },
              { path: 'customers/:id', element: <CustomerDetailPage /> },
              { path: 'customers/:id/edit', element: <CustomerEditPage /> },
              { path: 'vehicles', element: <VehiclesPage /> },
              { path: 'vehicles/new', element: <VehicleNewPage /> },
              { path: 'vehicles/:id/edit', element: <VehicleEditPage /> },
              { path: 'agreements', element: <Navigate to="/vehicles" replace /> },
              { path: 'invoices', element: <NotImplementedPage titleKey="nav.invoices" /> },
              { path: 'payments', element: <PaymentsPage /> },
              { path: 'reports', element: <NotImplementedPage titleKey="nav.reports" /> },
              {
                element: <RequireRole roles={ADMIN_ONLY} />,
                children: [
                  { path: 'settings', element: <NotImplementedPage titleKey="nav.settings" /> },
                ],
              },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}

export function createTestRouter(initialEntries: string[] = ['/']) {
  return createMemoryRouter(routes, { initialEntries });
}
