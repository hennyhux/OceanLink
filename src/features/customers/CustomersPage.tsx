import AddIcon from '@mui/icons-material/Add';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useLocation } from 'react-router';

import { ActiveStatus } from '@/components/ActiveStatus';
import { useBreadcrumbs } from '@/components/breadcrumbs';
import { FilterBar, SearchField } from '@/components/FilterBar';
import { InitialsTile } from '@/components/IconTile';
import { ListCard } from '@/components/ListCard';
import { Balance, Money } from '@/components/Money';
import { PageHeader } from '@/components/PageHeader';
import { RecordCard, RecordCardList } from '@/components/RecordCard';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useListSearch } from '@/hooks/useListSearch';
import { pageCount } from '@/lib/api/paging';
import { requestIdOf } from '@/lib/api/errors';

import { useCustomerList } from './api';
import type { CustomerListItem } from './types';

const PAGE_SIZE = 20;

function OverdueLine({ cents }: { cents: number }) {
  const { t } = useTranslation();
  if (cents <= 0) return null;
  return (
    <Typography
      component="span"
      sx={{
        display: 'block',
        color: 'error.main',
        fontSize: '0.875rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {t('balance.overdue')}: <Money cents={cents} tone="owed" />
    </Typography>
  );
}

function ContactLines({ customer }: { customer: CustomerListItem }) {
  const { t } = useTranslation();
  const lines = [customer.contact_name, customer.phone, customer.email].filter(Boolean);
  if (!lines.length)
    return <Typography color="text.secondary">{t('common.notProvided')}</Typography>;
  return (
    <>
      {customer.contact_name && <Typography variant="body2">{customer.contact_name}</Typography>}
      {customer.phone && (
        <Typography variant="body2">
          <Link href={`tel:${customer.phone}`} sx={{ position: 'relative', zIndex: 1 }}>
            {customer.phone}
          </Link>
        </Typography>
      )}
      {customer.email && (
        <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
          {customer.email}
        </Typography>
      )}
    </>
  );
}

export default function CustomersPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down('md'));
  const location = useLocation();
  const search = useListSearch();
  const includeInactive = search.flag('inactive');
  const overdueOnly = search.flag('overdue');
  useBreadcrumbs([{ label: t('nav.customers') }]);

  const list = useCustomerList({
    q: search.q || undefined,
    include_inactive: includeInactive || undefined,
    overdue_only: overdueOnly || undefined,
    page: search.page,
    page_size: PAGE_SIZE,
  });
  const data = list.data;
  const pages = data ? pageCount(data.total, data.page_size) : 1;
  const filtered = Boolean(search.q) || includeInactive || overdueOnly;
  const here = `${location.pathname}${location.search}`;

  // A page number past the end (after a filter change) goes back to page 1.
  useEffect(() => {
    if (data && data.total > 0 && data.items.length === 0) search.setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const detailLink = (customer: CustomerListItem) =>
    `/customers/${customer.id}?returnTo=${encodeURIComponent(here)}`;

  let content;
  if (list.isPending) {
    content = (
      <Box sx={{ px: 3, pb: 3 }}>
        <LoadingState rows={5} />
      </Box>
    );
  } else if (list.isError && !data) {
    content = (
      <ErrorState onRetry={() => void list.refetch()} requestId={requestIdOf(list.error)} />
    );
  } else if (data && data.total === 0) {
    content = filtered ? (
      <EmptyState
        message={t('customers.noMatches')}
        action={
          <Button
            variant="outlined"
            onClick={() => {
              search.clear();
              search.setValues({ inactive: null, overdue: null, q: null });
            }}
          >
            {t('list.clearFilters')}
          </Button>
        }
      />
    ) : (
      <EmptyState
        message={t('customers.empty')}
        action={
          <Button
            component={RouterLink}
            to="/customers/new"
            variant="contained"
            startIcon={<AddIcon />}
          >
            {t('customers.add')}
          </Button>
        }
      />
    );
  } else if (data && narrow) {
    content = (
      <RecordCardList label={t('nav.customers')}>
        {data.items.map((customer) => (
          <RecordCard
            key={customer.id}
            to={detailLink(customer)}
            title={customer.display_name}
            status={<ActiveStatus isActive={customer.is_active} />}
            footer={
              <>
                <Typography color="text.secondary">{t('balance.owesOrCredit')}</Typography>
                <Box sx={{ textAlign: 'right' }}>
                  <Balance cents={customer.net_balance.amount} />
                  <OverdueLine cents={customer.overdue_balance.amount} />
                </Box>
              </>
            }
          >
            <Typography variant="body2">{t(`customers.type.${customer.type}`)}</Typography>
            {customer.phone && (
              <Typography variant="body2">
                <Link href={`tel:${customer.phone}`} sx={{ position: 'relative', zIndex: 1 }}>
                  {customer.phone}
                </Link>
              </Typography>
            )}
          </RecordCard>
        ))}
      </RecordCardList>
    );
  } else if (data) {
    content = (
      <TableContainer>
        <Table aria-label={t('nav.customers')}>
          <TableHead>
            <TableRow>
              <TableCell scope="col">{t('customers.columns.customer')}</TableCell>
              <TableCell scope="col">{t('customers.columns.contact')}</TableCell>
              <TableCell scope="col">{t('customers.columns.usdot')}</TableCell>
              <TableCell scope="col" align="right">
                {t('customers.columns.balance')}
              </TableCell>
              <TableCell scope="col" align="center">
                {t('customers.columns.status')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.items.map((customer) => (
              <TableRow key={customer.id} hover>
                <TableCell>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <InitialsTile name={customer.display_name} />
                    <Box sx={{ minWidth: 0 }}>
                      <Link
                        component={RouterLink}
                        to={detailLink(customer)}
                        sx={{ fontWeight: 600, fontSize: '1rem' }}
                      >
                        {customer.display_name}
                      </Link>
                      <Typography variant="body2" color="text.secondary">
                        {t(`customers.type.${customer.type}`)}
                      </Typography>
                    </Box>
                  </Stack>
                </TableCell>
                <TableCell>
                  <ContactLines customer={customer} />
                </TableCell>
                <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {customer.usdot_number ?? (
                    <Typography component="span" color="text.secondary">
                      {t('common.none')}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Balance cents={customer.net_balance.amount} />
                  <OverdueLine cents={customer.overdue_balance.amount} />
                </TableCell>
                <TableCell align="center">
                  <ActiveStatus isActive={customer.is_active} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }

  return (
    <>
      <PageHeader
        title={t('nav.customers')}
        primaryAction={{ label: t('customers.add'), icon: <AddIcon />, to: '/customers/new' }}
      />
      <FilterBar>
        <SearchField
          label={t('customers.searchLabel')}
          hint={t('customers.searchHint')}
          value={search.text}
          onChange={search.setText}
          onClear={search.clear}
        />
        <Stack
          direction={{ xs: 'row', sm: 'row' }}
          flexWrap="wrap"
          columnGap={2}
          sx={{ pt: { sm: 1 } }}
        >
          <FormControlLabel
            control={
              <Checkbox
                checked={includeInactive}
                onChange={(event) => search.setFlag('inactive', event.target.checked)}
              />
            }
            label={t('customers.showInactive')}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={overdueOnly}
                onChange={(event) => search.setFlag('overdue', event.target.checked)}
              />
            }
            label={t('customers.overdueOnly')}
          />
        </Stack>
      </FilterBar>
      <ListCard
        title={t('customers.listTitle')}
        countLabel={data ? t('customers.count', { count: data.total }) : undefined}
        refreshing={list.isFetching && !list.isPending}
        pager={data ? { page: search.page, pages, onPage: search.setPage } : undefined}
      >
        {content}
      </ListCard>
    </>
  );
}
