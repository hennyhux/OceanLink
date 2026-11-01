import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router';

import { ActiveStatus } from '@/components/ActiveStatus';
import { useBreadcrumbs } from '@/components/breadcrumbs';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { IconTile } from '@/components/IconTile';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState, LoadingState } from '@/components/States';
import { useToast } from '@/components/toastContext';
import { useCustomer } from '@/features/customers/api';
import { hasCode, hasStatus, requestIdOf } from '@/lib/api/errors';
import { safeReturnTo } from '@/lib/navigation';

import { useUpdateVehicle, useVehicle } from './api';
import { vehicleTitle } from './display';
import { changedVehicleFields, formToWrite, vehicleToForm } from './model';
import { ParkingSection } from './ParkingSection';
import { VehicleForm } from './VehicleForm';

export default function VehicleDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const back = safeReturnTo(params.get('returnTo'), '/vehicles');
  const vehicleQuery = useVehicle(id);
  const vehicle = vehicleQuery.data;
  const ownerQuery = useCustomer(vehicle?.customer_id);
  const [formKey, setFormKey] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  useBreadcrumbs([
    { label: t('nav.vehicles'), to: back.startsWith('/vehicles') ? back : '/vehicles' },
    ...(back.startsWith('/customers') && vehicle
      ? [{ label: vehicle.customer_name, to: back }]
      : []),
    { label: vehicle ? vehicleTitle(vehicle, t) : t('common.loading') },
  ]);

  const update = useUpdateVehicle(vehicle);

  if (vehicleQuery.isPending) return <LoadingState rows={6} />;
  if (!vehicle) {
    const missing = hasStatus(vehicleQuery.error, 404);
    return (
      <ErrorState
        title={missing ? t('vehicles.notFoundTitle') : undefined}
        body={missing ? t('vehicles.notFoundBody') : undefined}
        onRetry={missing ? undefined : () => void vehicleQuery.refetch()}
        requestId={requestIdOf(vehicleQuery.error)}
      />
    );
  }

  // Restart the form from the newest record only when asked, so typing is never wiped.
  const reload = () => {
    void vehicleQuery.refetch().then((result) => {
      if (!result.isError) setFormKey((value) => value + 1);
    });
  };

  const changeStatus = async (isActive: boolean) => {
    setStatusError(null);
    try {
      await update.mutateAsync({ is_active: isActive });
      setConfirm(false);
      toast.success(t(isActive ? 'vehicles.reactivated' : 'vehicles.deactivated'));
    } catch (error) {
      setConfirm(false);
      if (hasCode(error, 'PARKING_STILL_ACTIVE'))
        setStatusError('vehicles.errors.parkingStillActive');
      else if (hasCode(error, 'PLATE_ALREADY_IN_USE', 'UNIT_NUMBER_ALREADY_IN_USE')) {
        setStatusError('vehicles.errors.duplicateReactivate');
      } else if (hasStatus(error, 412)) {
        setStatusError('errors.staleReloaded');
        reload();
      } else setStatusError('errors.saveFailed');
    }
  };

  return (
    <>
      <PageHeader
        leading={
          <IconTile size={56}>
            <LocalShippingOutlinedIcon />
          </IconTile>
        }
        title={vehicleTitle(vehicle, t)}
        status={<ActiveStatus isActive={vehicle.is_active} />}
        subtitle={
          <>
            {t(`vehicles.type.${vehicle.vehicle_type}`)} ·{' '}
            <Link component={RouterLink} to={`/customers/${vehicle.customer_id}`}>
              {vehicle.customer_name}
            </Link>
          </>
        }
      />
      {!vehicle.is_active && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {t('vehicles.inactiveBanner')}
        </Alert>
      )}
      <Stack spacing={3} sx={{ maxWidth: 760 }}>
        <ParkingSection
          key={`${vehicle.id}-${vehicle.version}`}
          vehicle={vehicle}
          ownerActive={ownerQuery.data?.is_active ?? true}
          onStale={reload}
        />

        <Box>
          <Typography component="h2" variant="h2" sx={{ mb: 2 }}>
            {t('vehicles.details')}
          </Typography>
          <VehicleForm
            key={formKey}
            defaultValues={vehicleToForm(vehicle)}
            initialCustomer={ownerQuery.data ?? null}
            lockedOwner={{
              id: vehicle.customer_id,
              name: vehicle.customer_name,
              usdot: ownerQuery.data?.usdot_number ?? null,
            }}
            submitLabel={t('vehicles.saveChanges')}
            onCancel={() => void navigate(back)}
            onReload={reload}
            onSubmit={async (values) => {
              const changes = changedVehicleFields(
                formToWrite(vehicleToForm(vehicle)),
                formToWrite(values),
              );
              if (Object.keys(changes).length > 0) {
                await update.mutateAsync(changes);
                toast.success(t('vehicles.saved'));
              } else toast.success(t('common.noChanges'));
              void navigate(back, { replace: true });
            }}
          />
        </Box>

        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography component="h2" variant="h3" sx={{ mb: 1 }}>
            {t('vehicles.statusTitle')}
          </Typography>
          {statusError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setStatusError(null)}>
              {t(statusError)}
            </Alert>
          )}
          {vehicle.is_active ? (
            <Button color="error" variant="outlined" onClick={() => setConfirm(true)}>
              {t('vehicles.deactivate')}
            </Button>
          ) : (
            <Button
              variant="outlined"
              onClick={() => void changeStatus(true)}
              disabled={update.isPending}
            >
              {t('vehicles.reactivate')}
            </Button>
          )}
        </Paper>
      </Stack>
      <ConfirmDialog
        open={confirm}
        title={t('vehicles.deactivateTitle', { name: vehicleTitle(vehicle, t) })}
        body={t('vehicles.deactivateBody')}
        confirmLabel={t('vehicles.deactivateConfirm')}
        busy={update.isPending}
        onConfirm={() => void changeStatus(false)}
        onClose={() => setConfirm(false)}
      />
    </>
  );
}
