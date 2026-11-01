import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useLocation } from 'react-router';

import { useAuth } from '@/features/auth/useAuth';
import { useLot } from '@/hooks/useLot';

import { isActivePath, NAV_GROUPS } from './navigation';
import { tokens } from './theme';

interface ItemProps {
  label: string;
  icon: ReactNode;
  to?: string;
  onClick?: () => void;
  active?: boolean;
  rail: boolean;
}

function SidebarItem({ label, icon, to, onClick, active = false, rail }: ItemProps) {
  const linkProps = to ? { component: RouterLink, to } : { onClick };
  const button = (
    <ButtonBase
      {...linkProps}
      aria-current={active ? 'page' : undefined}
      aria-label={rail ? label : undefined}
      sx={{
        position: 'relative',
        width: '100%',
        minHeight: 48,
        px: rail ? 0 : 2,
        justifyContent: rail ? 'center' : 'flex-start',
        gap: 1.5,
        borderRadius: 2,
        color: 'common.white',
        fontSize: '1rem',
        fontWeight: active ? 700 : 500,
        textAlign: 'left',
        bgcolor: active ? tokens.primaryDark : 'transparent',
        '&:hover': { bgcolor: active ? tokens.primaryDark : 'rgba(255,255,255,0.12)' },
        '&.Mui-focusVisible, &:focus-visible': { outline: '3px solid #FFFFFF', outlineOffset: -3 },
        '&::before': active
          ? {
              content: '""',
              position: 'absolute',
              left: 0,
              top: 8,
              bottom: 8,
              width: 4,
              borderRadius: 4,
              bgcolor: 'common.white',
            }
          : undefined,
        '& svg': { fontSize: 24, flexShrink: 0 },
      }}
    >
      {icon}
      {!rail && <span>{label}</span>}
    </ButtonBase>
  );
  return (
    <Box component="li" sx={{ listStyle: 'none' }}>
      {rail ? (
        <Tooltip title={label} placement="right">
          {button}
        </Tooltip>
      ) : (
        button
      )}
    </Box>
  );
}

// Blue navigation panel. "rail" shows icons only, for tablet widths.
export function Sidebar({ rail = false, onNavigate }: { rail?: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const lot = useLot();
  const groups = NAV_GROUPS.filter((group) => !group.adminOnly || user?.role === 'admin');

  return (
    <Box
      sx={{
        height: '100%',
        width: rail ? tokens.railWidth : tokens.sidebarWidth,
        bgcolor: 'primary.main',
        color: 'common.white',
        display: 'flex',
        flexDirection: 'column',
        px: rail ? 1.5 : 2,
        py: 2.5,
        overflowY: 'auto',
        scrollbarWidth: 'thin',
        scrollbarColor: `${tokens.sidebarMuted} ${tokens.primary}`,
      }}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('a')) onNavigate?.();
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: rail ? 0 : 1,
          mb: 3,
          justifyContent: rail ? 'center' : 'flex-start',
        }}
      >
        <Box
          aria-hidden
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            bgcolor: 'common.white',
            color: 'primary.main',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <LocalShippingOutlinedIcon />
        </Box>
        {!rail && (
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '1.25rem', lineHeight: 1.2 }}>
              OceanLink
            </Typography>
            {lot.data && (
              <Typography
                sx={{ color: tokens.sidebarMuted, fontSize: '0.875rem', overflowWrap: 'anywhere' }}
              >
                {lot.data.name}
              </Typography>
            )}
          </Box>
        )}
      </Box>

      <Box component="nav" aria-label={t('nav.main')} sx={{ flex: 1 }}>
        {groups.map((group, index) => (
          <Box key={group.labelKey} sx={{ mb: 2.5 }}>
            {rail ? (
              index > 0 && (
                <Box
                  aria-hidden
                  sx={{ borderTop: 1, borderColor: 'rgba(255,255,255,0.3)', mx: 1, mb: 1.5 }}
                />
              )
            ) : (
              <Typography
                component="h2"
                variant="overline"
                sx={{ display: 'block', color: tokens.sidebarMuted, px: 1, mb: 0.5 }}
              >
                {t(group.labelKey)}
              </Typography>
            )}
            <Box component="ul" sx={{ m: 0, p: 0, display: 'grid', gap: 0.5 }}>
              {group.items.map((item) => (
                <SidebarItem
                  key={item.to}
                  to={item.to}
                  label={t(item.labelKey)}
                  icon={<item.icon />}
                  active={isActivePath(pathname, item.to)}
                  rail={rail}
                />
              ))}
            </Box>
          </Box>
        ))}
      </Box>

      <Box
        component="ul"
        sx={{
          m: 0,
          p: 0,
          pt: 2,
          borderTop: 1,
          borderColor: 'rgba(255,255,255,0.3)',
          display: 'grid',
          gap: 0.5,
        }}
      >
        <SidebarItem
          to="/profile"
          label={t('nav.profile')}
          icon={<AccountCircleOutlinedIcon />}
          active={isActivePath(pathname, '/profile')}
          rail={rail}
        />
        <SidebarItem
          label={t('shell.signOut')}
          icon={<LogoutOutlinedIcon />}
          onClick={() => void logout()}
          rail={rail}
        />
      </Box>
    </Box>
  );
}
