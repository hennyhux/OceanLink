import { createTheme } from '@mui/material/styles';

// Larger text and targets on purpose: the main users are not technical and may use tablets.
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1f5f8b' },
    background: { default: '#f5f7f9', paper: '#ffffff' },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontSize: 16,
    htmlFontSize: 16,
    fontFamily: [
      'system-ui',
      '-apple-system',
      '"Segoe UI"',
      'Roboto',
      '"PingFang SC"',
      '"Hiragino Sans GB"',
      '"Microsoft YaHei"',
      '"Noto Sans CJK SC"',
      'sans-serif',
    ].join(','),
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { minHeight: 44 },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { minWidth: 44, minHeight: 44 },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: { minHeight: 44 },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: { minHeight: 48 },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined' },
    },
    // Helper and error text is what non-technical users need most, so keep it readable.
    MuiFormHelperText: {
      styleOverrides: {
        root: { fontSize: '0.9375rem' },
      },
    },
  },
});
