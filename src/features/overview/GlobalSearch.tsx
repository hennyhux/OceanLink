import AddIcon from '@mui/icons-material/Add';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import SearchOffOutlinedIcon from '@mui/icons-material/SearchOffOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';

import { SearchField } from '@/components/FilterBar';
import { EmptyState } from '@/components/States';
import { IconTile } from '@/components/IconTile';
import { StatusPill } from '@/components/StatusPill';
import { customerKeys, customersApi } from '@/features/customers/api';
import { paymentKeys, paymentsApi } from '@/features/payments/api';
import { ReceiptDialog } from '@/features/payments/ReceiptDialog';
import { vehicleKeys, vehiclesApi } from '@/features/vehicles/api';
import { vehicleIdentifiers, vehicleTitle } from '@/features/vehicles/display';
import { useListSearch } from '@/hooks/useListSearch';
import { requestIdOf } from '@/lib/api/errors';
import { toQueryString, type Paged } from '@/lib/api/paging';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';

import {
  groupHasMatches,
  highlightParts,
  isSearchShortcut,
  needsShowAll,
  resolveFilter,
  searchSummary,
  visibleGroups,
  type GroupStatus,
} from './searchModel';

const RESULT_LIMIT = 5;

// Bolds the typed text inside a result so the eye lands on why it matched.
function Highlight({ text, query }: { text: string; query: string }) {
  const parts = highlightParts(text, query);
  if (!parts) return <>{text}</>;
  return (
    <>
      {parts.before}
      <Box component="mark" sx={{ bgcolor: 'primary.light', color: 'inherit', borderRadius: 0.5 }}>
        {parts.match}
      </Box>
      {parts.after}
    </>
  );
}

interface Row {
  id: string;
  primary: string;
  secondary: string;
  trailing?: ReactNode;
  // Customers and vehicles open their page; payments open the receipt dialog.
  to?: string;
  onClick?: () => void;
  ariaLabel?: string;
  icon?: ReactNode;
}

interface Group extends GroupStatus {
  title: string;
  icon: ReactNode;
  query: UseQueryResult<Paged<unknown>, Error>;
  rows: Row[];
  viewAll: string;
}

// Results kept on screen from the previous text do not count as an answer for the current one.
const status = (query: UseQueryResult<Paged<unknown>, Error>) => ({
  isError: query.isError,
  total: query.isPlaceholderData ? undefined : query.data?.total,
});

function ResultRow({ row, q }: { row: Row; q: string }) {
  const detailsId = useId();
  const statusId = useId();
  const action = row.to ? { component: RouterLink, to: row.to } : { onClick: row.onClick };
  return (
    <ListItem disablePadding divider>
      <ListItemButton
        {...action}
        // The row's name is the record's name; the other facts are read as its description.
        aria-label={row.ariaLabel ?? row.primary}
        aria-describedby={`${detailsId} ${statusId}`}
        sx={{ minHeight: 60, gap: 1.5, px: { xs: 2, sm: 3 }, py: 1.25, textAlign: 'left' }}
      >
        <ListItemText
          primary={<Highlight text={row.primary} query={q} />}
          secondary={row.secondary ? <Highlight text={row.secondary} query={q} /> : undefined}
          slotProps={{
            primary: { sx: { fontWeight: 600, overflowWrap: 'anywhere' } },
            secondary: { id: detailsId, sx: { overflowWrap: 'anywhere' } },
          }}
        />
        {row.trailing && (
          <Box component="span" id={statusId} sx={{ display: 'inline-flex', flexShrink: 0 }}>
            {row.trailing}
          </Box>
        )}
        <Box sx={{ color: 'text.secondary', display: 'inline-flex', flexShrink: 0 }} aria-hidden>
          {row.icon ?? <ChevronRightIcon />}
        </Box>
      </ListItemButton>
    </ListItem>
  );
}

