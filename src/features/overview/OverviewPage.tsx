import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';

import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/features/auth/useAuth';
import { formatMoney } from '@/lib/money';
import { useOverviewMetrics } from './api';

export function OverviewPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const theme = useTheme();
  const metrics = useOverviewMetrics();
  const money = (amount: number) =>
    formatMoney(amount, i18n.resolvedLanguage ?? 'zh-CN');
  const cards = metrics.data
    ? [
        {
          key: 'overdueInvoices',
          value: money(metrics.data.overdue_invoices.amount),
          icon: <WarningAmberOutlinedIcon aria-hidden />,
          tone: 'error' as const,
          featured: true,
          to: '/customers',
        },
        {
          key: 'outstandingInvoices',
          value: money(metrics.data.outstanding_invoices.amount),
          icon: <AccountBalanceWalletOutlinedIcon aria-hidden />,
          tone: 'warning' as const,
          featured: true,
          to: '/customers',
        },
        {
          key: 'unbilledParking',
          value: money(metrics.data.unbilled_parking.amount),
          icon: <ReceiptLongOutlinedIcon aria-hidden />,
          tone: 'info' as const,
          featured: false,
          to: '/customers',
        },
        {
          key: 'paymentsThisMonth',
          value: money(metrics.data.payments_received_this_month.amount),
          icon: <PaymentsOutlinedIcon aria-hidden />,
          tone: 'success' as const,
          featured: false,
          to: '/payments',
        },
        {
          key: 'totalCustomers',
          value: String(metrics.data.total_customers),
          icon: <GroupsOutlinedIcon aria-hidden />,
          tone: 'primary' as const,
          featured: false,
          to: '/customers',
        },
        {
          key: 'totalTrucks',
          value: String(metrics.data.total_trucks),
          icon: <LocalShippingOutlinedIcon aria-hidden />,
          tone: 'secondary' as const,
          featured: false,
          to: '/vehicles',
        },
      ]
    : [];

  return (
    <>
      <PageHeader
        title={t('overview.title')}
        description={user ? t('overview.welcome', { name: user.name }) : undefined}
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
        <Grid container spacing={2.5}>
          {cards.map((card) => (
            <Grid
              key={card.key}
              size={card.featured ? { xs: 12, sm: 6 } : { xs: 12, sm: 6, lg: 3 }}
            >
              <Paper
                variant="outlined"
                component={RouterLink}
                to={card.to}
                sx={{
                  height: '100%',
                    display: 'block',
                    minHeight: card.featured ? 172 : 148,
                  p: card.featured ? 3 : 2.5,
                  borderTop: card.featured ? 5 : 3,
                  borderTopColor: `${card.tone}.main`,
                  borderRadius: 1,
                  bgcolor: alpha(theme.palette[card.tone].main, card.featured ? 0.09 : 0.045),
                  color: 'inherit',
                  textDecoration: 'none',
                  transition: theme.transitions.create(['transform', 'box-shadow', 'border-color']),
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: theme.shadows[3],
                    borderColor: `${card.tone}.main`,
                  },
                  '&:focus-visible': {
                    outline: `3px solid ${theme.palette.primary.main}`,
                    outlineOffset: 2,
                  },
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" gap={{ xs: 1.5, sm: 2 }}>
                  <Box sx={{ minWidth: 0, flex: '1 1 auto' }}>
                    <Typography variant="body2" color="text.secondary" fontWeight={600}>
                      {t(`overview.metrics.${card.key}`)}
                    </Typography>
                    <Typography
                      component="p"
                      variant={card.featured ? 'h3' : 'h4'}
                      fontWeight={800}
                      sx={{
                        mt: 1,
                        mb: 0,
                        display: 'inline-flex',
                        maxWidth: '100%',
                        px: 1,
                        py: 0.25,
                        borderRadius: 1,
                        color: `${card.tone}.dark`,
                        bgcolor: alpha(theme.palette[card.tone].main, 0.12),
                        fontSize: { xs: '1.875rem', sm: card.featured ? '3rem' : '2.125rem' },
                        lineHeight: 1.15,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {card.value}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      display: 'grid',
                      placeItems: 'center',
                      flex: '0 0 auto',
                      width: card.featured ? 52 : 44,
                      height: card.featured ? 52 : 44,
                      borderRadius: 1,
                      color: `${card.tone}.dark`,
                      bgcolor: alpha(theme.palette[card.tone].main, 0.1),
                    }}
                  >
                    {card.icon}
                  </Box>
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}
    </>
  );
}
