/**
 * Login Page — `/login`
 *
 * Provides Google and GitHub OAuth sign-in buttons.
 * Clearly communicates the @csvtu.ac.in email restriction.
 * After OAuth, the user is redirected to `/auth/callback` which
 * validates the domain and creates the session.
 */

"use client";

import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_POST_LOGIN_REDIRECT,
  ROUTES,
  normalizePostLoginRedirect,
} from "@/lib/routes";
import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

/** Supported OAuth providers. */
type OAuthProvider = "google" | "github";

/**
 * Inner component that uses useSearchParams (must be wrapped in Suspense).
 *
 * The Supabase client is created lazily inside the click handler
 * (not at module/component init time) so that Next.js can statically
 * prerender this page without needing the env vars at build time.
 */
function LoginForm() {
  const searchParams = useSearchParams();
  const redirect = normalizePostLoginRedirect(
    searchParams.get("redirect") ?? DEFAULT_POST_LOGIN_REDIRECT
  );
  const [loading, setLoading] = useState<OAuthProvider | null>(null);

  /**
   * Initiates the OAuth flow for the given provider.
   * Supabase handles the redirect to the provider's consent screen.
   * After consent, the provider redirects back to `/auth/callback`.
   */
  async function handleOAuth(provider: OAuthProvider) {
    setLoading(provider);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}${ROUTES.auth.callback}?next=${encodeURIComponent(redirect)}`,
          queryParams:
            provider === "google"
              ? { hd: "csvtu.ac.in" } // Hint Google to show only csvtu.ac.in accounts
              : undefined,
        },
      });

      if (error) {
        console.error(`[login] OAuth (${provider}) failed:`, error.message);
        setLoading(null);
      }
    } catch (err) {
      console.error(`[login] Failed to initialize auth:`, err);
      setLoading(null);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f6f5f0] px-4">
      <div className="max-w-sm w-full">
        {/* Brand */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-semibold text-[#1a1917] tracking-tight mb-2">
            OpenForum
          </h1>
          <p className="text-[#6b6960] text-sm leading-relaxed">
            The student editorial platform for UTD CSVTU
          </p>
        </div>

        {/* OAuth Buttons */}
        <div className="space-y-3">
          {/* Google */}
          <button
            onClick={() => handleOAuth("google")}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-3 rounded-lg border border-[#d1cfc8] bg-white px-4 py-3 text-sm font-medium text-[#1a1917] transition-all hover:bg-[#f6f5f0] hover:border-[#b8b6ae] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === "google" ? (
              <Spinner />
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
          </button>

          {/* GitHub */}
          <button
            onClick={() => handleOAuth("github")}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-3 rounded-lg border border-[#d1cfc8] bg-white px-4 py-3 text-sm font-medium text-[#1a1917] transition-all hover:bg-[#f6f5f0] hover:border-[#b8b6ae] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === "github" ? (
              <Spinner />
            ) : (
              <GitHubIcon />
            )}
            Continue with GitHub
          </button>
        </div>

        {/* Domain restriction notice */}
        <div className="mt-6 rounded-lg bg-[#e8e6e0] p-4 text-center">
          <p className="text-xs text-[#6b6960] leading-relaxed">
            Only <span className="font-medium text-[#1a1917]">@csvtu.ac.in</span>{" "}
            email addresses are accepted. Sign in with your institutional account.
          </p>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-[#6b6960]">
          By signing in, you agree to the{" "}
          <a href="/terms" className="underline hover:text-[#1a1917]">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="/privacy" className="underline hover:text-[#1a1917]">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </main>
  );
}

/** Login page wrapper with Suspense for useSearchParams. */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-[#f6f5f0]">
          <Spinner />
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

// ──────────────────────────────────────────────────────────────
// Inline SVG Icons
// ──────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg className="h-5 w-5" fill="#1a1917" viewBox="0 0 24 24">
      <path
        fillRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin text-[#6b6960]"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
