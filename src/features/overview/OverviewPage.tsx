import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';

import { PageHeader } from '@/components/PageHeader';
import { formatMoney } from '@/lib/money';
import { useOverviewMetrics } from './api';

export function OverviewPage() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const metrics = useOverviewMetrics();
  const money = (amount: number) => formatMoney(amount, i18n.resolvedLanguage ?? 'zh-CN');
  const secondaryTextColor = alpha(theme.palette.text.primary, 0.76);

  return (
    <Stack
      spacing={3}
      sx={{
        width: '100%',
        maxWidth: 960,
        mx: 'auto',
        px: { xs: 0.5, sm: 0 },
        '& > :first-of-type': { mb: 0 },
      }}
    >
      <PageHeader
        title={t('overview.title')}
        titleSx={{ fontSize: { xs: '1.75rem', sm: '2rem' }, lineHeight: 1.2 }}
        action={
          <Stack direction="row" flexWrap="wrap" gap={1}>
            <Button
              component={RouterLink}
              to="/payments?record=1"
              variant="contained"
              size="large"
              sx={{ minHeight: 48 }}
            >
              {t('overview.actions.recordPayment')}
            </Button>
            <Button
              component={RouterLink}
              to="/customers/new"
              variant="outlined"
              size="large"
              sx={{ minHeight: 48 }}
            >
              {t('overview.actions.addCustomer')}
            </Button>
          </Stack>
        }
      />
      {metrics.isPending && <Typography role="status">{t('app.loading')}</Typography>}
      {metrics.isError && (
        <Alert
          severity="error"
          action={<Button onClick={() => void metrics.refetch()}>{t('app.retry')}</Button>}
        >
          {t('overview.loadFailed')}
        </Alert>
      )}
      {metrics.data && (
        <>
          <Paper
            variant="outlined"
            sx={{
              p: { xs: 2, sm: 3 },
              borderRadius: 1,
              bgcolor: alpha(
                theme.palette.primary.main,
                theme.palette.mode === 'dark' ? 0.2 : 0.08,
              ),
              borderColor: alpha(
                theme.palette.primary.main,
                theme.palette.mode === 'dark' ? 0.5 : 0.22,
              ),
            }}
          >
            <Stack spacing={1.5}>
              <Box>
                <Typography
                  variant="body2"
                  fontWeight={600}
                  sx={{ fontSize: 16, color: secondaryTextColor }}
                >
                  {t('overview.owed.total')}
                </Typography>
                <Typography
                  component="p"
                  sx={{
                    mt: 0.5,
                    mb: 0,
                    fontSize: { xs: '2rem', sm: '2.25rem' },
                    lineHeight: 1.15,
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    color:
                      metrics.data.outstanding_invoices.amount > 0 ? 'error.main' : 'text.primary',
                  }}
                >
                  {money(metrics.data.outstanding_invoices.amount)}
                </Typography>
              </Box>
              <Stack
                component="ul"
                spacing={1}
                sx={{ listStyle: 'none', m: 0, p: 0, maxWidth: 420 }}
              >
                <Stack
                  component="li"
                  direction="row"
                  justifyContent="space-between"
                  alignItems="baseline"
                  columnGap={2}
                >
                  <Link
                    component={RouterLink}
                    to="/customers?overdue=1"
                    color="error.main"
                    fontWeight={650}
                    sx={{ fontSize: 16 }}
                  >
                    {t('overview.owed.pastDue')}
                  </Link>
                  <Typography
                    component="span"
                    color="error.main"
                    sx={{
                      fontSize: '1.25rem',
                      fontWeight: 650,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {money(metrics.data.overdue_invoices.amount)}
                  </Typography>
                </Stack>
                <Stack
                  component="li"
                  direction="row"
                  justifyContent="space-between"
                  alignItems="baseline"
                  columnGap={2}
                >
                  <Typography
                    component="span"
                    fontWeight={600}
                    sx={{ fontSize: 16, color: secondaryTextColor }}
                  >
                    {t('overview.owed.notYetDue')}
                  </Typography>
                  <Typography
                    component="span"
                    sx={{
                      fontSize: '1.25rem',
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                      color: secondaryTextColor,
                    }}
                  >
                    {money(
                      Math.max(
                        0,
                        metrics.data.outstanding_invoices.amount -
                          metrics.data.overdue_invoices.amount,
                      ),
                    )}
                  </Typography>
                </Stack>
              </Stack>
            </Stack>
          </Paper>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper
                variant="outlined"
                sx={{
                  height: '100%',
                  p: { xs: 2, sm: 2.5 },
                  borderRadius: 1,
                  bgcolor: 'background.paper',
                }}
              >
                <Typography
                  variant="body2"
                  fontWeight={700}
                  sx={{ fontSize: 16, color: secondaryTextColor }}
                >
                  {t('overview.metrics.paymentsThisMonth')}
                </Typography>
                <Typography
                  sx={{
                    mt: 0.5,
                    fontSize: '1.5rem',
                    lineHeight: 1.35,
                    fontWeight: 650,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {money(metrics.data.payments_received_this_month.amount)}
                </Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper
                variant="outlined"
                sx={{
                  height: '100%',
                  p: { xs: 2, sm: 2.5 },
                  borderRadius: 1,
                  bgcolor: 'background.paper',
                }}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                  fontWeight={700}
                  sx={{ fontSize: 16 }}
                >
                  {t('overview.metrics.unbilledParking')}
                </Typography>
                <Typography
                  sx={{
                    mt: 0.5,
                    fontSize: '1.5rem',
                    lineHeight: 1.35,
                    fontWeight: 650,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {money(metrics.data.unbilled_parking.amount)}
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          <Stack direction="row" flexWrap="wrap" gap={1}>
            <Link
              component={RouterLink}
              to="/customers"
              underline="none"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                minHeight: 48,
                px: 1.5,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'background.paper',
                color: 'primary.main',
                fontSize: 16,
                fontWeight: 600,
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) },
                '&:focus-visible': {
                  outline: '3px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: 2,
                },
              }}
            >
              {t('overview.metrics.totalCustomers')}:{' '}
              <strong>{metrics.data.total_customers}</strong>
            </Link>
            <Link
              component={RouterLink}
              to="/vehicles"
              underline="none"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                minHeight: 48,
                px: 1.5,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'background.paper',
                color: 'primary.main',
                fontSize: 16,
                fontWeight: 600,
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) },
                '&:focus-visible': {
                  outline: '3px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: 2,
                },
              }}
            >
              {t('overview.metrics.totalTrucks')}: <strong>{metrics.data.total_trucks}</strong>
            </Link>
          </Stack>
        </>
      )}
    </Stack>
  );
}
