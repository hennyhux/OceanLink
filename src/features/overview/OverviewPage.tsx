import AddIcon from '@mui/icons-material/Add';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useSearchParams } from 'react-router';

import { useBreadcrumbs } from '@/components/breadcrumbs';
import { Money } from '@/components/Money';
import { PageHeader } from '@/components/PageHeader';
import { formatDate } from '@/lib/dates';

import { ActivityCard } from './ActivityCard';
import { AttentionCard } from './AttentionCard';
import { GlobalSearch } from './GlobalSearch';
import { KpiCard } from './KpiCard';
import { PaymentSummaryCard } from './PaymentSummaryCard';
import { SnapshotCard } from './SnapshotCard';
import { useOverviewData } from './useOverviewData';

const failed = (query: { isError: boolean; data?: unknown }) =>
  query.isError && query.data === undefined;

export default function OverviewPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? 'en';
  const [params] = useSearchParams();
  // While a search is active the results take the page; the dashboard returns on clear.
  const searching = Boolean(params.get('q')?.trim());
  const data = useOverviewData();
  const { summary, overdueCustomers, activeCustomers, monthPayments, today } = data;
  const metrics = summary.data;
  useBreadcrumbs([{ label: t('nav.overview') }]);

  const overdueCount = overdueCustomers.data?.total ?? 0;
  const pastDue = metrics?.overdue_invoices.amount ?? 0;
  const unbilled = metrics?.unbilled_parking.amount ?? 0;
  const active = activeCustomers.data?.total;
  const total = metrics?.total_customers;

  return (
    <>
      <PageHeader
        title={t('nav.overview')}
        subtitle={today ? t('overview.asOf', { date: formatDate(today, language) }) : undefined}
        secondaryActions={
          <Button
            component={RouterLink}
            to="/customers/new"
            variant="outlined"
            size="large"
            startIcon={<AddIcon />}
          >
            {t('customers.add')}
          </Button>
        }
        primaryAction={{ label: t('payments.record'), icon: <AddIcon />, to: '/payments?record=1' }}
      />

      <GlobalSearch />

      {!searching && (
        <Grid container spacing={{ xs: 1.5, sm: 3 }}>
          <Grid size={{ xs: 6, md: 3 }}>
            <KpiCard
              label={t('overview.pastDue')}
              icon={<ErrorOutlineIcon />}
              danger={pastDue > 0}
              loading={summary.isPending || overdueCustomers.isPending}
              failed={failed(summary) || failed(overdueCustomers)}
              value={<Money cents={pastDue} tone={pastDue > 0 ? 'owed' : 'neutral'} size="kpi" />}
              detail={
                overdueCount > 0
                  ? t('overview.customersCount', { count: overdueCount })
                  : t('overview.noPastDue')
              }
              link={
                overdueCount > 0
                  ? { label: t('overview.followUp'), to: '/customers?overdue=1' }
                  : undefined
              }
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <KpiCard
              label={t('overview.paidThisMonth')}
              icon={<PaymentsOutlinedIcon />}
              loading={summary.isPending}
              failed={failed(summary)}
              value={<Money cents={metrics?.payments_received_this_month.amount ?? 0} size="kpi" />}
              detail={
                monthPayments.data
                  ? t('overview.paymentsCount', { count: monthPayments.data.total })
                  : undefined
              }
              link={{ label: t('overview.viewPayments'), to: '/payments' }}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <KpiCard
              label={t('overview.unbilled')}
              icon={<ReceiptLongOutlinedIcon />}
              loading={summary.isPending}
              failed={failed(summary)}
              value={<Money cents={unbilled} size="kpi" />}
              detail={unbilled > 0 ? t('overview.unbilledHint') : t('overview.nothingToBill')}
              link={
                unbilled > 0 ? { label: t('overview.reviewCharges'), to: '/customers' } : undefined
              }
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <KpiCard
              label={t('overview.activeCustomers')}
              icon={<PeopleAltOutlinedIcon />}
              loading={summary.isPending || activeCustomers.isPending}
              failed={failed(summary) || failed(activeCustomers)}
              value={active}
              detail={
                active !== undefined && total !== undefined
                  ? t('overview.activeSplit', { total, inactive: Math.max(0, total - active) })
                  : undefined
              }
              link={{ label: t('overview.viewCustomers'), to: '/customers' }}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 7, lg: 8 }}>
            <AttentionCard data={data} />
          </Grid>
          <Grid size={{ xs: 12, md: 5, lg: 4 }}>
            <PaymentSummaryCard data={data} />
          </Grid>
          <Grid size={{ xs: 12, md: 7, lg: 8 }}>
            <ActivityCard data={data} />
          </Grid>
          <Grid size={{ xs: 12, md: 5, lg: 4 }}>
            <SnapshotCard data={data} />
          </Grid>
        </Grid>
      )}
    </>
  );
}
