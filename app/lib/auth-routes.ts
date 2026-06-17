export const AUTHENTICATED_HOME_PATH = "/";

export function getSafeAuthCallbackUrl(
  rawCallbackUrl: string | null | undefined,
  baseUrl: string
) {
  if (!rawCallbackUrl) return AUTHENTICATED_HOME_PATH;

  try {
    const url = rawCallbackUrl.startsWith("/")
      ? new URL(rawCallbackUrl, baseUrl)
      : new URL(rawCallbackUrl);
    const base = new URL(baseUrl);
    const pathname = url.pathname;

    if (
      url.origin !== base.origin ||
      pathname === "/login" ||
      pathname.startsWith("/api/auth")
    ) {
      return AUTHENTICATED_HOME_PATH;
    }

    return `${pathname}${url.search}${url.hash}`;
  } catch {
    return AUTHENTICATED_HOME_PATH;
  }
}
