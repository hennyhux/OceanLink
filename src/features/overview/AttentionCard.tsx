import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ContactPhoneOutlinedIcon from '@mui/icons-material/ContactPhoneOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import PriceChangeOutlinedIcon from '@mui/icons-material/PriceChangeOutlined';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';

import { tokens } from '@/app/theme';
import { formatMoney } from '@/lib/money';

import { cardState } from './cardState';
import { CardBody, DashboardCard } from './DashboardCard';
import {
  missingContact,
  isTruncated,
  parkingEndingSoon,
  topOverdue,
  withoutParking,
} from './model';
import { SCAN_SIZE, type OverviewData } from './useOverviewData';

type Level = 'urgent' | 'soon' | 'info';

const LEVELS: Record<Level, { color: string; background: string }> = {
  urgent: { color: tokens.error, background: tokens.errorTint },
  soon: { color: tokens.warning, background: tokens.warningTint },
  info: { color: tokens.primaryDark, background: tokens.primaryTint },
};

function Item({ level, icon, children }: { level: Level; icon: ReactNode; children: ReactNode }) {
  const colors = LEVELS[level];
  return (
    <Box
      component="li"
      sx={{
        display: 'flex',
        gap: 1.5,
        py: 1.5,
        borderTop: 1,
        borderColor: 'divider',
        '&:first-of-type': { borderTop: 0, pt: 0 },
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 36,
          height: 36,
          flexShrink: 0,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          color: colors.color,
          bgcolor: colors.background,
          '& svg': { fontSize: 20 },
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>{children}</Box>
    </Box>
  );
}

// The few things staff should act on today, most urgent first.
export function AttentionCard({ data }: { data: OverviewData }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? 'en';
  const money = (cents: number) => formatMoney(cents, language);
  const { overdueCustomers, allCustomers, vehicles, today } = data;
  const state = cardState(overdueCustomers, allCustomers, vehicles);

  const overdueTotal = overdueCustomers.data?.total ?? 0;
  const vehicleItems = vehicles.data?.items ?? [];
  const ending = today ? parkingEndingSoon(vehicleItems, today) : [];
  const noParking = withoutParking(vehicleItems);
  const noContact = missingContact(allCustomers.data?.items ?? []);
  const partial = isTruncated(vehicles.data) || isTruncated(allCustomers.data);
  const shown = topOverdue(overdueCustomers.data?.items ?? []);
  const nothing =
    overdueTotal === 0 && ending.length === 0 && noParking.length === 0 && noContact.length === 0;

  return (
    <DashboardCard
      title={t('overview.needsAttention')}
      icon={<NotificationsActiveOutlinedIcon />}
      footer={
        overdueTotal > 0
          ? { label: t('overview.viewOverdue'), to: '/customers?overdue=1' }
          : undefined
      }
    >
      <CardBody state={state} rows={4}>
        {nothing ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'success.main' }}>
            <CheckCircleOutlineIcon aria-hidden />
            <Typography sx={{ color: 'text.primary' }}>{t('overview.allClear')}</Typography>
          </Box>
        ) : (
          <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
            {shown.map((customer) => (
              <Item key={customer.id} level="urgent" icon={<ErrorOutlineIcon />}>
                <Link
                  component={RouterLink}
                  to={`/customers/${customer.id}`}
                  sx={{ fontWeight: 600, fontSize: '1.0625rem', overflowWrap: 'anywhere' }}
                >
                  {customer.display_name}
                </Link>
                <Typography>
                  <Box component="span" sx={{ color: 'error.main', fontWeight: 700 }}>
                    {t('overview.overdueBy', { amount: money(customer.overdue_balance.amount) })}
                  </Box>
                  <Box component="span" sx={{ color: 'text.secondary' }}>
                    {' · '}
                    {t('overview.owesTotal', { amount: money(customer.net_balance.amount) })}
                  </Box>
                </Typography>
              </Item>
            ))}
            {overdueTotal > shown.length && (
              <Item level="urgent" icon={<ErrorOutlineIcon />}>
                <Link component={RouterLink} to="/customers?overdue=1" sx={{ fontWeight: 600 }}>
                  {t('overview.moreOverdue', { count: overdueTotal - shown.length })}
                </Link>
              </Item>
            )}
            {ending.length > 0 && (
              <Item level="soon" icon={<EventBusyOutlinedIcon />}>
                <Link component={RouterLink} to="/vehicles" sx={{ fontWeight: 600 }}>
                  {t('overview.endingSoon', { count: ending.length })}
                </Link>
                <Typography color="text.secondary">{t('overview.endingSoonHint')}</Typography>
              </Item>
            )}
            {noContact.length > 0 && (
              <Item level="info" icon={<ContactPhoneOutlinedIcon />}>
                <Link
                  component={RouterLink}
                  to={`/customers/${noContact[0]!.id}/edit`}
                  sx={{ fontWeight: 600 }}
                >
                  {t('overview.missingContact', { count: noContact.length })}
                </Link>
                <Typography color="text.secondary">
                  {t('overview.missingContactHint', {
                    names: noContact
                      .slice(0, 3)
                      .map((customer) => customer.display_name)
                      .join(', '),
                  })}
                </Typography>
              </Item>
            )}
            {noParking.length > 0 && (
              <Item level="info" icon={<PriceChangeOutlinedIcon />}>
                <Link component={RouterLink} to="/vehicles" sx={{ fontWeight: 600 }}>
                  {t('overview.noParking', { count: noParking.length })}
                </Link>
                <Typography color="text.secondary">{t('overview.noParkingHint')}</Typography>
              </Item>
            )}
          </Box>
        )}
        {partial && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {t('overview.partial', { count: SCAN_SIZE })}
          </Typography>
        )}
      </CardBody>
    </DashboardCard>
  );
}
