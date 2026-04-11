/**
 * Supabase server client — for use in Server Components, Route Handlers,
 * and Server Actions.
 *
 * Creates a Supabase client that reads/writes cookies via the Next.js
 * `cookies()` API. Each invocation creates a fresh client scoped to
 * the current request (important: do NOT cache or share across requests).
 *
 * @example
 * ```ts
 * // In a Server Component:
 * import { createClient } from "@/lib/supabase/server";
 *
 * export default async function Page() {
 *   const supabase = await createClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 *   // ...
 * }
 * ```
 *
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Creates a Supabase client configured for server-side usage.
 *
 * Must be called inside a Server Component, Route Handler, or Server Action
 * where `cookies()` is available. The client uses cookie-based session
 * management to stay in sync with the browser and middleware.
 *
 * @returns A Supabase client instance for server-side operations.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // `setAll` is called from a Server Component where cookies
            // cannot be mutated. This is safe to ignore — the middleware
            // will handle the refresh on the next request.
          }
        },
      },
    }
  );
}
