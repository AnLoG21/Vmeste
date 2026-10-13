/**
 * Cursor SDK / Node fetch need HTTPS_PROXY + NODE_USE_ENV_PROXY for geo-blocked VPS IPs.
 * Call once at process start before Agent.create / Agent.resume.
 */
export function applyCursorProxyEnv(proxyUrl: string | undefined): string | null {
  const proxy = (proxyUrl || "").trim();
  if (!proxy) return null;

  if (!process.env.HTTPS_PROXY?.trim()) process.env.HTTPS_PROXY = proxy;
  if (!process.env.HTTP_PROXY?.trim()) process.env.HTTP_PROXY = proxy;
  if (!process.env.https_proxy?.trim()) process.env.https_proxy = proxy;
  if (!process.env.http_proxy?.trim()) process.env.http_proxy = proxy;
  // Node 22+: make undici/fetch honor HTTP(S)_PROXY
  if (!process.env.NODE_USE_ENV_PROXY?.trim()) process.env.NODE_USE_ENV_PROXY = "1";

  return process.env.HTTPS_PROXY || proxy;
}

export function isCursorRegionError(message: string): boolean {
  return /permission_denied|not available in your region|unavailable in your region|geo|region/i.test(
    message
  );
}
