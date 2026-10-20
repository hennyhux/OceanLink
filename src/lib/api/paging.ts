// Shared list shape from REQUIREMENTS.md section 11.1.
export interface Paged<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

export function toQueryString(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}