function ResultGroup({ group, q, onRetry }: { group: Group; q: string; onRetry: () => void }) {
  const { t } = useTranslation();
  const headingId = useId();
  const { query, rows } = group;
  const total = group.total ?? 0;
  const loaded = group.total !== undefined;

  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby={headingId}
      sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: { xs: 2, sm: 3 },
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
          <IconTile>{group.icon}</IconTile>
        </Box>
        <Typography id={headingId} component="h3" variant="h3">
          {group.title}
          {loaded && (
            <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              {' '}
              ({total})
            </Box>
          )}
        </Typography>
      </Box>
      <Box sx={{ flex: 1 }}>
        {query.isError ? (
          <Alert
            severity="error"
            sx={{ m: 2 }}
            action={
              <Button color="inherit" size="small" onClick={onRetry}>
                {t('common.retry')}
              </Button>
            }
          >
            {t('overview.search.failed', { title: group.title })}
            {requestIdOf(query.error) && (
              <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>
                {t('errors.problemNumber', { id: requestIdOf(query.error) })}
              </Typography>
            )}
          </Alert>
        ) : !loaded ? (
          <Stack spacing={1} sx={{ p: 2 }} role="status" aria-label={t('common.loading')}>
            <Skeleton variant="rounded" height={44} />
            <Skeleton variant="rounded" height={44} />
          </Stack>
        ) : rows.length === 0 ? (
          <Typography color="text.secondary" sx={{ px: { xs: 2, sm: 3 }, py: 2 }}>
            {t('overview.search.emptyGroup', { title: group.title })}
          </Typography>
        ) : (
          <List disablePadding>
            {rows.map((row) => (
              <ResultRow key={row.id} row={row} q={q} />
            ))}
          </List>
        )}
      </Box>
      {needsShowAll(group.total, rows.length) && (
        <Box sx={{ px: { xs: 2, sm: 3 }, py: 1 }}>
          <Link
            component={RouterLink}
            to={group.viewAll}
            sx={{ display: 'inline-flex', alignItems: 'center', fontWeight: 600, minHeight: 44 }}
          >
            {t('overview.search.viewAll', { count: total, title: group.title })}
          </Link>
        </Box>
      )}
    </Paper>
  );
}

