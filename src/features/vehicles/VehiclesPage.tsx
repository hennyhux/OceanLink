import AddIcon from '@mui/icons-material/Add';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Link from '@mui/material/Link';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useLocation } from 'react-router';

import { ActiveStatus } from '@/components/ActiveStatus';
import { useBreadcrumbs } from '@/components/breadcrumbs';
import { FilterBar, SearchField } from '@/components/FilterBar';
import { ListCard } from '@/components/ListCard';
import { Money } from '@/components/Money';
import { PageHeader } from '@/components/PageHeader';
import { RecordCard, RecordCardList } from '@/components/RecordCard';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useListSearch } from '@/hooks/useListSearch';
import { requestIdOf } from '@/lib/api/errors';
import { pageCount } from '@/lib/api/paging';
import { withReturnTo } from '@/lib/navigation';

import { useVehicleList } from './api';
import { vehicleIdentifiers, vehicleTitle } from './display';
import type { Vehicle } from './types';

const PAGE_SIZE = 20;

function Rate({ vehicle }: { vehicle: Vehicle }) {
  const { t } = useTranslation();
  return vehicle.parking ? (
    <Money cents={vehicle.parking.monthly_rate.amount} />
  ) : (
    <Typography component="span" color="text.secondary">
      {t('parking.notSetUp')}
    </Typography>
  );
}

export default function VehiclesPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down('md'));
  const location = useLocation();
  const search = useListSearch();
  const includeInactive = search.flag('inactive');
  useBreadcrumbs([{ label: t('nav.vehicles') }]);

  const list = useVehicleList({
    q: search.q || undefined,
    include_inactive: includeInactive || undefined,
    page: search.page,
    page_size: PAGE_SIZE,
  });
  const data = list.data;
  const here = `${location.pathname}${location.search}`;
  const open = (vehicle: Vehicle) => withReturnTo(`/vehicles/${vehicle.id}`, here);
  const ownerLink = (vehicle: Vehicle) => `/customers/${vehicle.customer_id}`;
  const filtered = Boolean(search.q) || includeInactive;

  let content;
  if (list.isPending)
    content = (
      <Box sx={{ px: 3, pb: 3 }}>
        <LoadingState rows={5} />
      </Box>
    );
  else if (list.isError && !data) {
    content = (
      <ErrorState onRetry={() => void list.refetch()} requestId={requestIdOf(list.error)} />
    );
  } else if (data && data.total === 0) {
    content = filtered ? (
      <EmptyState
        message={t('vehicles.noMatches')}
        action={
          <Button variant="outlined" onClick={() => search.setValues({ q: null, inactive: null })}>
            {t('list.clearFilters')}
          </Button>
        }
      />
    ) : (
      <EmptyState
        message={t('vehicles.empty')}
        action={
          <Button
            component={RouterLink}
            to="/vehicles/new"
            variant="contained"
            startIcon={<AddIcon />}
          >
            {t('vehicles.add')}
          </Button>
        }
      />
    );
  } else if (data && narrow) {
    content = (
      <RecordCardList label={t('nav.vehicles')}>
        {data.items.map((vehicle) => (
          <RecordCard
            key={vehicle.id}
            to={open(vehicle)}
            title={vehicleTitle(vehicle, t)}
            status={<ActiveStatus isActive={vehicle.is_active} />}
            footer={
              <>
                <Typography color="text.secondary">{t('parking.currentRate')}</Typography>
                <Rate vehicle={vehicle} />
              </>
            }
          >
            <Typography variant="body2">
              <Link
                component={RouterLink}
                to={ownerLink(vehicle)}
                sx={{ position: 'relative', zIndex: 1, fontWeight: 600 }}
              >
                {vehicle.customer_name}
              </Link>
            </Typography>
            <Typography variant="body2">
              {[t(`vehicles.type.${vehicle.vehicle_type}`), vehicleIdentifiers(vehicle, t)]
                .filter(Boolean)
                .join(' · ')}
            </Typography>
          </RecordCard>
        ))}
      </RecordCardList>
    );
  } else if (data) {
    content = (
      <TableContainer>
        <Table aria-label={t('nav.vehicles')}>
          <TableHead>
            <TableRow>
              <TableCell scope="col">{t('vehicles.columns.vehicle')}</TableCell>
              <TableCell scope="col">{t('vehicles.columns.owner')}</TableCell>
              <TableCell scope="col">{t('vehicles.columns.type')}</TableCell>
              <TableCell scope="col">{t('vehicles.columns.identifiers')}</TableCell>
              <TableCell scope="col" align="right">
                {t('parking.currentRate')}
              </TableCell>
              <TableCell scope="col" align="center">
                {t('customers.columns.status')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.items.map((vehicle) => (
              <TableRow key={vehicle.id} hover>
                <TableCell>
                  <Link component={RouterLink} to={open(vehicle)} sx={{ fontWeight: 600 }}>
                    {vehicleTitle(vehicle, t)}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link component={RouterLink} to={ownerLink(vehicle)}>
                    {vehicle.customer_name}
                  </Link>
                </TableCell>
                <TableCell>{t(`vehicles.type.${vehicle.vehicle_type}`)}</TableCell>
                <TableCell>{vehicleIdentifiers(vehicle, t)}</TableCell>
                <TableCell align="right">
                  <Rate vehicle={vehicle} />
                </TableCell>
                <TableCell align="center">
                  <ActiveStatus isActive={vehicle.is_active} />
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
        title={t('nav.vehicles')}
        primaryAction={{
          label: t('vehicles.add'),
          icon: <AddIcon />,
          to: withReturnTo('/vehicles/new', here),
        }}
      />
      <FilterBar>
        <SearchField
          label={t('vehicles.searchLabel')}
          hint={t('vehicles.searchHint')}
          value={search.text}
          onChange={search.setText}
          onClear={search.clear}
        />
        <FormControlLabel
          sx={{ pt: { sm: 1 } }}
          control={
            <Checkbox
              checked={includeInactive}
              onChange={(event) => search.setFlag('inactive', event.target.checked)}
            />
          }
          label={t('vehicles.showInactive')}
        />
      </FilterBar>
      <ListCard
        title={t('vehicles.listTitle')}
        countLabel={data ? t('vehicles.count', { count: data.total }) : undefined}
        refreshing={list.isFetching && !list.isPending}
        pager={
          data
            ? {
                page: search.page,
                pages: pageCount(data.total, data.page_size),
                onPage: search.setPage,
              }
            : undefined
        }
      >
        {content}
      </ListCard>
    </>
  );
}
