import { createTheme } from '@mui/material/styles';

// Design tokens from UX_REBUILD.md section 3. Contrast ratios are noted there; do not
// lighten text colors without re-checking them.
export const tokens = {
  primary: '#2448D8',
  primaryDark: '#1B37A8',
  primaryTint: '#EEF2FF',
  sidebarMuted: '#DCE4FF',
  page: '#F4F6FA',
  paper: '#FFFFFF',
  divider: '#E3E7EF',
  inputBorder: '#7A8499',
  text: '#111827',
  textSecondary: '#4B5563',
  error: '#B42318',
  errorTint: '#FEECEB',
  success: '#116932',
  successTint: '#E7F6EC',
  warning: '#8A4B00',
  warningTint: '#FFF4E5',
  sidebarWidth: 264,
  railWidth: 80,
  topBarHeight: 64,
} as const;

const fontFamily = [
  'system-ui',
  '-apple-system',
  '"Segoe UI"',
  'Roboto',
  '"PingFang SC"',
  '"Hiragino Sans GB"',
  '"Microsoft YaHei"',
  '"Noto Sans CJK SC"',
  'sans-serif',
].join(',');

const base = createTheme();

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: tokens.primary, dark: tokens.primaryDark, light: tokens.primaryTint },
    error: { main: tokens.error, light: tokens.errorTint },
    success: { main: tokens.success, light: tokens.successTint },
    warning: { main: tokens.warning, light: tokens.warningTint },
    background: { default: tokens.page, paper: tokens.paper },
    divider: tokens.divider,
    text: { primary: tokens.text, secondary: tokens.textSecondary },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily,
    fontSize: 16,
    htmlFontSize: 16,
    h1: {
      fontSize: '1.75rem',
      lineHeight: 1.25,
      fontWeight: 700,
      [base.breakpoints.down('sm')]: { fontSize: '1.5rem' },
    },
    h2: { fontSize: '1.25rem', lineHeight: 1.3, fontWeight: 600 },
    h3: { fontSize: '1.125rem', lineHeight: 1.35, fontWeight: 600 },
    h4: { fontSize: '1rem', lineHeight: 1.4, fontWeight: 600 },
    body1: { fontSize: '1rem', lineHeight: 1.5 },
    body2: { fontSize: '0.9375rem', lineHeight: 1.45 },
    caption: { fontSize: '0.875rem', lineHeight: 1.45 },
    overline: { fontSize: '0.75rem', lineHeight: 1.5, fontWeight: 700, letterSpacing: '0.08em' },
    button: { fontSize: '1rem', fontWeight: 600, textTransform: 'none' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { fontVariantNumeric: 'normal' },
        '*:focus-visible': { outline: `3px solid ${tokens.primary}`, outlineOffset: 2 },
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.01ms !important',
            transitionDuration: '0.01ms !important',
          },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { minHeight: 44, borderRadius: 8, paddingInline: 18 },
        sizeLarge: { minHeight: 48 },
      },
    },
    MuiIconButton: { styleOverrides: { root: { minWidth: 44, minHeight: 44 } } },
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: 12 },
        outlined: { borderColor: tokens.divider },
      },
    },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 12 } } },
    MuiDialogTitle: { styleOverrides: { root: { fontSize: '1.25rem', fontWeight: 600 } } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { backgroundColor: tokens.paper },
        notchedOutline: { borderColor: tokens.inputBorder },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { color: tokens.textSecondary } } },
    MuiFormHelperText: {
      styleOverrides: {
        root: { fontSize: '0.875rem', marginInline: 2, color: tokens.textSecondary },
      },
    },
    MuiTextField: { defaultProps: { variant: 'outlined', fullWidth: true } },
    MuiTableCell: {
      styleOverrides: {
        root: {
          fontSize: '0.9375rem',
          paddingTop: 14,
          paddingBottom: 14,
          borderColor: tokens.divider,
        },
        head: {
          fontSize: '0.875rem',
          fontWeight: 600,
          color: tokens.textSecondary,
          backgroundColor: tokens.page,
          whiteSpace: 'nowrap',
        },
      },
    },
    MuiTableRow: { styleOverrides: { root: { minHeight: 56 } } },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: 'none', fontSize: '1rem', fontWeight: 600, minHeight: 48 },
      },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 600, borderRadius: 8 } } },
    MuiTooltip: { styleOverrides: { tooltip: { fontSize: '0.875rem' } } },
    MuiAlert: { styleOverrides: { message: { fontSize: '1rem' } } },
  },
});
