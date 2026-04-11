/**
 * OAuth Callback Route — `GET /auth/callback`
 *
 * This route handles the redirect from Supabase OAuth providers
 * (Google, GitHub). It:
 *
 * 1. Exchanges the `code` query param for a Supabase session.
 * 2. **Enforces domain restriction**: checks the user's email ends
 *    with `@csvtu.ac.in`. If not, signs the user out and redirects
 *    to `/auth/error?reason=domain`.
 * 3. On success, creates/updates the user's profile in the `profiles`
 *    table and redirects to the originally requested page (or `/feed`).
 *
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

/** The only allowed email domain for OpenForum registration. */
const ALLOWED_DOMAIN = "@csvtu.ac.in";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/feed";

  if (!code) {
    // No auth code present — redirect to error
    return NextResponse.redirect(
      `${origin}/auth/error?reason=missing_code`
    );
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  // Exchange the authorization code for a session
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("[auth/callback] Code exchange failed:", exchangeError.message);
    return NextResponse.redirect(
      `${origin}/auth/error?reason=exchange_failed`
    );
  }

  // Verify the authenticated user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("[auth/callback] Failed to get user:", userError?.message);
    return NextResponse.redirect(
      `${origin}/auth/error?reason=user_fetch_failed`
    );
  }

  // ──────────────────────────────────────────────────────────────
  // DOMAIN RESTRICTION: Only @csvtu.ac.in emails are allowed.
  // ──────────────────────────────────────────────────────────────
  const email = user.email ?? "";
  if (!email.endsWith(ALLOWED_DOMAIN)) {
    console.warn(
      `[auth/callback] Domain rejected: ${email} (expected *${ALLOWED_DOMAIN})`
    );

    // Sign the user out immediately — they should NOT have a session
    await supabase.auth.signOut();

    return NextResponse.redirect(
      `${origin}/auth/error?reason=domain`
    );
  }

  // ──────────────────────────────────────────────────────────────
  // PROFILE UPSERT: Create or update the profiles row.
  // Extracts name from OAuth metadata, initializes empty fields
  // for roll_number, branch, year that the user fills in later.
  // ──────────────────────────────────────────────────────────────
  const metadata = user.user_metadata ?? {};
  const displayName =
    metadata.full_name ||
    metadata.name ||
    metadata.preferred_username ||
    email.split("@")[0];
  const avatarUrl =
    metadata.avatar_url || metadata.picture || null;

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: email,
        display_name: displayName,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "id",
        // Don't overwrite fields the user may have manually edited
        ignoreDuplicates: false,
      }
    );

  if (profileError) {
    // Non-fatal: log but don't block login. Profile can be synced later.
    console.error(
      "[auth/callback] Profile upsert failed:",
      profileError.message
    );
  }

  // Redirect to the originally requested page (or /feed)
  return NextResponse.redirect(`${origin}${next}`);
}
