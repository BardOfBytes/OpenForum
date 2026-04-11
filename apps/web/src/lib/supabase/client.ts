/**
 * Supabase browser client — for use in Client Components (`"use client"`).
 *
 * Creates a singleton Supabase client that reads/writes the auth session
 * from browser cookies via `@supabase/ssr`. This ensures the session is
 * shared between the browser and the server (SSR / API routes / middleware).
 *
 * @example
 * ```tsx
 * "use client";
 * import { createClient } from "@/lib/supabase/client";
 *
 * const supabase = createClient();
 * const { data } = await supabase.auth.getUser();
 * ```
 *
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */

import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a Supabase client configured for browser-side usage.
 *
 * Uses `createBrowserClient` from `@supabase/ssr` which automatically
 * manages auth tokens via cookies, keeping the session in sync with
 * the middleware and server components.
 *
 * @returns A Supabase client instance for browser-side operations.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables. " +
        "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file."
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
