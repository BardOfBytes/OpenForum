/**
 * Next.js Middleware — Supabase session refresh.
 *
 * Runs on every matched request to refresh the Supabase auth session.
 * Without this, the JWT stored in cookies would expire and the user
 * would be silently logged out even though they have a valid refresh token.
 *
 * This middleware:
 * 1. Reads the auth cookies from the incoming request.
 * 2. Calls `supabase.auth.getUser()` to validate and potentially refresh the JWT.
 * 3. Writes any updated cookies to the outgoing response.
 * 4. Redirects unauthenticated users away from protected routes.
 *
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_POST_LOGIN_REDIRECT, ROUTES } from "@/lib/routes";

/** Routes that require authentication. */
const PROTECTED_ROUTES = [ROUTES.write, "/profile", "/search"];

/** Routes that authenticated users should be redirected away from. */
const AUTH_ROUTES = [ROUTES.login, "/auth"];

/**
 * Determines if a given pathname starts with any of the specified prefixes.
 */
function matchesRoute(pathname: string, routes: string[]): boolean {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

/**
 * Updates the Supabase session by refreshing the JWT if needed.
 *
 * Creates a Supabase client wired to read cookies from the request
 * and write updated cookies to the response. The call to `getUser()`
 * triggers the token refresh if the access token is expired.
 */
async function updateSession(request: NextRequest) {
  // Bail out gracefully if Supabase is not configured (local dev without .env.local)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Set cookies on the request (for downstream server components)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Set cookies on the response (for the browser)
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do NOT use `getSession()` here — it reads from cookies
  // without contacting Supabase, so the token might be stale.
  // `getUser()` forces a server-side validation and refresh.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Redirect unauthenticated users away from protected routes
  if (!user && matchesRoute(pathname, PROTECTED_ROUTES)) {
    const url = request.nextUrl.clone();
    url.pathname = ROUTES.login;
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages (login, etc.)
  if (user && matchesRoute(pathname, AUTH_ROUTES)) {
    const url = request.nextUrl.clone();
    url.pathname = DEFAULT_POST_LOGIN_REDIRECT;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

/**
 * Matcher configuration — skip middleware for static assets, images,
 * favicon, and the callback route (which handles its own auth logic).
 */
export const config = {
  matcher: [
    /*
     * Match all routes EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (browser favicon)
     * - public folder assets (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
