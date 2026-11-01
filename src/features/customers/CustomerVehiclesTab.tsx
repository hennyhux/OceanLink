import AddIcon from '@mui/icons-material/Add';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
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
import { Link as RouterLink } from 'react-router';

import { ActiveStatus } from '@/components/ActiveStatus';
import { ListCard } from '@/components/ListCard';
import { Money } from '@/components/Money';
import { RecordCard, RecordCardList } from '@/components/RecordCard';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { vehicleIdentifiers, vehicleTitle } from '@/features/vehicles/display';
import type { Vehicle } from '@/features/vehicles/types';
import { requestIdOf } from '@/lib/api/errors';
import type { Paged } from '@/lib/api/paging';
import { withReturnTo } from '@/lib/navigation';

interface Props {
  customerId: string;
  query: {
    data?: Paged<Vehicle>;
    isPending: boolean;
    isError: boolean;
    error: unknown;
    refetch: () => unknown;
  };
}

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

export function CustomerVehiclesTab({ customerId, query }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down('md'));
  const back = `/customers/${customerId}?tab=vehicles`;
  const addLink = withReturnTo(`/vehicles/new?customer_id=${encodeURIComponent(customerId)}`, back);
  const open = (vehicle: Vehicle) => withReturnTo(`/vehicles/${vehicle.id}`, back);
  const data = query.data;

  let content;
  if (query.isPending)
    content = (
      <Box sx={{ px: 3, pb: 3 }}>
        <LoadingState rows={3} />
      </Box>
    );
  else if (query.isError && !data) {
    content = (
      <ErrorState onRetry={() => void query.refetch()} requestId={requestIdOf(query.error)} />
    );
  } else if (data && data.items.length === 0) {
    content = <EmptyState message={t('customers.noVehicles')} />;
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
    <ListCard
      title={data ? t('customers.vehiclesWithCount', { count: data.total }) : t('nav.vehicles')}
      actions={
        <Button component={RouterLink} to={addLink} variant="outlined" startIcon={<AddIcon />}>
          {t('vehicles.add')}
        </Button>
      }
    >
      {content}
    </ListCard>
  );
}
