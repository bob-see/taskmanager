/**
 * Routes that authenticate themselves rather than through the app proxy.
 */
export function isPublicServiceRoute(pathname: string) {
  return pathname.startsWith("/api/auth") || pathname.startsWith("/api/cron/");
}
