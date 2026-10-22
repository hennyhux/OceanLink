import AddIcon from '@mui/icons-material/Add';
import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { alpha, useTheme } from '@mui/material/styles';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';

import { ActiveStatusChip } from '@/components/ActiveStatusChip';
import { ErrorState } from '@/components/ErrorState';
import { FlashMessage } from '@/components/FlashMessage';
import { LoadingState } from '@/components/LoadingState';
import { MobilePrimaryAction } from '@/components/MobilePrimaryAction';
import { PageHeader } from '@/components/PageHeader';
import { useListSearch } from '@/hooks/useListSearch';
import { formatMoney } from '@/lib/money';

import { useCustomerList } from './queries';
import type { Customer } from './types';

const PAGE_SIZE = 20;

function contactParts(customer: Customer): [string, string][] {
  const parts: [string, string | null][] = [
    ['contact_name', customer.contact_name],
    ['phone', customer.phone],
    ['email', customer.email],
  ];
  return parts.filter((entry): entry is [string, string] => Boolean(entry[1]));
}

function contactSummary(customer: Customer): string {
  return contactParts(customer)
    .map(([, value]) => value)
    .join(' · ');
}

export function CustomersPage() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('md'));
  const { urlQ, includeInactive, page, searchText, setSearchText, clearSearch, updateParams } =
    useListSearch();

  const list = useCustomerList({
    q: urlQ.trim() || undefined,
    include_inactive: includeInactive || undefined,
    page,
    page_size: PAGE_SIZE,
  });

  const data = list.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const hasFilters = Boolean(urlQ.trim()) || includeInactive;
  const isEmpty = data !== undefined && data.total === 0;
  const pageOutOfRange = data !== undefined && data.total > 0 && data.items.length === 0;
  const balanceLabel = (amount: number) =>
    amount < 0
      ? `${t('account.creditBalance')}: ${formatMoney(Math.abs(amount), i18n.resolvedLanguage ?? 'zh-CN')}`
      : formatMoney(amount, i18n.resolvedLanguage ?? 'zh-CN');
  const metricSx = {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 36,
    px: 1.25,
    py: 0.5,
    border: '1px solid',
    borderRadius: 1,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  };

  // A stale ?page= after a filter change should snap back to the first page.
  useEffect(() => {
    if (pageOutOfRange) updateParams({ page: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageOutOfRange]);

  return (
    <>
      <FlashMessage message={(key) => t(key)} />
      <PageHeader
        title={t('customers.title')}
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <Button
              component={RouterLink}
              to="/customers/new"
              variant="contained"
              size="large"
              startIcon={<AddIcon />}
              sx={{ display: { xs: 'none', md: 'inline-flex' } }}
            >
              {t('customers.add')}
            </Button>
          </Box>
        }
      />

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <TextField
            label={t('customers.searchLabel')}
            helperText={t('customers.searchHint')}
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            type="search"
            fullWidth
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon aria-hidden />
                  </InputAdornment>
                ),
                endAdornment: searchText ? (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={t('common.clearSearch')}
                      onClick={clearSearch}
                      edge="end"
                    >
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              },
            }}
          />
          <FormControlLabel
            sx={{ whiteSpace: 'nowrap', alignSelf: { sm: 'flex-start' }, mt: { sm: 1 } }}
            control={
              <Checkbox
                checked={includeInactive}
                onChange={(event) =>
                  updateParams({ inactive: event.target.checked ? '1' : null, page: null })
                }
              />
            }
            label={t('customers.showInactive')}
          />
        </Stack>
      </Paper>

      {/* Keeps old results on screen while a new search runs, but shows that something is happening. */}
      <Box sx={{ height: 4, mb: 1 }}>
        {list.isFetching && !list.isPending && <LinearProgress aria-label={t('app.loading')} />}
      </Box>

      {list.isPending && <LoadingState label={t('app.loading')} />}

      {list.isError && (
        <ErrorState
          title={t('common.loadFailedTitle')}
          body={t('common.loadFailedBody')}
          actionLabel={t('app.retry')}
          onAction={() => void list.refetch()}
        />
      )}

      {isEmpty && (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography component="h2" variant="h6" fontWeight={600}>
            {hasFilters ? t('customers.noResultsTitle') : t('customers.emptyTitle')}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {hasFilters ? t('customers.noResultsBody') : t('customers.emptyBody')}
          </Typography>
          {!hasFilters && !isNarrow && (
            <Button
              component={RouterLink}
              to="/customers/new"
              variant="contained"
              sx={{ mt: 3 }}
              startIcon={<AddIcon />}
            >
              {t('customers.add')}
            </Button>
          )}
        </Paper>
      )}

      {data && data.items.length > 0 && (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }} role="status">
            {t('common.resultsCount', { count: data.total })}
          </Typography>

          {isNarrow ? (
            <Stack spacing={1.5} component="ul" sx={{ listStyle: 'none', p: 0, m: 0, pb: 10 }}>
              {data.items.map((customer) => (
                <Paper key={customer.id} component="li" variant="outlined" sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                    <Link
                      component={RouterLink}
                      to={`/customers/${customer.id}`}
                      variant="subtitle1"
                      fontWeight={600}
                      underline="hover"
                    >
                      {customer.display_name}
                    </Link>
                    <ActiveStatusChip isActive={customer.is_active} />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {t(`customers.type.${customer.type}`)}
                    {customer.usdot_number ? ` · USDOT ${customer.usdot_number}` : ''}
                  </Typography>
                  {contactSummary(customer) && (
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {contactSummary(customer)}
                    </Typography>
                  )}
                  <Stack
                    direction="column"
                    alignItems="center"
                    gap={1}
                    sx={{ mt: 1, width: '100%' }}
                  >
                    <Box
                      sx={{
                        ...metricSx,
                        width: '100%',
                        justifyContent: 'center',
                        bgcolor: alpha(
                          customer.net_balance.amount < 0
                            ? theme.palette.success.main
                            : theme.palette.warning.main,
                          0.12,
                        ),
                        borderColor: alpha(
                          customer.net_balance.amount < 0
                            ? theme.palette.success.main
                            : theme.palette.warning.main,
                          0.3,
                        ),
                        color:
                          customer.net_balance.amount < 0
                            ? theme.palette.success.dark
                            : theme.palette.warning.dark,
                      }}
                    >
                      <Typography variant="body2" fontWeight={600}>
                        {t('account.owes')}: {balanceLabel(customer.net_balance.amount)}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        ...metricSx,
                        width: '100%',
                        justifyContent: 'center',
                        bgcolor: alpha(theme.palette.info.main, 0.1),
                        borderColor: alpha(theme.palette.info.main, 0.28),
                        color: theme.palette.info.dark,
                      }}
                    >
                      <Typography variant="body2" fontWeight={600}>
                        {t('account.trucks')}: {customer.truck_count}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table aria-label={t('customers.title')}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: 180 }}>{t('customers.columns.name')}</TableCell>
                    <TableCell>{t('customers.columns.contact')}</TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      {t('account.owes')}
                    </TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      {t('account.trucks')}
                    </TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      {t('customers.columns.usdot')}
                    </TableCell>
                    <TableCell>{t('customers.columns.status')}</TableCell>
                    <TableCell align="right">{t('customers.columns.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.items.map((customer) => (
                    <TableRow key={customer.id} hover>
                      <TableCell>
                        <Link
                          component={RouterLink}
                          to={`/customers/${customer.id}`}
                          fontWeight={600}
                          underline="hover"
                        >
                          {customer.display_name}
                        </Link>
                        <Typography variant="body2" color="text.secondary">
                          {t(`customers.type.${customer.type}`)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {contactParts(customer).length === 0
                          ? t('common.notProvided')
                          : contactParts(customer).map(([field, part]) => (
                              <Typography
                                key={field}
                                variant="body2"
                                sx={{ overflowWrap: 'anywhere' }}
                              >
                                {part}
                              </Typography>
                            ))}
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
                      >
                        <Box
                          sx={{
                            ...metricSx,
                            bgcolor: alpha(
                              customer.net_balance.amount < 0
                                ? theme.palette.success.main
                                : theme.palette.warning.main,
                              0.12,
                            ),
                            borderColor: alpha(
                              customer.net_balance.amount < 0
                                ? theme.palette.success.main
                                : theme.palette.warning.main,
                              0.3,
                            ),
                            color:
                              customer.net_balance.amount < 0
                                ? theme.palette.success.dark
                                : theme.palette.warning.dark,
                          }}
                        >
                          {balanceLabel(customer.net_balance.amount)}
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Box
                          sx={{
                            ...metricSx,
                            bgcolor: alpha(theme.palette.info.main, 0.1),
                            borderColor: alpha(theme.palette.info.main, 0.28),
                            color: theme.palette.info.dark,
                          }}
                        >
                          {customer.truck_count}
                        </Box>
                      </TableCell>
                      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                        {customer.usdot_number ?? t('common.notProvided')}
                      </TableCell>
                      <TableCell>
                        <ActiveStatusChip isActive={customer.is_active} />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          component={RouterLink}
                          to={`/customers/${customer.id}/edit`}
                          size="small"
                        >
                          {t('common.edit')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {totalPages > 1 && (
            <Stack
              direction="row"
              spacing={2}
              alignItems="center"
              justifyContent="flex-end"
              sx={{ mt: 2 }}
            >
              <Typography variant="body2">
                {t('common.page', { page: data.page, total: totalPages })}
              </Typography>
              <Button
                disabled={data.page <= 1 || list.isFetching}
                onClick={() => updateParams({ page: String(data.page - 1) })}
              >
                {t('common.previousPage')}
              </Button>
              <Button
                disabled={data.page >= totalPages || list.isFetching}
                onClick={() => updateParams({ page: String(data.page + 1) })}
              >
                {t('common.nextPage')}
              </Button>
            </Stack>
          )}
        </>
      )}
      {isNarrow && (
        <MobilePrimaryAction label={t('customers.add')} to="/customers/new" hideAt="md" />
      )}
    </>
  );
}
