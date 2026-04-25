export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    /*
     * Protect everything except:
     * - NextAuth routes
     * - Next internals
     * - static files/icons/manifests
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|logo.png|manifest.webmanifest).*)",
  ],
};