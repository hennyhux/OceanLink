import type { SvgIconComponent } from '@mui/icons-material';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

import type { StaffRole } from '@/features/auth/types';

export interface NavItem {
  path: string;
  labelKey: string;
  icon: SvgIconComponent;
  roles: readonly StaffRole[];
}

export const ALL_STAFF: readonly StaffRole[] = ['operator', 'admin'];
export const ADMIN_ONLY: readonly StaffRole[] = ['admin'];

// Order matches REQUIREMENTS.md section 4.2.
export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/', labelKey: 'nav.overview', icon: HomeOutlinedIcon, roles: ALL_STAFF },
  { path: '/customers', labelKey: 'nav.customers', icon: PeopleOutlinedIcon, roles: ALL_STAFF },
  {
    path: '/vehicles',
    labelKey: 'nav.vehicles',
    icon: LocalShippingOutlinedIcon,
    roles: ALL_STAFF,
  },
  { path: '/invoices', labelKey: 'nav.invoices', icon: ReceiptLongOutlinedIcon, roles: ALL_STAFF },
  { path: '/payments', labelKey: 'nav.payments', icon: PaymentsOutlinedIcon, roles: ALL_STAFF },
  { path: '/reports', labelKey: 'nav.reports', icon: AssessmentOutlinedIcon, roles: ALL_STAFF },
  { path: '/settings', labelKey: 'nav.settings', icon: SettingsOutlinedIcon, roles: ADMIN_ONLY },
];
