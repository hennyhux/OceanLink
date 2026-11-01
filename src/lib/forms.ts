import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import { isApiError } from './api/errors';

// Puts backend field error codes on the matching form fields.
// Returns the first field that got an error so the caller can focus it.
export function applyServerFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
  messages: Record<string, string>,
  fallbackMessage: string,
): Path<T> | undefined {
  if (!isApiError(error)) return undefined;
  const fieldErrors: Record<string, string[]> = { ...(error.fieldErrors ?? {}) };
  let first: Path<T> | undefined;
  for (const [field, codes] of Object.entries(fieldErrors)) {
    if (!(fields as readonly string[]).includes(field)) continue;
    const code = codes[0] ?? '';
    setError(field as Path<T>, { type: 'server', message: messages[code] ?? fallbackMessage });
    first ??= field as Path<T>;
  }
  return first;
}

export const blankToNull = (value: string | undefined | null): string | null => {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
};
