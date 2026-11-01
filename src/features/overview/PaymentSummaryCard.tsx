import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Money } from '@/components/Money';
import { firstOfMonth, formatDate } from '@/lib/dates';

import { cardState } from './cardState';
import { CardBody, DashboardCard } from './DashboardCard';
import { notYetDue } from './model';
import type { OverviewData } from './useOverviewData';

function Row({
  label,
  hint,
  children,
  strong = false,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  strong?: boolean;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 2,
        py: 1,
      }}
    >
      <Box>
        <Typography component="dt" sx={{ fontWeight: strong ? 700 : 500 }}>
          {label}
        </Typography>
        {hint && (
          <Typography variant="caption" color="text.secondary" component="div">
            {hint}
          </Typography>
        )}
      </Box>
      <Box component="dd" sx={{ m: 0, fontSize: strong ? '1.125rem' : '1rem', textAlign: 'right' }}>
        {children}
      </Box>
    </Box>
  );
}

export function PaymentSummaryCard({ data }: { data: OverviewData }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? 'en';
  const { summary, today } = data;
  const metrics = summary.data;
  const notDue = metrics
    ? notYetDue(metrics.outstanding_invoices.amount, metrics.overdue_invoices.amount)
    : 0;

  return (
    <DashboardCard
      title={t('overview.paymentSummary')}
      icon={<AccountBalanceWalletOutlinedIcon />}
      footer={{ label: t('overview.viewPayments'), to: '/payments' }}
    >
      <CardBody state={cardState(summary)} rows={4}>
        {metrics && (
          <Box component="dl" sx={{ m: 0 }}>
            <Row label={t('overview.outstanding')} strong>
              <Money
                cents={metrics.outstanding_invoices.amount}
                tone={metrics.outstanding_invoices.amount > 0 ? 'owed' : 'neutral'}
              />
            </Row>
            <Box sx={{ pl: 2, borderLeft: 3, borderColor: 'divider', mb: 1 }}>
              <Row label={t('overview.pastDue')}>
                <Money
                  cents={metrics.overdue_invoices.amount}
                  tone={metrics.overdue_invoices.amount > 0 ? 'owed' : 'neutral'}
                />
              </Row>
              <Row label={t('overview.notDue')}>
                <Money cents={notDue} />
              </Row>
            </Box>
            <Row label={t('overview.unbilled')} hint={t('overview.unbilledHint')}>
              <Money cents={metrics.unbilled_parking.amount} />
            </Row>
            <Row
              label={t('overview.collected')}
              hint={
                today
                  ? t('overview.dateRange', {
                      from: formatDate(firstOfMonth(today), language),
                      to: formatDate(today, language),
                    })
                  : undefined
              }
            >
              <Money
                cents={metrics.payments_received_this_month.amount}
                tone={metrics.payments_received_this_month.amount > 0 ? 'credit' : 'neutral'}
              />
            </Row>
          </Box>
        )}
      </CardBody>
    </DashboardCard>
  );
}
