import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';

import { IconTile } from '@/components/IconTile';
import { visuallyHidden } from '@/lib/a11y';

interface KpiCardProps {
  label: string;
  icon: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  link?: { label: string; to: string };
  loading: boolean;
  failed: boolean;
  danger?: boolean;
}

// One headline number with a short line under it. On phones the cards sit two by two,
// so the icon is dropped and the whole card becomes the tap target.
export function KpiCard({
  label,
  icon,
  value,
  detail,
  link,
  loading,
  failed,
  danger = false,
}: KpiCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const labelId = useId();
  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby={labelId}
      sx={{
        position: 'relative',
        p: phone ? 1.5 : 2.5,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        // A red top edge marks the card that needs follow-up; the label says so in words.
        borderTop: danger ? 4 : 1,
        borderTopColor: danger ? 'error.main' : 'divider',
        '&:focus-within': { outline: `3px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          mb: phone ? 0.75 : 1.5,
          pr: phone && link ? 3 : 0,
        }}
      >
        {!phone && <IconTile size={36}>{icon}</IconTile>}
        <Typography
          id={labelId}
          component="h2"
          sx={{
            fontWeight: 600,
            color: 'text.secondary',
            fontSize: phone ? '0.9375rem' : '1rem',
            lineHeight: 1.3,
          }}
        >
          {label}
        </Typography>
      </Box>
      {loading ? (
        <>
          <Skeleton variant="rounded" height={phone ? 28 : 36} width="60%" />
          <Skeleton variant="text" width="80%" sx={{ mt: 1 }} />
        </>
      ) : failed ? (
        <Typography role="alert" color="text.secondary" variant={phone ? 'body2' : 'body1'}>
          {t('overview.cardFailed')}
        </Typography>
      ) : (
        <>
          <Box
            sx={{
              fontSize: phone ? '1.375rem' : '1.75rem',
              fontWeight: 700,
              lineHeight: 1.2,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {value}
          </Box>
          {detail && (
            <Typography color="text.secondary" variant={phone ? 'body2' : 'body1'} sx={{ mt: 0.5 }}>
              {detail}
            </Typography>
          )}
        </>
      )}
      {link &&
        (phone ? (
          <>
            <ChevronRightIcon
              aria-hidden
              sx={{ position: 'absolute', top: 10, right: 8, color: 'primary.main' }}
            />
            <Link
              component={RouterLink}
              to={link.to}
              sx={{
                outline: 'none',
                // The link stretches over the whole card so the card is easy to tap.
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 'inherit',
                },
              }}
            >
              <Box component="span" sx={visuallyHidden}>
                {link.label}
              </Box>
            </Link>
          </>
        ) : (
          <Box sx={{ mt: 'auto', pt: 1 }}>
            <Link
              component={RouterLink}
              to={link.to}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                fontWeight: 600,
                minHeight: 44,
              }}
            >
              {link.label}
              <ArrowForwardIcon fontSize="small" aria-hidden />
            </Link>
          </Box>
        ))}
    </Paper>
  );
}
