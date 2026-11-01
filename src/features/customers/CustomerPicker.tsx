import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState, type Ref } from 'react';
import { useTranslation } from 'react-i18next';

import { useCustomerList } from './api';
import type { Customer } from './types';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

interface Props {
  value: Customer | null;
  onChange: (customer: Customer | null) => void;
  onBlur: () => void;
  inputRef: Ref<HTMLInputElement>;
  error?: string;
  label: string;
  helperText: string;
  autoFocus?: boolean;
  // Archived customers cannot get new vehicles but can still pay.
  includeInactive?: boolean;
}

// Search-as-you-type customer picker.
export function CustomerPicker({
  value,
  onChange,
  onBlur,
  inputRef,
  error,
  label,
  helperText,
  autoFocus,
  includeInactive = false,
}: Props) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const q = useDebouncedValue(text.trim(), 300);
  const list = useCustomerList({
    q: q || undefined,
    include_inactive: includeInactive || undefined,
    page_size: 20,
  });
  const options: Customer[] = list.data?.items ?? [];

  return (
    <Autocomplete
      value={value}
      onChange={(_event, next) => onChange(next)}
      inputValue={text}
      onInputChange={(_event, next) => setText(next)}
      options={options}
      filterOptions={(items) => items}
      getOptionLabel={(option) => option.display_name}
      isOptionEqualToValue={(option, selected) => option.id === selected.id}
      loading={list.isFetching}
      loadingText={t('common.loading')}
      noOptionsText={q ? t('customers.noMatches') : t('vehicles.typeToSearch')}
      onBlur={onBlur}
      renderOption={(props, option) => {
        const { key, ...rest } = props as typeof props & { key: string };
        return (
          <Box component="li" key={key} {...rest} sx={{ display: 'block !important', py: 1 }}>
            <Typography sx={{ fontWeight: 600 }}>{option.display_name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {[
                t(`customers.type.${option.type}`),
                option.usdot_number && t('vehicles.usdotLabel', { usdot: option.usdot_number }),
              ]
                .filter(Boolean)
                .join(' · ')}
            </Typography>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          inputRef={inputRef}
          label={label}
          required
          autoFocus={autoFocus}
          error={Boolean(error)}
          helperText={error ?? helperText}
        />
      )}
    />
  );
}
