/**
 * Sign Up Page — `/signup`
 *
 * Registers users with email/password using Supabase.
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

const ALLOWED_DOMAIN = "@csvtu.ac.in";

function isAllowedInstitutionalEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(ALLOWED_DOMAIN);
}

function SignupForm() {
  const searchParams = useSearchParams();
  const redirect = normalizePostLoginRedirect(
    searchParams.get("redirect") ?? DEFAULT_POST_LOGIN_REDIRECT
  );
  const loginUrl = `${ROUTES.login}?redirect=${encodeURIComponent(redirect)}`;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password || !confirmPassword) {
      setErrorMessage("Email, password, and confirmation are required.");
      return;
    }

    if (!isAllowedInstitutionalEmail(normalizedEmail)) {
      setErrorMessage("Use your institutional @csvtu.ac.in email.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Use at least 8 characters for your password.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${ROUTES.login}?redirect=${encodeURIComponent(redirect)}`,
        },
      });

      if (error) {
        setErrorMessage(error.message);
        setSubmitting(false);
        return;
      }

      if (data.session) {
        window.location.href = redirect;
        return;
      }

      setSuccessMessage(
        "Account created. Check your email for a confirmation link, then sign in."
      );
      setSubmitting(false);
    } catch (error) {
      console.error("[signup] Sign-up failed:", error);
      setErrorMessage("Sign-up failed. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f6f5f0] px-4">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-[#1a1917] tracking-tight mb-2">
            Create Account
          </h1>
          <p className="text-[#6b6960] text-sm leading-relaxed">
            Register with your institutional email to start publishing on OpenForum.
          </p>
        </div>

        <form onSubmit={handleSignup} className="space-y-3">
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
            autoComplete="new-password"
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-[#d1cfc8] bg-white px-4 py-3 text-sm text-[#1a1917] placeholder:text-[#9a988f] focus:outline-none focus:ring-2 focus:ring-[#d4613c]/25 focus:border-[#d4613c]"
          />

          <input
            type="password"
            autoComplete="new-password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded-lg border border-[#d1cfc8] bg-white px-4 py-3 text-sm text-[#1a1917] placeholder:text-[#9a988f] focus:outline-none focus:ring-2 focus:ring-[#d4613c]/25 focus:border-[#d4613c]"
          />

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#1a1917] px-4 py-3 text-sm font-medium text-[#f6f5f0] transition-colors hover:bg-[#2a2927] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? <Spinner /> : null}
            Create Account
          </button>
        </form>

        {errorMessage ? (
          <p className="mt-4 rounded-lg border border-[#d4613c]/30 bg-[#fff3ef] px-4 py-3 text-sm text-[#8b2f1b]">
            {errorMessage}
          </p>
        ) : null}

        {successMessage ? (
          <p className="mt-4 rounded-lg border border-[#7f9e78]/40 bg-[#eff8ec] px-4 py-3 text-sm text-[#37552f]">
            {successMessage}
          </p>
        ) : null}

        <div className="mt-6 rounded-lg bg-[#e8e6e0] p-4 text-center">
          <p className="text-xs text-[#6b6960] leading-relaxed">
            Only <span className="font-medium text-[#1a1917]">@csvtu.ac.in</span>{" "}
            addresses are allowed.
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-[#6b6960]">
          Already have an account?{" "}
          <Link href={loginUrl} className="underline hover:text-[#1a1917]">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-[#f6f5f0]">
          <Spinner />
        </main>
      }
    >
      <SignupForm />
    </Suspense>
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
