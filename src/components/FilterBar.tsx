import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import type { SxProps, Theme } from '@mui/material/styles';
import type { ReactNode, Ref } from 'react';
import { useTranslation } from 'react-i18next';

// White card above a list holding the search box and a few filters.
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <Paper
      variant="outlined"
      role="search"
      sx={{
        p: { xs: 2, sm: 2.5 },
        mb: 2,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        gap: { xs: 1, sm: 2 },
      }}
    >
      {children}
    </Paper>
  );
}

interface SearchFieldProps {
  label: string;
  hint?: ReactNode;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  // Enter (or the phone keyboard's Search key) searches right away instead of after the pause.
  onSubmit?: () => void;
  inputRef?: Ref<HTMLInputElement>;
  sx?: SxProps<Theme>;
}

export function SearchField({
  label,
  hint,
  placeholder,
  value,
  onChange,
  onClear,
  onSubmit,
  inputRef,
  sx,
}: SearchFieldProps) {
  const { t } = useTranslation();
  return (
    <TextField
      type="search"
      label={label}
      placeholder={placeholder}
      helperText={hint}
      value={value}
      inputRef={inputRef}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && onSubmit) {
          event.preventDefault();
          onSubmit();
        } else if (event.key === 'Escape' && value) {
          event.preventDefault();
          onClear();
        }
      }}
      sx={{ flex: '1 1 320px', maxWidth: 560, ...sx }}
      slotProps={{
        inputLabel: placeholder ? { shrink: true } : undefined,
        // Plates, unit numbers, and references must not be autocorrected on phones.
        htmlInput: {
          enterKeyHint: 'search',
          autoComplete: 'off',
          autoCorrect: 'off',
          spellCheck: false,
        },
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon aria-hidden />
            </InputAdornment>
          ),
          endAdornment: value ? (
            <InputAdornment position="end">
              <IconButton aria-label={t('common.clearSearch')} onClick={onClear} edge="end">
                <ClearIcon />
              </IconButton>
            </InputAdornment>
          ) : null,
        },
      }}
    />
  );
}
