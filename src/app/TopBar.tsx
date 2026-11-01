import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';

import type { Crumb } from '@/components/breadcrumbs';
import { initials } from '@/lib/display';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { useAuth } from '@/features/auth/useAuth';

import { tokens } from './theme';

interface TopBarProps {
  crumbs: Crumb[];
  showMenuButton: boolean;
  onMenu: () => void;
}

export function TopBar({ crumbs, showMenuButton, onMenu }: TopBarProps) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const parent = crumbs.length > 1 ? crumbs[crumbs.length - 2] : undefined;

  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}
    >
      <Toolbar sx={{ minHeight: tokens.topBarHeight, gap: 1.5, px: { xs: 1.5, sm: 3 } }}>
        {showMenuButton && (
          <IconButton aria-label={t('shell.openMenu')} onClick={onMenu} edge="start">
            <MenuIcon />
          </IconButton>
        )}
        {phone ? (
          // On phones the page title already names the page, so only a link back up is shown.
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {parent?.to && (
              <Link
                component={RouterLink}
                to={parent.to}
                underline="hover"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  minHeight: 44,
                  fontWeight: 600,
                  maxWidth: '100%',
                }}
              >
                <ChevronLeftIcon fontSize="small" aria-hidden />
                <Box
                  component="span"
                  sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {parent.label}
                </Box>
              </Link>
            )}
          </Box>
        ) : (
          <Breadcrumbs
            aria-label={t('shell.breadcrumb')}
            separator={<NavigateNextIcon fontSize="small" />}
            sx={{ flex: 1, minWidth: 0, '& ol': { flexWrap: 'nowrap' }, '& li': { minWidth: 0 } }}
          >
            {crumbs.map((crumb, index) =>
              crumb.to && index < crumbs.length - 1 ? (
                <Link
                  key={`${crumb.label}-${index}`}
                  component={RouterLink}
                  to={crumb.to}
                  underline="hover"
                  sx={{
                    fontWeight: 500,
                    display: { xs: index < crumbs.length - 2 ? 'none' : 'inline', sm: 'inline' },
                  }}
                >
                  {crumb.label}
                </Link>
              ) : (
                <Typography
                  key={`${crumb.label}-${index}`}
                  aria-current="page"
                  noWrap
                  sx={{ fontWeight: 600, color: 'text.primary', display: 'block' }}
                >
                  {crumb.label}
                </Typography>
              ),
            )}
          </Breadcrumbs>
        )}
        <LanguageSwitch />
        {user && (
          <>
            <ButtonBase
              aria-label={t('shell.userMenu', { name: user.name })}
              aria-haspopup="menu"
              aria-expanded={Boolean(anchor)}
              onClick={(event) => setAnchor(event.currentTarget)}
              sx={{ borderRadius: 2, px: 1, py: 0.5, gap: 1.25, minHeight: 44 }}
            >
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: 'primary.light',
                  color: 'primary.main',
                  fontSize: '0.9375rem',
                  fontWeight: 700,
                }}
              >
                {initials(user.name)}
              </Avatar>
              <Box sx={{ display: { xs: 'none', md: 'block' }, textAlign: 'left' }}>
                <Typography sx={{ fontWeight: 600, lineHeight: 1.2 }}>{user.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {t(`roles.${user.role}`)}
                </Typography>
              </Box>
            </ButtonBase>
            <Menu
              anchorEl={anchor}
              open={Boolean(anchor)}
              onClose={() => setAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem
                component={RouterLink}
                to="/profile"
                onClick={() => setAnchor(null)}
                sx={{ minHeight: 48 }}
              >
                {t('nav.profile')}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setAnchor(null);
                  void logout();
                }}
                sx={{ minHeight: 48 }}
              >
                {t('shell.signOut')}
              </MenuItem>
            </Menu>
          </>
        )}
      </Toolbar>
    </AppBar>
  );
}
