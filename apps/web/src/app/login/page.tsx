/**
 * Login Page — `/login`
 *
 * Provides OAuth and email/password sign-in.
 * Access is restricted to `@csvtu.ac.in` addresses.
 */

"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_POST_LOGIN_REDIRECT,
  ROUTES,
  normalizePostLoginRedirect,
} from "@/lib/routes";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";

type OAuthProvider = "google" | "github";
type LoginMethod = OAuthProvider | "email";

const ALLOWED_DOMAIN = "@csvtu.ac.in";

function isAllowedInstitutionalEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(ALLOWED_DOMAIN);
}

function LoginForm() {
  const searchParams = useSearchParams();
  const redirect = normalizePostLoginRedirect(
    searchParams.get("redirect") ?? DEFAULT_POST_LOGIN_REDIRECT
  );
  const signupUrl = `${ROUTES.signup}?redirect=${encodeURIComponent(redirect)}`;

  const [loading, setLoading] = useState<LoginMethod | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleOAuth(provider: OAuthProvider) {
    setErrorMessage(null);
    setLoading(provider);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}${ROUTES.auth.callback}?next=${encodeURIComponent(redirect)}`,
          queryParams: provider === "google" ? { hd: "csvtu.ac.in" } : undefined,
        },
      });

      if (error) {
        setErrorMessage(error.message);
        setLoading(null);
      }
    } catch (error) {
      console.error(`[login] OAuth (${provider}) failed:`, error);
      setErrorMessage("Could not start sign-in. Please try again.");
      setLoading(null);
    }
  }

  async function handleEmailSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password.trim()) {
      setErrorMessage("Email and password are required.");
      return;
    }

    if (!isAllowedInstitutionalEmail(email)) {
      setErrorMessage("Use your institutional @csvtu.ac.in email.");
      return;
    }

    setLoading("email");

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        setLoading(null);
        return;
      }

      if (!isAllowedInstitutionalEmail(data.user?.email ?? email)) {
        await supabase.auth.signOut();
        window.location.href = `${ROUTES.auth.error}?reason=domain`;
        return;
      }

      window.location.href = redirect;
    } catch (error) {
      console.error("[login] Email sign-in failed:", error);
      setErrorMessage("Sign-in failed. Please try again.");
      setLoading(null);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f6f5f0] px-4">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-[#1a1917] tracking-tight mb-2">
            OpenForum
          </h1>
          <p className="text-[#6b6960] text-sm leading-relaxed">
            Sign in with OAuth or your institutional email.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => handleOAuth("google")}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-3 rounded-lg border border-[#d1cfc8] bg-white px-4 py-3 text-sm font-medium text-[#1a1917] transition-all hover:bg-[#f6f5f0] hover:border-[#b8b6ae] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === "google" ? <Spinner /> : <GoogleIcon />}
            Continue with Google
          </button>

          <button
            onClick={() => handleOAuth("github")}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-3 rounded-lg border border-[#d1cfc8] bg-white px-4 py-3 text-sm font-medium text-[#1a1917] transition-all hover:bg-[#f6f5f0] hover:border-[#b8b6ae] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === "github" ? <Spinner /> : <GitHubIcon />}
            Continue with GitHub
          </button>
        </div>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#d1cfc8]" />
          <span className="text-xs uppercase tracking-wider text-[#6b6960]">
            or
          </span>
          <div className="h-px flex-1 bg-[#d1cfc8]" />
        </div>

        <form onSubmit={handleEmailSignIn} className="space-y-3">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@csvtu.ac.in"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-[#d1cfc8] bg-white px-4 py-3 text-sm text-[#1a1917] placeholder:text-[#9a988f] focus:outline-none focus:ring-2 focus:ring-[#d4613c]/25 focus:border-[#d4613c]"
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-[#d1cfc8] bg-white px-4 py-3 text-sm text-[#1a1917] placeholder:text-[#9a988f] focus:outline-none focus:ring-2 focus:ring-[#d4613c]/25 focus:border-[#d4613c]"
          />
          <button
            type="submit"
            disabled={loading !== null}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#1a1917] px-4 py-3 text-sm font-medium text-[#f6f5f0] transition-colors hover:bg-[#2a2927] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading === "email" ? <Spinner /> : null}
            Sign in with Email
          </button>
        </form>

        {errorMessage ? (
          <p className="mt-4 rounded-lg border border-[#d4613c]/30 bg-[#fff3ef] px-4 py-3 text-sm text-[#8b2f1b]">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-6 rounded-lg bg-[#e8e6e0] p-4 text-center">
          <p className="text-xs text-[#6b6960] leading-relaxed">
            Only <span className="font-medium text-[#1a1917]">@csvtu.ac.in</span>{" "}
            email addresses are accepted.
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-[#6b6960]">
          No account yet?{" "}
          <Link href={signupUrl} className="underline hover:text-[#1a1917]">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}

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
