import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import Alert from '@mui/material/Alert';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useNavigate } from 'react-router';

import { LanguageSwitch } from '@/components/LanguageSwitch';
import { useAuth } from '@/features/auth/useAuth';
import { config } from '@/lib/config';

import { NAV_ITEMS } from './navigation';

const DRAWER_WIDTH = 248;

export function AppShell() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const navigate = useNavigate();
  const { user, logout, isLoggingOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleItems = NAV_ITEMS.filter((item) => user && item.roles.includes(user.role));

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      // The login page shows a note if the server call failed.
      void navigate('/login', { replace: true });
    }
  };

  const navigation = (
    <Box component="nav" id="main-navigation" aria-label={t('nav.menu')} sx={{ pt: 1 }}>
      <List>
        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                component={NavLink}
                to={item.path}
                end={item.path === '/'}
                onClick={() => setMobileOpen(false)}
                sx={{
                  mx: 1,
                  borderRadius: 2,
                  '&.active': {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '& .MuiListItemIcon-root': { color: 'inherit' },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Icon aria-hidden />
                </ListItemIcon>
                <ListItemText primary={t(item.labelKey)} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Button
        href="#main-content"
        sx={{
          position: 'absolute',
          left: -9999,
          '&:focus': { left: 8, top: 8, zIndex: (th) => th.zIndex.tooltip },
        }}
      >
        {t('app.skipToContent')}
      </Button>

      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: 1, borderColor: 'divider', zIndex: theme.zIndex.drawer + 1 }}
      >
        <Toolbar sx={{ gap: 1 }}>
          {!isDesktop && (
            <IconButton
              edge="start"
              aria-label={mobileOpen ? t('app.closeMenu') : t('app.openMenu')}
              aria-expanded={mobileOpen}
              aria-controls="main-navigation"
              onClick={() => setMobileOpen((open) => !open)}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography
            component="div"
            variant="h6"
            fontWeight={700}
            noWrap
            sx={{ flexGrow: 1, minWidth: 0 }}
          >
            {t('app.name')}
          </Typography>
          <LanguageSwitch />
          {user && (
            <Typography
              variant="body2"
              color="text.secondary"
              noWrap
              sx={{ display: { xs: 'none', md: 'block' }, ml: 1 }}
            >
              {t('auth.signedInAs', { name: user.name })}
            </Typography>
          )}
          {isDesktop ? (
            <Button
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
              startIcon={<LogoutOutlinedIcon />}
              color="inherit"
              sx={{ whiteSpace: 'nowrap' }}
            >
              {isLoggingOut ? t('auth.signingOut') : t('auth.signOut')}
            </Button>
          ) : (
            <IconButton
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
              aria-label={isLoggingOut ? t('auth.signingOut') : t('auth.signOut')}
              edge="end"
            >
              <LogoutOutlinedIcon />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      {isDesktop ? (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
          }}
        >
          <Toolbar />
          {navigation}
        </Drawer>
      ) : (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' } }}
        >
          <Toolbar />
          <Divider />
          {navigation}
        </Drawer>
      )}

      <Box component="main" id="main-content" tabIndex={-1} sx={{ flexGrow: 1, minWidth: 0 }}>
        <Toolbar />
        {config.mocksEnabled && (
          <Alert severity="warning" square sx={{ justifyContent: 'center' }}>
            {t('dev.mockBanner')}
          </Alert>
        )}
        <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 4 } }}>
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}
