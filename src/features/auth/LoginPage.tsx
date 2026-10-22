import { zodResolver } from '@hookform/resolvers/zod';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation } from 'react-router';
import { z } from 'zod';

import { LanguageSwitch } from '@/components/LanguageSwitch';
import { isApiError, isNetworkError } from '@/lib/api/errors';

import { useAuth } from './useAuth';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'auth.errors.required').email('auth.errors.emailInvalid'),
  password: z.string().min(1, 'auth.errors.required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginFailure {
  messageKey: string;
  requestId?: string;
}

function describeFailure(error: unknown): LoginFailure {
  if (isNetworkError(error)) return { messageKey: 'auth.errors.network' };
  if (isApiError(error)) {
    if (error.status === 401 || error.code === 'INVALID_CREDENTIALS') {
      return { messageKey: 'auth.errors.invalidCredentials' };
    }
    if (error.code === 'ACCOUNT_INACTIVE') {
      return { messageKey: 'auth.errors.accountInactive', requestId: error.requestId };
    }
    if (error.status === 429) return { messageKey: 'auth.errors.rateLimited' };
    if (error.code === 'CSRF_REJECTED') {
      return { messageKey: 'auth.errors.csrf', requestId: error.requestId };
    }
    return { messageKey: 'auth.errors.unexpected', requestId: error.requestId };
  }
  return { messageKey: 'auth.errors.unexpected' };
}

interface LocationState {
  from?: { pathname: string };
}

export function LoginPage() {
  const { t } = useTranslation();
  const { status, login, sessionExpired, logoutServerFailed } = useAuth();
  const location = useLocation();
  const [failure, setFailure] = useState<LoginFailure | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const from = (location.state as LocationState | null)?.from?.pathname ?? '/';

  // One redirect path only: once the session exists, go where the user was headed.
  if (status === 'authenticated') {
    return <Navigate to={from} replace />;
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      await login(values);
    } catch (error) {
      // Keep what the user typed; only the password is cleared on a wrong password.
      const described = describeFailure(error);
      setFailure(described);
      if (described.messageKey === 'auth.errors.invalidCredentials') {
        form.resetField('password');
        form.setFocus('password');
      }
    }
  });

  const submitting = form.formState.isSubmitting;
  const errors = form.formState.errors;

  return (
    <Box
      component="main"
      sx={{
        minHeight: '100svh',
        display: 'grid',
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr)',
          md: 'minmax(380px, 0.9fr) minmax(440px, 1.1fr)',
        },
        gridTemplateRows: { xs: 'auto 1fr', md: 'minmax(100svh, 1fr)' },
        bgcolor: 'background.default',
      }}
    >
      <Box
        component="aside"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: { xs: 84, md: '100svh' },
          px: { xs: 2.5, md: 6 },
          py: { xs: 2, md: 4 },
          bgcolor: 'primary.dark',
          color: '#fff',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box
            sx={{
              display: 'grid',
              placeItems: 'center',
              width: 44,
              height: 44,
              borderRadius: 1,
              bgcolor: alpha('#fff', 0.12),
              color: 'success.light',
            }}
          >
            <LocalShippingOutlinedIcon aria-hidden />
          </Box>
          <Typography variant="h6" fontWeight={700}>
            OceanLink
          </Typography>
        </Stack>

        <Box
          sx={{ display: { xs: 'none', md: 'block' }, width: '100%', maxWidth: 500, mx: 'auto' }}
        >
          <Box
            aria-hidden
            sx={{
              position: 'relative',
              display: 'grid',
              placeItems: 'center',
              minHeight: 320,
              mb: 3,
              border: 1,
              borderColor: alpha('#fff', 0.2),
              borderRadius: 2,
              bgcolor: alpha('#fff', 0.06),
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                inset: 'auto 0 48px',
                height: 1,
                bgcolor: alpha('#fff', 0.24),
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                bottom: 24,
                left: '16%',
                right: '16%',
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 1.5,
              }}
            >
              {[0, 1, 2, 3].map((lane) => (
                <Box key={lane} sx={{ height: 4, borderRadius: 1, bgcolor: alpha('#fff', 0.32) }} />
              ))}
            </Box>
            <Stack direction="row" alignItems="center" spacing={2}>
              <PlaceOutlinedIcon sx={{ fontSize: 76, color: 'warning.light' }} />
              <LocalShippingOutlinedIcon sx={{ fontSize: 176, color: '#fff' }} />
            </Stack>
          </Box>
          <Typography variant="overline" sx={{ color: 'success.light', fontWeight: 700 }}>
            OCEANLINK · STAFF PORTAL
          </Typography>
        </Box>

        <Box sx={{ display: { xs: 'none', md: 'block' }, height: 44 }} />
      </Box>

      <Box
        component="section"
        sx={{
          position: 'relative',
          display: 'grid',
          placeItems: 'center',
          minHeight: { xs: 'calc(100svh - 84px)', md: '100svh' },
          px: { xs: 2.5, sm: 5, md: 8 },
          py: { xs: 9, md: 6 },
        }}
      >
        <Box sx={{ position: 'absolute', top: { xs: 12, md: 24 }, right: { xs: 16, md: 28 } }}>
          <LanguageSwitch />
        </Box>
        <Stack
          spacing={3}
          component="form"
          onSubmit={onSubmit}
          noValidate
          sx={{ width: '100%', maxWidth: 440 }}
        >
          <Box>
            <Typography component="h1" variant="h4" fontWeight={700}>
              {t('auth.signInTitle')}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
              {t('auth.signInHint')}
            </Typography>
          </Box>

          {sessionExpired && !failure && (
            <Alert severity="info" role="status">
              <AlertTitle>{t('auth.sessionExpired.title')}</AlertTitle>
              {t('auth.sessionExpired.body')}
            </Alert>
          )}

          {logoutServerFailed && !failure && (
            <Alert severity="info" role="status">
              {t('auth.signOutFailed')}
            </Alert>
          )}

          {failure && (
            <Alert severity="error" role="alert">
              {t(failure.messageKey)}
              {failure.requestId && (
                <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>
                  {t('auth.errors.supportReference', { id: failure.requestId })}
                </Typography>
              )}
            </Alert>
          )}

          <TextField
            label={t('auth.email')}
            type="email"
            autoComplete="username"
            inputMode="email"
            required
            fullWidth
            autoFocus
            helperText={errors.email ? t(errors.email.message ?? '') : t('auth.emailExample')}
            error={Boolean(errors.email)}
            slotProps={{ input: { readOnly: submitting } }}
            {...form.register('email')}
          />

          <TextField
            label={t('auth.password')}
            type="password"
            autoComplete="current-password"
            required
            fullWidth
            helperText={errors.password ? t(errors.password.message ?? '') : ' '}
            error={Boolean(errors.password)}
            slotProps={{ input: { readOnly: submitting } }}
            {...form.register('password')}
          />

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={submitting}
            sx={{ minHeight: 52, fontSize: '1rem' }}
          >
            {submitting ? t('auth.signingIn') : t('auth.signIn')}
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
