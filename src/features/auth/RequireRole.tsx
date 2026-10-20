import { Outlet } from 'react-router';

import { ForbiddenPage } from '@/components/ForbiddenPage';

import type { StaffRole } from './types';
import { useAuth } from './useAuth';

export function RequireRole({ roles }: { roles: readonly StaffRole[] }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return <ForbiddenPage />;
  }
  return <Outlet />;
}
