import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
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
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        bgcolor: 'background.default',
        py: 4,
      }}
    >
      <Container maxWidth="xs">
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <LanguageSwitch />
          </Box>
          <Paper elevation={1} sx={{ p: { xs: 3, sm: 4 } }}>
            <Stack spacing={3} component="form" onSubmit={onSubmit} noValidate>
              <Box>
                <Typography component="h1" variant="h5" fontWeight={600}>
                  {t('auth.signInTitle')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
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

              <Button type="submit" variant="contained" size="large" disabled={submitting}>
                {submitting ? t('auth.signingIn') : t('auth.signIn')}
              </Button>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
