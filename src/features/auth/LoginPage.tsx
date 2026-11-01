import VisibilityIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOffOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';

import { LanguageSwitch } from '@/components/LanguageSwitch';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { hasCode, requestIdOf } from '@/lib/api/errors';
import { safeReturnTo } from '@/lib/navigation';

import { FullPageLoading } from './guards';
import { useAuth } from './useAuth';

const schema = z.object({
  email: z.string().trim().min(1, 'auth.emailRequired').email('auth.emailInvalid'),
  password: z.string().min(1, 'auth.passwordRequired'),
});
type Values = z.infer<typeof schema>;

function failureKey(error: unknown): string {
  if (hasCode(error, 'INVALID_CREDENTIALS')) return 'auth.invalidCredentials';
  if (hasCode(error, 'ACCOUNT_INACTIVE')) return 'auth.accountInactive';
  if (hasCode(error, 'RATE_LIMITED')) return 'auth.rateLimited';
  if (hasCode(error, 'CSRF_REJECTED')) return 'errors.csrf';
  return 'auth.unavailable';
}

export function LoginPage() {
  const { t } = useTranslation();
  const auth = useAuth();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const [params] = useSearchParams();
  const returnTo = safeReturnTo(params.get('returnTo'), '/');
  const [showPassword, setShowPassword] = useState(false);
  const [failure, setFailure] = useState<{ key: string; requestId?: string } | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });
  const { errors, isSubmitting } = form.formState;

  if (auth.status === 'loading') return <FullPageLoading />;
  if (auth.status === 'signedIn') return <Navigate to={returnTo} replace />;

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      await auth.login(values);
      void navigate(returnTo, { replace: true });
    } catch (error) {
      setFailure({ key: failureKey(error), requestId: requestIdOf(error) });
      form.setValue('password', '');
      form.setFocus('password');
    }
  });

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2 }}>
        <LanguageSwitch />
      </Box>
      <Box component="main" sx={{ flex: 1, display: 'grid', placeItems: 'center', px: 2, pb: 8 }}>
        <Stack spacing={3} sx={{ width: '100%', maxWidth: 440 }}>
          <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center">
            <Box
              aria-hidden
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: 'primary.main',
                color: 'common.white',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <LocalShippingOutlinedIcon />
            </Box>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 700 }}>OceanLink</Typography>
          </Stack>
          <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 } }}>
            <Typography variant="h1" sx={{ mb: 1 }}>
              {t('auth.title')}
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              {t('auth.subtitle')}
            </Typography>
            {auth.signedOutReason === 'expired' && !failure && (
              <Alert severity="info" sx={{ mb: 2 }}>
                {t('auth.expired')}
              </Alert>
            )}
            {!online && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {t('shell.offline')}
              </Alert>
            )}
            {failure && (
              <Alert severity="error" role="alert" sx={{ mb: 2 }}>
                {t(failure.key)}
                {failure.requestId && (
                  <Typography variant="caption" component="div">
                    {t('errors.problemNumber', { id: failure.requestId })}
                  </Typography>
                )}
              </Alert>
            )}
            <Stack component="form" noValidate spacing={2.5} onSubmit={submit}>
              <TextField
                label={t('auth.email')}
                type="email"
                autoComplete="username"
                required
                autoFocus
                error={Boolean(errors.email)}
                helperText={errors.email?.message ? t(errors.email.message) : t('auth.emailHint')}
                {...form.register('email')}
              />
              <TextField
                label={t('auth.password')}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                error={Boolean(errors.password)}
                helperText={errors.password?.message ? t(errors.password.message) : undefined}
                {...form.register('password')}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={t(showPassword ? 'auth.hidePassword' : 'auth.showPassword')}
                          onClick={() => setShowPassword((value) => !value)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={isSubmitting || !online}
              >
                {isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
              </Button>
            </Stack>
          </Paper>
        </Stack>
      </Box>
    </Box>
  );
}
