import WifiOffOutlinedIcon from '@mui/icons-material/WifiOffOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router';

import { BreadcrumbContext, type Crumb } from '@/components/breadcrumbs';
import { ErrorState } from '@/components/States';
import { SessionKeeper } from '@/features/auth/SessionKeeper';
import { useLot } from '@/hooks/useLot';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { visuallyHidden } from '@/lib/a11y';
import { hasCode } from '@/lib/api/errors';

import { Sidebar } from './Sidebar';
import { tokens } from './theme';
import { TopBar } from './TopBar';

export function AppShell() {
  const { t } = useTranslation();
  const theme = useTheme();
  // Full sidebar at 1200px+, icon rail from 900px, drawer below that.
  const wide = useMediaQuery(theme.breakpoints.up('lg'));
  const medium = useMediaQuery(theme.breakpoints.up('md'));
  const online = useOnlineStatus();
  const lot = useLot();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  // Move focus to the new page so keyboard and screen reader users start at the top.
  useEffect(() => {
    setDrawerOpen(false);
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo?.(0, 0);
  }, [pathname]);

  const lotMissing = hasCode(lot.error, 'LOT_SETUP_REQUIRED');

  return (
    <BreadcrumbContext.Provider value={setCrumbs}>
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
        <Box
          component="a"
          href="#main"
          sx={{
            ...visuallyHidden,
            '&:focus': {
              clip: 'auto',
              width: 'auto',
              height: 'auto',
              margin: 0,
              zIndex: 2000,
              top: 8,
              left: 8,
              px: 2,
              py: 1,
              bgcolor: 'background.paper',
              borderRadius: 2,
              fontWeight: 600,
            },
          }}
        >
          {t('shell.skipToMain')}
        </Box>

        {medium && (
          <Box
            component="aside"
            sx={{
              width: wide ? tokens.sidebarWidth : tokens.railWidth,
              flexShrink: 0,
              position: 'sticky',
              top: 0,
              height: '100vh',
            }}
          >
            <Sidebar rail={!wide} />
          </Box>
        )}
        <Drawer
          open={!wide && drawerOpen}
          onClose={() => setDrawerOpen(false)}
          ModalProps={{ keepMounted: false }}
          slotProps={{ paper: { sx: { border: 0 } } }}
        >
          <Sidebar onNavigate={() => setDrawerOpen(false)} />
        </Drawer>

        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <TopBar crumbs={crumbs} showMenuButton={!wide} onMenu={() => setDrawerOpen(true)} />
          {!online && (
            <Alert
              severity="warning"
              icon={<WifiOffOutlinedIcon />}
              role="status"
              sx={{ borderRadius: 0, borderBottom: 1, borderColor: 'warning.main' }}
            >
              {t('shell.offline')}
            </Alert>
          )}
          <Box
            component="main"
            id="main"
            ref={mainRef}
            tabIndex={-1}
            sx={{
              flex: 1,
              width: '100%',
              maxWidth: 1280,
              mx: 'auto',
              px: { xs: 2, sm: 3, lg: 4 },
              pt: { xs: 2.5, sm: 4 },
              // Room so the floating action button never covers the last row.
              pb: { xs: 12, md: 6 },
              outline: 'none',
            }}
          >
            {lotMissing ? (
              <ErrorState title={t('errors.lotSetupTitle')} body={t('errors.lotSetupBody')} />
            ) : (
              <Outlet />
            )}
          </Box>
        </Box>
        <SessionKeeper />
      </Box>
    </BreadcrumbContext.Provider>
  );
}
