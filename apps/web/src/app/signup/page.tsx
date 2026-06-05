/**
 * Sign Up Page — `/signup`
 *
 * Registers users with email/password using Supabase.
 * Access is restricted to institutional addresses.
 */

"use client";

import Link from "next/link";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_POST_LOGIN_REDIRECT,
  ROUTES,
  normalizePostLoginRedirect,
} from "@/lib/routes";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import {
  formatAllowedEmailDomains,
  isAllowedInstitutionalEmail,
} from "@/lib/auth/allowed-email";

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
      setErrorMessage(
        `Use your institutional ${formatAllowedEmailDomains("or")} email.`
      );
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
    <AuthFrame
      eyebrow="Join the newsroom"
      title="Create account"
      description="Register with your institutional email to start publishing on OpenForum."
      footer={
        <>
          Already have an account?{" "}
          <Link href={loginUrl} className="font-semibold text-text underline hover:text-accent">
            Sign in
          </Link>
        </>
      }
    >
        <form onSubmit={handleSignup} className="space-y-3">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@csvtu.ac.in"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-border bg-bg-elevated px-4 py-3 text-sm text-text placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
          />

          <input
            type="password"
            autoComplete="new-password"
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-border bg-bg-elevated px-4 py-3 text-sm text-text placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
          />

          <input
            type="password"
            autoComplete="new-password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded-lg border border-border bg-bg-elevated px-4 py-3 text-sm text-text placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
          />

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-text px-4 py-3 text-sm font-medium text-text-inverse transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Spinner /> : null}
            Create Account
          </button>
        </form>

        {errorMessage ? (
          <p className="mt-4 rounded-lg border border-error/30 bg-accent-subtle px-4 py-3 text-sm text-error">
            {errorMessage}
          </p>
        ) : null}

        {successMessage ? (
          <p className="mt-4 rounded-lg border border-success/40 bg-surface px-4 py-3 text-sm text-success">
            {successMessage}
          </p>
        ) : null}
    </AuthFrame>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-bg">
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
      className="h-5 w-5 animate-spin text-text-secondary"
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
