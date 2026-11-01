import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';

import { vehicleTitle } from '@/features/vehicles/display';
import { formatMoney } from '@/lib/money';

import { cardState } from './cardState';
import { CardBody, DashboardCard } from './DashboardCard';
import { formatWhen, recentActivity, type ActivityEntry, type ActivityKind } from './model';
import type { OverviewData } from './useOverviewData';

const ICONS: Record<ActivityKind, typeof PaymentsOutlinedIcon> = {
  payment: PaymentsOutlinedIcon,
  reversal: UndoOutlinedIcon,
  vehicle: LocalShippingOutlinedIcon,
  customerAdded: PersonAddAltOutlinedIcon,
  customerUpdated: EditNoteOutlinedIcon,
};

export function ActivityCard({ data }: { data: OverviewData }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? 'en';
  const { allCustomers, vehicles, recentPayments } = data;
  const state = cardState(recentPayments, allCustomers, vehicles);
  const entries = recentActivity(
    allCustomers.data?.items ?? [],
    vehicles.data?.items ?? [],
    recentPayments.data?.items ?? [],
  );

  const describe = (entry: ActivityEntry) => {
    const amount = entry.cents === undefined ? '' : formatMoney(entry.cents, language);
    if (entry.kind === 'vehicle' && entry.vehicle) {
      return t('overview.activity.vehicle', {
        vehicle: vehicleTitle(entry.vehicle, t),
        name: entry.name,
      });
    }
    return t(`overview.activity.${entry.kind}`, { amount, name: entry.name });
  };

  return (
    <DashboardCard
      title={t('overview.recentActivity')}
      icon={<HistoryOutlinedIcon />}
      footer={{ label: t('overview.viewPayments'), to: '/payments' }}
    >
      <CardBody state={state} rows={5}>
        {entries.length === 0 ? (
          <Typography color="text.secondary">{t('overview.noActivity')}</Typography>
        ) : (
          <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none' }}>
            {entries.map((entry) => {
              const Icon = ICONS[entry.kind];
              return (
                <Box
                  component="li"
                  key={entry.key}
                  sx={{
                    display: 'flex',
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    gap: 1.5,
                    py: 1.25,
                    borderTop: 1,
                    borderColor: 'divider',
                    '&:first-of-type': { borderTop: 0, pt: 0 },
                  }}
                >
                  <Icon
                    aria-hidden
                    sx={{
                      color: entry.kind === 'reversal' ? 'text.secondary' : 'primary.main',
                      flexShrink: 0,
                      mt: { xs: 0.25, sm: 0 },
                    }}
                  />
                  {/* On phones the time goes under the text, so long names do not squeeze it. */}
                  <Box
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: { xs: 'column', sm: 'row' },
                      alignItems: { xs: 'flex-start', sm: 'center' },
                      gap: { xs: 0.25, sm: 1.5 },
                    }}
                  >
                    <Link
                      component={RouterLink}
                      to={entry.to}
                      sx={{ flex: 1, minWidth: 0, color: 'text.primary', overflowWrap: 'anywhere' }}
                    >
                      {describe(entry)}
                    </Link>
                    <Typography
                      component="time"
                      dateTime={entry.at}
                      color="text.secondary"
                      sx={{
                        whiteSpace: 'nowrap',
                        fontVariantNumeric: 'tabular-nums',
                        fontSize: { xs: '0.875rem', sm: '1rem' },
                      }}
                    >
                      {formatWhen(entry.at, language)}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </CardBody>
    </DashboardCard>
  );
}
