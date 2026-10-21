// Supabase's SDK appends auth/v1 and rest/v1 itself. The dashboard also
// exposes a REST endpoint, which is easy to copy into the project URL field.
export function supabaseProjectUrl(
  value: string | undefined,
): string | undefined {
  if (!value?.trim()) return undefined;
  const url = new URL(value.trim());
  if (/^\/(rest|auth)\/v1\/?$/.test(url.pathname)) url.pathname = "/";
  return url.toString().replace(/\/$/, "");
}
