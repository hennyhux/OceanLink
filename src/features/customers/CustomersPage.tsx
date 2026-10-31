import AddIcon from '@mui/icons-material/Add';
import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
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
import { useTheme } from '@mui/material/styles';
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

export function CustomersPage() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('md'));
  const {
    urlQ,
    includeInactive,
    showOverdue,
    page,
    searchText,
    setSearchText,
    clearSearch,
    updateParams,
  } = useListSearch();

  const list = useCustomerList({
    q: urlQ.trim() || undefined,
    include_inactive: includeInactive || undefined,
    overdue_only: showOverdue || undefined,
    page,
    page_size: PAGE_SIZE,
  });

  const data = list.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const hasFilters = Boolean(urlQ.trim()) || includeInactive || showOverdue;
  const isEmpty = data !== undefined && data.total === 0;
  const pageOutOfRange = data !== undefined && data.total > 0 && data.items.length === 0;
  const balanceLabel = (amount: number) =>
    amount < 0
      ? `${t('account.creditBalance')}: ${formatMoney(Math.abs(amount), i18n.resolvedLanguage ?? 'zh-CN')}`
      : formatMoney(amount, i18n.resolvedLanguage ?? 'zh-CN');
  const searchField = (
    <TextField
      label={t('customers.searchLabel')}
      helperText={isNarrow ? undefined : t('customers.searchHint')}
      size={isNarrow ? 'small' : 'medium'}
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
              <IconButton aria-label={t('common.clearSearch')} onClick={clearSearch} edge="end">
                <ClearIcon />
              </IconButton>
            </InputAdornment>
          ) : null,
        },
      }}
    />
  );
  const inactiveFilter = (
    <FormControlLabel
      sx={{
        whiteSpace: { xs: 'normal', sm: 'nowrap' },
        alignSelf: { sm: 'flex-start' },
        mt: { sm: 1 },
        m: 0,
        gap: 0.25,
        minHeight: 44,
        minWidth: 0,
        width: { xs: '100%', sm: 'auto' },
        flex: { xs: '0 0 100%', sm: '0 0 auto' },
        '& .MuiFormControlLabel-label': { fontSize: '0.9375rem', overflowWrap: 'anywhere' },
      }}
      control={
        <Checkbox
          size="small"
          sx={{ width: 44, height: 44, p: '13px', flex: '0 0 44px' }}
          checked={includeInactive}
          onChange={(event) =>
            updateParams({ inactive: event.target.checked ? '1' : null, page: null })
          }
        />
      }
      label={t('customers.showInactive')}
    />
  );
  const overdueFilter = (
    <FormControlLabel
      sx={{
        whiteSpace: { xs: 'normal', sm: 'nowrap' },
        alignSelf: { sm: 'flex-start' },
        mt: { sm: 1 },
        m: 0,
        gap: 0.25,
        minHeight: 44,
        minWidth: 0,
        width: { xs: '100%', sm: 'auto' },
        flex: { xs: '0 0 100%', sm: '0 0 auto' },
        '& .MuiFormControlLabel-label': { fontSize: '0.9375rem', overflowWrap: 'anywhere' },
      }}
      control={
        <Checkbox
          size="small"
          sx={{ width: 44, height: 44, p: '13px', flex: '0 0 44px' }}
          checked={showOverdue}
          onChange={(event) =>
            updateParams({ overdue: event.target.checked ? '1' : null, page: null })
          }
        />
      }
      label={t('customers.showOverdue')}
    />
  );

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
          isNarrow ? undefined : (
            <Button
              component={RouterLink}
              to="/customers/new"
              variant="contained"
              size={isNarrow ? 'medium' : 'large'}
              startIcon={<AddIcon />}
              sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              {t('customers.add')}
            </Button>
          )
        }
      />

      {isNarrow ? (
        <Box sx={{ mb: 1 }}>
          {searchField}
          <Stack spacing={0.125} sx={{ mt: 0.25 }}>
            {data && (
              <Typography
                variant="body2"
                color="text.secondary"
                role="status"
                sx={{
                  minHeight: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  fontSize: '0.8125rem',
                  textAlign: 'right',
                }}
              >
                {t('common.resultsCount', { count: data.total })}
              </Typography>
            )}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                columnGap: 0.5,
                width: '100%',
              }}
            >
              {inactiveFilter}
              {overdueFilter}
            </Box>
          </Stack>
        </Box>
      ) : (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            {searchField}
            {inactiveFilter}
            {overdueFilter}
          </Stack>
        </Paper>
      )}

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
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 4 }, textAlign: 'center' }}>
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
          {!isNarrow && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }} role="status">
              {t('common.resultsCount', { count: data.total })}
            </Typography>
          )}

          {isNarrow ? (
            <Stack
              spacing={1}
              component="ul"
              sx={{
                listStyle: 'none',
                p: 0,
                m: 0,
                pb: 'calc(88px + env(safe-area-inset-bottom))',
              }}
            >
              {data.items.map((customer) => (
                <Paper
                  key={customer.id}
                  component="li"
                  variant="outlined"
                  sx={{
                    p: 1.25,
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'background-color 120ms ease, border-color 120ms ease',
                    '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' },
                  }}
                >
                  <Link
                    component={RouterLink}
                    to={`/customers/${customer.id}`}
                    aria-label={customer.display_name}
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      zIndex: 0,
                      display: 'block',
                      color: 'transparent',
                      fontSize: 0,
                      textDecoration: 'none',
                      borderRadius: 'inherit',
                      '&:focus-visible': {
                        outline: '3px solid',
                        outlineColor: 'primary.main',
                        outlineOffset: 2,
                      },
                    }}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                    <Typography
                      component="span"
                      variant="subtitle1"
                      fontWeight={600}
                      sx={{
                        flex: '1 1 auto',
                        minWidth: 0,
                        fontSize: '0.9375rem',
                        lineHeight: 1.25,
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {customer.display_name}
                    </Typography>
                    <Box sx={{ flexShrink: 0 }}>
                      <ActiveStatusChip isActive={customer.is_active} />
                    </Box>
                  </Box>
                  <Box sx={{ mt: 0.5, minWidth: 0 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t(`customers.type.${customer.type}`)}
                      {customer.usdot_number ? ` · USDOT ${customer.usdot_number}` : ''}
                    </Typography>
                    {customer.phone && (
                      <Link
                        href={`tel:${customer.phone}`}
                        variant="body2"
                        underline="hover"
                        sx={{ position: 'relative', zIndex: 1 }}
                      >
                        {customer.phone}
                      </Link>
                    )}
                  </Box>
                  <Stack
                    direction="row"
                    flexWrap="wrap"
                    justifyContent="space-between"
                    alignItems="center"
                    columnGap={1}
                    rowGap={0.5}
                    sx={{ mt: 0.75, pt: 0.75, borderTop: 1, borderColor: 'divider' }}
                  >
                    <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.75}>
                      <Typography variant="body2" color="text.secondary">
                        {t(
                          customer.net_balance.amount < 0
                            ? 'account.creditBalance'
                            : 'account.owes',
                        )}
                        :
                      </Typography>
                      <Chip
                        size="small"
                        color={
                          customer.net_balance.amount < 0
                            ? 'success'
                            : customer.net_balance.amount > 0
                              ? 'error'
                              : 'default'
                        }
                        variant={customer.net_balance.amount === 0 ? 'outlined' : 'filled'}
                        label={formatMoney(
                          Math.abs(customer.net_balance.amount),
                          i18n.resolvedLanguage ?? 'zh-CN',
                        )}
                        sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
                      />
                    </Stack>
                    {customer.overdue_balance.amount > 0 && (
                      <Typography
                        variant="body2"
                        color="error.dark"
                        sx={{ flexBasis: '100%', textAlign: 'right' }}
                      >
                        {t('account.overdueShort')}:{' '}
                        {formatMoney(
                          customer.overdue_balance.amount,
                          i18n.resolvedLanguage ?? 'zh-CN',
                        )}
                      </Typography>
                    )}
                  </Stack>
                </Paper>
              ))}
            </Stack>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table aria-label={t('customers.title')}>
                <TableHead
                  sx={{
                    '& .MuiTableCell-root': {
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      fontWeight: 700,
                      borderBottomColor: 'primary.dark',
                    },
                  }}
                >
                  <TableRow>
                    <TableCell sx={{ minWidth: 180 }}>{t('customers.columns.name')}</TableCell>
                    <TableCell>{t('customers.columns.contact')}</TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      {t('account.owes')}
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
                      <TableCell align="center">
                        <Stack alignItems="center" spacing={0.25}>
                          <Chip
                            size="small"
                            color={
                              customer.net_balance.amount < 0
                                ? 'success'
                                : customer.net_balance.amount > 0
                                  ? 'error'
                                  : 'default'
                            }
                            variant={customer.net_balance.amount === 0 ? 'outlined' : 'filled'}
                            label={balanceLabel(customer.net_balance.amount)}
                            sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
                          />
                          {customer.overdue_balance.amount > 0 && (
                            <Typography variant="body2" color="error.dark">
                              {t('account.overdueShort')}:{' '}
                              {formatMoney(
                                customer.overdue_balance.amount,
                                i18n.resolvedLanguage ?? 'zh-CN',
                              )}
                            </Typography>
                          )}
                        </Stack>
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
