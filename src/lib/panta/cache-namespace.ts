/** No credentials, query parameters, or fragments enter the cache identity. */
export function upstreamNamespace(raw: string | undefined): string {
  if (!raw) return "unconfigured";
  try {
    const url = new URL(raw.trim());
    return `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return "invalid-upstream";
  }
}
