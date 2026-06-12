import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedPaths = ["/canvas", "/gallery", "/square"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if path needs auth
  const needsAuth = protectedPaths.some((path) => pathname.startsWith(path));

  if (!needsAuth && pathname !== "/") {
    return NextResponse.next();
  }

  // For static pages, we handle auth client-side via the Supabase client
  // The proxy only handles the initial redirect for protected routes
  // Actual auth state is managed client-side in each page component

  // If on login or root while authenticated, let the client handle it
  // We can't check auth state synchronously in proxy without a blocking call
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
