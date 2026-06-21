import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';

const protectedPaths = ["/canvas", "/gallery", "/square"];

// Create the intl middleware
const intlMiddleware = createMiddleware(routing);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // First, handle internationalization
  const intlResponse = intlMiddleware(request);

  // Check if path needs auth (after intl processing)
  const needsAuth = protectedPaths.some((path) => pathname.includes(path));

  if (!needsAuth && pathname !== "/") {
    return intlResponse || NextResponse.next();
  }

  // For static pages, we handle auth client-side via the Supabase client
  // The proxy only handles the initial redirect for protected routes
  // Actual auth state is managed client-side in each page component

  // If on login or root while authenticated, let the client handle it
  // We can't check auth state synchronously in proxy without a blocking call
  return intlResponse || NextResponse.next();
}

export const config = {
  matcher: ['/', '/(zh|en)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)']
};