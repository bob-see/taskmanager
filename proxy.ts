import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import {
  AUTHENTICATED_HOME_PATH,
  getSafeAuthCallbackUrl,
} from "@/app/lib/auth-routes";

const PUBLIC_FILE = /\.(.*)$/;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-taskmanager-pathname", pathname);

  const next = () =>
    NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

  if (pathname === "/login") {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (token) {
      const callbackUrl = getSafeAuthCallbackUrl(
        request.nextUrl.searchParams.get("callbackUrl"),
        request.nextUrl.origin
      );
      const redirectUrl = new URL(
        callbackUrl || AUTHENTICATED_HOME_PATH,
        request.nextUrl.origin
      );
      return NextResponse.redirect(redirectUrl);
    }

    return next();
  }

  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/logo.png" ||
    pathname === "/manifest.webmanifest" ||
    PUBLIC_FILE.test(pathname)
  ) {
    return next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.href);
    return NextResponse.redirect(loginUrl);
  }

  return next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png|manifest.webmanifest).*)"],
};
