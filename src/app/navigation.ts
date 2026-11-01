import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import type { SvgIconComponent } from '@mui/icons-material';

export interface NavItem {
  to: string;
  labelKey: string;
  icon: SvgIconComponent;
}

export interface NavGroup {
  labelKey: string;
  adminOnly?: boolean;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: 'nav.dailyWork',
    items: [
      { to: '/', labelKey: 'nav.overview', icon: DashboardOutlinedIcon },
      { to: '/customers', labelKey: 'nav.customers', icon: PeopleAltOutlinedIcon },
      { to: '/vehicles', labelKey: 'nav.vehicles', icon: LocalShippingOutlinedIcon },
      { to: '/payments', labelKey: 'nav.payments', icon: PaymentsOutlinedIcon },
    ],
  },
  {
    labelKey: 'nav.billing',
    items: [
      { to: '/invoices', labelKey: 'nav.invoices', icon: ReceiptLongOutlinedIcon },
      { to: '/reports', labelKey: 'nav.reports', icon: AssessmentOutlinedIcon },
    ],
  },
  {
    labelKey: 'nav.admin',
    adminOnly: true,
    items: [{ to: '/settings', labelKey: 'nav.settings', icon: SettingsOutlinedIcon }],
  },
];

export function isActivePath(pathname: string, to: string): boolean {
  if (to === '/') return pathname === '/';
  return pathname === to || pathname.startsWith(`${to}/`);
}