export function GlobalSearch() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? 'en';
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const search = useListSearch();
  const q = search.q.trim();
  const typing = search.text.trim() !== q;
  const enabled = Boolean(q);
  const inputRef = useRef<HTMLInputElement>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const recordParams = { q, include_inactive: true, page_size: RESULT_LIMIT };
  const paymentParams = { q, page_size: RESULT_LIMIT };
  const customers = useQuery({
    queryKey: customerKeys.list(recordParams),
    queryFn: ({ signal }) => customersApi.list(recordParams, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
  const vehicles = useQuery({
    queryKey: vehicleKeys.list(recordParams),
    queryFn: ({ signal }) => vehiclesApi.list(recordParams, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
  const payments = useQuery({
    queryKey: paymentKeys.list(paymentParams),
    queryFn: ({ signal }) => paymentsApi.list(paymentParams, signal),
    enabled,
    placeholderData: keepPreviousData,
  });

  // "/" anywhere on the dashboard jumps to the search box, unless the user is already typing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = Boolean(
        target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]'),
      );
      if (!isSearchShortcut(event, editing)) return;
      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const groups: Group[] = [
    {
      key: 'customers',
      title: t('nav.customers'),
      icon: <PeopleAltOutlinedIcon />,
      query: customers,
      ...status(customers),
      viewAll: `/customers${toQueryString({ q, inactive: 1 })}`,
      rows: (customers.data?.items ?? []).map((customer) => ({
        id: customer.id,
        to: `/customers/${customer.id}`,
        primary: customer.display_name,
        secondary: [customer.contact_name, customer.phone, customer.email]
          .filter(Boolean)
          .join(' · '),
        trailing: !customer.is_active ? (
          <StatusPill tone="neutral" label={t('status.inactive')} />
        ) : undefined,
      })),
    },
    {
      key: 'vehicles',
      title: t('nav.vehicles'),
      icon: <LocalShippingOutlinedIcon />,
      query: vehicles,
      ...status(vehicles),
      viewAll: `/vehicles${toQueryString({ q, inactive: 1 })}`,
      rows: (vehicles.data?.items ?? []).map((vehicle) => ({
        id: vehicle.id,
        to: `/vehicles/${vehicle.id}`,
        primary: vehicleTitle(vehicle, t),
        secondary: [vehicle.customer_name, vehicleIdentifiers(vehicle, t)]
          .filter(Boolean)
          .join(' · '),
        trailing: !vehicle.is_active ? (
          <StatusPill tone="neutral" label={t('status.inactive')} />
        ) : undefined,
      })),
    },
    {
      key: 'payments',
      title: t('nav.payments'),
      icon: <PaymentsOutlinedIcon />,
      query: payments,
      ...status(payments),
      viewAll: `/payments${toQueryString({ q })}`,
      rows: (payments.data?.items ?? []).map((payment) => {
        const amount = formatMoney(payment.amount.amount, language);
        return {
          id: payment.id,
          onClick: () => setReceipt(payment.id),
          ariaLabel: t('overview.search.receipt', { name: payment.customer_name, amount }),
          primary: payment.customer_name,
          secondary: [formatDate(payment.effective_on, language), payment.reference]
            .filter(Boolean)
            .join(' · '),
          trailing: (
            <Stack alignItems="flex-end" spacing={0.5} sx={{ flexShrink: 0 }}>
              <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {amount}
              </Typography>
              {payment.status === 'reversed' && (
                <StatusPill tone="neutral" label={t('status.reversed')} />
              )}
            </Stack>
          ),
          icon: <ReceiptLongOutlinedIcon />,
        };
      }),
    },
  ];

  const busy = typing || groups.some((g) => g.query.isFetching || g.query.isPlaceholderData);
  const summary = searchSummary(groups);
  const settled = summary.kind === 'done';
  const filter = resolveFilter(search.value('in'), groups, settled);
  const shown = visibleGroups(groups, filter, settled);
  const noneFound = summary.kind === 'done' && summary.empty;

  const hint = (
    <>
      {t('overview.search.hint')}
      <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
        {' '}
        {t('overview.search.shortcut')}
      </Box>
    </>
  );

  return (
    <Box component="section" aria-label={t('overview.search.title')} sx={{ mb: 3 }}>
      <Box role="search" sx={{ maxWidth: 760 }}>
        <SearchField
          label={t('overview.search.title')}
          placeholder={t('overview.search.placeholder')}
          hint={hint}
          value={search.text}
          onChange={search.setText}
          onClear={search.clear}
          onSubmit={() => {
            search.commit();
            // Dropping focus on a phone puts the keyboard away so the results are visible.
            if (phone) inputRef.current?.blur();
          }}
          inputRef={inputRef}
          sx={{
            width: '100%',
            maxWidth: 'none',
            '& .MuiInputBase-root': { fontSize: '1.0625rem' },
          }}
        />
      </Box>

      {(enabled || typing) && (
        <Box sx={{ height: 4, mt: 1 }}>{busy && <LinearProgress aria-hidden />}</Box>
      )}

      {enabled && (
        <Box sx={{ mt: 1.5 }}>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.5,
              mb: 2,
            }}
          >
            <Typography role="status" aria-live="polite" sx={{ fontWeight: 600 }}>
              {summary.kind === 'searching'
                ? t('overview.search.searching')
                : summary.count === 0
                  ? t('overview.search.noResults', { q })
                  : t('overview.search.results', { count: summary.count, q })}
              {summary.kind === 'done' && summary.partial && (
                <Box component="span" sx={{ color: 'error.main', fontWeight: 500, ml: 1 }}>
                  {t('overview.search.partial')}
                </Box>
              )}
            </Typography>
            <Button variant="outlined" onClick={search.clear} sx={{ flexShrink: 0 }}>
              {t('overview.search.back')}
            </Button>
          </Box>

          {!noneFound && (
            <Box
              role="group"
              aria-label={t('overview.search.filterLabel')}
              sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}
            >
              {(['all', ...groups.map((g) => g.key)] as const).map((key) => {
                const group = groups.find((g) => g.key === key);
                const count = group && settled && !group.isError ? ` (${group.total ?? 0})` : '';
                return (
                  <ToggleButton
                    key={key}
                    value={key}
                    selected={filter === key}
                    disabled={group ? !groupHasMatches(group, settled) : false}
                    onChange={() => search.setValues({ in: key === 'all' ? null : key })}
                    sx={{ minHeight: 44, px: 2, textTransform: 'none', fontWeight: 600 }}
                  >
                    {group ? group.title : t('overview.search.all')}
                    {count}
                  </ToggleButton>
                );
              })}
            </Box>
          )}

          {noneFound ? (
            <Paper variant="outlined">
              <EmptyState
                icon={<SearchOffOutlinedIcon />}
                message={t('overview.search.emptyTips', { q })}
                action={
                  <Button
                    component={RouterLink}
                    to="/customers/new"
                    variant="outlined"
                    startIcon={<AddIcon />}
                  >
                    {t('customers.add')}
                  </Button>
                }
              />
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {shown.map((group) => (
                <Grid key={group.key} size={{ xs: 12, md: 12 / shown.length }}>
                  <ResultGroup group={group} q={q} onRetry={() => void group.query.refetch()} />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}
      {receipt && <ReceiptDialog paymentId={receipt} onClose={() => setReceipt(null)} />}
    </Box>
  );
}
