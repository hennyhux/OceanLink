import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { useState, type Ref } from 'react';
import { useTranslation } from 'react-i18next';

import { useCustomerList } from '@/features/customers/queries';
import type { Customer } from '@/features/customers/types';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

interface CustomerPickerProps {
  value: Customer | null;
  onChange: (customer: Customer | null) => void;
  label: string;
  helperText?: string;
  error?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  onBlur?: () => void;
  inputRef?: Ref<HTMLInputElement>;
  includeInactive?: boolean;
  disabled?: boolean;
}

// Finds active customers on the server as you type, so it works with any number of customers.
export function CustomerPicker({
  value,
  onChange,
  label,
  helperText,
  error,
  required,
  autoFocus,
  onBlur,
  inputRef,
  includeInactive = false,
  disabled = false,
}: CustomerPickerProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const debounced = useDebouncedValue(input, 250);
  const list = useCustomerList({
    q: debounced.trim() || undefined,
    page_size: 10,
    include_inactive: includeInactive || undefined,
  });

  return (
    <Autocomplete<Customer>
      disabled={disabled}
      value={value}
      onChange={(_event, next) => onChange(next)}
      inputValue={input}
      onInputChange={(_event, next) => setInput(next)}
      options={list.data?.items ?? []}
      loading={list.isFetching}
      // The server already filtered the list, so do not filter it a second time here.
      filterOptions={(options) => options}
      getOptionLabel={(option) => option.display_name}
      isOptionEqualToValue={(option, selected) => option.id === selected.id}
      loadingText={t('common.loadingOptions')}
      noOptionsText={t('common.noOptions')}
      renderOption={(props, option) => {
        const { key, ...rest } = props;
        return (
          <li key={key} {...rest}>
            {option.display_name}
            {option.usdot_number ? ` · USDOT ${option.usdot_number}` : ''}
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          error={error}
          helperText={helperText}
          autoFocus={autoFocus}
          onBlur={onBlur}
          inputRef={inputRef}
        />
      )}
    />
  );
}
