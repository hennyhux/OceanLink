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
import { Link as RouterLink, useLocation } from 'react-router';

import { ActiveStatusChip } from '@/components/ActiveStatusChip';
import { ErrorState } from '@/components/ErrorState';
import { FlashMessage } from '@/components/FlashMessage';
import { LoadingState } from '@/components/LoadingState';
import { MobilePrimaryAction } from '@/components/MobilePrimaryAction';
import { PageHeader } from '@/components/PageHeader';
import { useListSearch } from '@/hooks/useListSearch';

import { vehicleTitle } from './display';
import { useVehicleList } from './queries';
import { formatMoney } from '@/lib/money';
import type { Vehicle } from './types';

const PAGE_SIZE = 20;

function VehicleIdentifiers({ vehicle }: { vehicle: Vehicle }) {
  const { t } = useTranslation();
  if (!vehicle.usdot_number && !vehicle.plate_number) return null;
  return (
    <>
      {vehicle.usdot_number && (
        <Typography variant="body2">
          {t('vehicles.identifiers.usdot', { value: vehicle.usdot_number })}
        </Typography>
      )}
      {vehicle.plate_number && (
        <Typography variant="body2">
          {t('vehicles.identifiers.plate', {
            plate: vehicle.plate_number,
            state: vehicle.plate_jurisdiction ?? '',
          })}
        </Typography>
      )}
    </>
  );
}

export function VehiclesPage() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const location = useLocation();
  const isNarrow = useMediaQuery(theme.breakpoints.down('md'));
  const { urlQ, includeInactive, page, searchText, setSearchText, clearSearch, updateParams } =
    useListSearch();

  const list = useVehicleList({
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

  // A stale ?page= after a filter change should snap back to the first page.
  useEffect(() => {
    if (pageOutOfRange) updateParams({ page: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageOutOfRange]);

  const unitLabel = (unit: string) => t('vehicles.unitLabel', { unit });

  // After editing, come back to this same search, filter and page.
  const here = encodeURIComponent(`${location.pathname}${location.search}`);
  const editHref = (id: string) => `/vehicles/${id}/edit?returnTo=${here}`;
  const searchField = (
    <TextField
      label={t('vehicles.searchLabel')}
      helperText={isNarrow ? undefined : t('vehicles.searchHint')}
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
      label={t('vehicles.showInactive')}
    />
  );
  const rateLabel = (vehicle: Vehicle) =>
    vehicle.parking
      ? formatMoney(vehicle.parking.monthly_rate.amount, i18n.resolvedLanguage ?? 'zh-CN')
      : t('parking.notConfigured');

  return (
    <>
      <FlashMessage message={(key) => t(key)} />
      <PageHeader
        title={t('vehicles.title')}
        action={
          isNarrow ? undefined : (
            <Button
              component={RouterLink}
              to="/vehicles/new"
              variant="contained"
              size="large"
              startIcon={<AddIcon />}
              sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              {t('vehicles.add')}
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
            {inactiveFilter}
          </Stack>
        </Box>
      ) : (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            {searchField}
            {inactiveFilter}
          </Stack>
        </Paper>
      )}

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
            {hasFilters ? t('vehicles.noResultsTitle') : t('vehicles.emptyTitle')}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {hasFilters ? t('vehicles.noResultsBody') : t('vehicles.emptyBody')}
          </Typography>
          {!hasFilters && !isNarrow && (
            <Button
              component={RouterLink}
              to="/vehicles/new"
              variant="contained"
              sx={{ mt: 3 }}
              startIcon={<AddIcon />}
            >
              {t('vehicles.add')}
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
              {data.items.map((vehicle) => (
                <Paper
                  key={vehicle.id}
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
                    to={editHref(vehicle.id)}
                    aria-label={vehicleTitle(vehicle, unitLabel)}
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
                      {vehicleTitle(vehicle, unitLabel)}
                    </Typography>
                    <Box sx={{ flexShrink: 0 }}>
                      <ActiveStatusChip isActive={vehicle.is_active} />
                    </Box>
                  </Box>
                  <Box sx={{ mt: 0.5, minWidth: 0, overflowWrap: 'anywhere' }}>
                    <Typography variant="body2" color="text.secondary">
                      {t(`vehicles.type.${vehicle.vehicle_type}`)}
                    </Typography>
                    <VehicleIdentifiers vehicle={vehicle} />
                    <Link
                      component={RouterLink}
                      to={`/customers/${vehicle.customer_id}`}
                      variant="body2"
                      underline="hover"
                      sx={{ position: 'relative', zIndex: 1 }}
                    >
                      {vehicle.customer_name}
                    </Link>
                  </Box>
                  <Stack
                    direction="row"
                    alignItems="center"
                    flexWrap="wrap"
                    gap={0.75}
                    sx={{ mt: 0.75, pt: 0.75, borderTop: 1, borderColor: 'divider' }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {t('parking.currentRate')}:
                    </Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={rateLabel(vehicle)}
                      sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
                    />
                  </Stack>
                </Paper>
              ))}
            </Stack>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table aria-label={t('vehicles.title')}>
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
                    <TableCell sx={{ minWidth: 160 }}>{t('vehicles.columns.vehicle')}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {t('vehicles.columns.identifiers')}
                    </TableCell>
                    <TableCell sx={{ minWidth: 160 }}>{t('vehicles.columns.customer')}</TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      {t('parking.currentRate')}
                    </TableCell>
                    <TableCell>{t('vehicles.columns.status')}</TableCell>
                    <TableCell align="right">{t('vehicles.columns.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.items.map((vehicle) => (
                    <TableRow key={vehicle.id} hover>
                      <TableCell>
                        <Link
                          component={RouterLink}
                          to={editHref(vehicle.id)}
                          fontWeight={600}
                          underline="hover"
                        >
                          {vehicleTitle(vehicle, unitLabel)}
                        </Link>
                        <Typography variant="body2" color="text.secondary">
                          {t(`vehicles.type.${vehicle.vehicle_type}`)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <VehicleIdentifiers vehicle={vehicle} />
                      </TableCell>
                      <TableCell>
                        <Link
                          component={RouterLink}
                          to={`/customers/${vehicle.customer_id}`}
                          underline="hover"
                        >
                          {vehicle.customer_name}
                        </Link>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          variant="outlined"
                          label={rateLabel(vehicle)}
                          sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
                        />
                      </TableCell>
                      <TableCell>
                        <ActiveStatusChip isActive={vehicle.is_active} />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          component={RouterLink}
                          to={editHref(vehicle.id)}
                          size="small"
                          aria-label={`${t('common.edit')} ${vehicleTitle(vehicle, unitLabel)}`}
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
      {isNarrow && <MobilePrimaryAction label={t('vehicles.add')} to="/vehicles/new" hideAt="md" />}
    </>
  );
}
