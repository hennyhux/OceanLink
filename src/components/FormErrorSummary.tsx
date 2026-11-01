import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Link from '@mui/material/Link';
import { useEffect, useRef } from 'react';
import type { FieldErrors, FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

interface FormErrorSummaryProps<T extends FieldValues> {
  errors: FieldErrors<T>;
  labels: Partial<Record<keyof T & string, string>>;
  submitCount: number;
  onPick: (field: keyof T & string) => void;
}

// After a failed submit, lists every problem at the top with a link to each field.
export function FormErrorSummary<T extends FieldValues>({
  errors,
  labels,
  submitCount,
  onPick,
}: FormErrorSummaryProps<T>) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const fields = (Object.keys(labels) as (keyof T & string)[]).filter((name) => errors[name]);

  useEffect(() => {
    if (submitCount > 0) ref.current?.scrollIntoView?.({ block: 'nearest' });
  }, [submitCount]);

  if (submitCount === 0 || fields.length === 0) return null;
  return (
    <Alert severity="error" ref={ref} sx={{ mb: 3 }}>
      <AlertTitle>{t('form.fixThese', { count: fields.length })}</AlertTitle>
      <ul style={{ margin: 0, paddingInlineStart: 20 }}>
        {fields.map((name) => {
          const message = errors[name]?.message;
          return (
            <li key={name}>
              <Link
                component="button"
                type="button"
                onClick={() => onPick(name)}
                sx={{ color: 'inherit', fontSize: '1rem', textAlign: 'left' }}
              >
                {labels[name]}: {typeof message === 'string' ? t(message) : t('form.invalid')}
              </Link>
            </li>
          );
        })}
      </ul>
    </Alert>
  );
}
