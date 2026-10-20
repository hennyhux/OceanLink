// Only same-site paths are accepted so a crafted ?returnTo= cannot send someone elsewhere.
export function safeReturnTo(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  // Control characters are stripped by browsers, so "/\t/evil.com" would become "//evil.com".
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  return value;
}
