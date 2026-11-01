import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';

import { cardState } from './cardState';
import { CardBody, DashboardCard } from './DashboardCard';
import { hasParkingOn } from './model';
import type { OverviewData } from './useOverviewData';

export function SnapshotCard({ data }: { data: OverviewData }) {
  const { t } = useTranslation();
  const { summary, vehicles, overdueCustomers, today } = data;
  const state = cardState(summary, vehicles, overdueCustomers);
  const withParking = today
    ? (vehicles.data?.items ?? []).filter((vehicle) => hasParkingOn(vehicle, today)).length
    : 0;
  const rows: { label: string; hint?: string; value: number; danger?: boolean }[] = summary.data
    ? [
        {
          label: t('overview.customers'),
          hint: t('overview.customersHint'),
          value: summary.data.total_customers,
        },
        {
          label: t('overview.trucks'),
          hint: t('overview.trucksHint'),
          value: summary.data.total_trucks,
        },
        {
          label: t('overview.monthlyParking'),
          hint: t('overview.monthlyParkingHint'),
          value: withParking,
        },
        {
          label: t('overview.pastDueCustomers'),
          value: overdueCustomers.data?.total ?? 0,
          danger: true,
        },
      ]
    : [];

  return (
    <DashboardCard
      title={t('overview.snapshot')}
      icon={<InsightsOutlinedIcon />}
      footer={{ label: t('overview.viewVehicles'), to: '/vehicles' }}
    >
      <CardBody state={state} rows={4}>
        <Box component="dl" sx={{ m: 0 }}>
          {rows.map((row) => (
            <Box
              key={row.label}
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 2,
                py: 1,
              }}
            >
              <Box>
                <Typography component="dt" sx={{ fontWeight: 500 }}>
                  {row.label}
                </Typography>
                {row.hint && (
                  <Typography variant="caption" color="text.secondary" component="div">
                    {row.hint}
                  </Typography>
                )}
              </Box>
              <Typography
                component="dd"
                sx={{
                  m: 0,
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color: row.danger && row.value > 0 ? 'error.main' : 'text.primary',
                }}
              >
                {row.value}
              </Typography>
            </Box>
          ))}
        </Box>
      </CardBody>
    </DashboardCard>
  );
}
