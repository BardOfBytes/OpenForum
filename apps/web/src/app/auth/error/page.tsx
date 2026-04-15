/**
 * Auth Error Page — `/auth/error`
 *
 * Displays human-readable error messages for authentication failures.
 * The `reason` query param determines which message is shown.
 *
 * Reasons:
 * - `domain`         — User's email is not an allowed institutional domain
 * - `missing_code`   — OAuth callback received no authorization code
 * - `exchange_failed` — Code-to-session exchange failed
 * - `user_fetch_failed` — Could not retrieve user after auth
 */

import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { ALLOWED_EMAIL_DOMAINS, formatAllowedEmailDomains } from "@/lib/auth/allowed-email";

/** Map of error reason codes to user-facing messages. */
const ERROR_MESSAGES: Record<string, { title: string; description: string }> = {
  domain: {
    title: "Access Restricted",
    description:
      `OpenForum is exclusively for UTD CSVTU students and faculty. Only ${formatAllowedEmailDomains(
        "and"
      )} email addresses are allowed. Please sign in with your institutional account.`,
  },
  missing_code: {
    title: "Authentication Failed",
    description:
      "No authorization code was received from the identity provider. Please try signing in again.",
  },
  exchange_failed: {
    title: "Authentication Failed",
    description:
      "We couldn't complete the sign-in process. The authorization code may have expired. Please try again.",
  },
  user_fetch_failed: {
    title: "Authentication Failed",
    description:
      "We signed you in but couldn't retrieve your account details. Please try again or contact support.",
  },
};

const DEFAULT_ERROR = {
  title: "Something Went Wrong",
  description:
    "An unexpected error occurred during authentication. Please try signing in again.",
};

interface AuthErrorPageProps {
  searchParams: Promise<{ reason?: string }>;
}

export default async function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const { reason } = await searchParams;
  const error = ERROR_MESSAGES[reason ?? ""] ?? DEFAULT_ERROR;
  const isDomainError = reason === "domain";

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f6f5f0] px-4">
      <div className="max-w-md w-full text-center">
        {/* Error icon */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#d4613c]/10">
          <svg
            className="h-8 w-8 text-[#d4613c]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            {isDomainError ? (
              // Shield icon for domain restriction
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285zm0 13.036h.008v.008H12v-.008z"
              />
            ) : (
              // Alert triangle for other errors
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            )}
          </svg>
        </div>

        {/* Error message */}
        <h1 className="text-2xl font-semibold text-[#1a1917] mb-3 font-[family-name:var(--font-heading)]">
          {error.title}
        </h1>
        <p className="text-[#6b6960] leading-relaxed mb-8">
          {error.description}
        </p>

        {/* Domain-specific help */}
        {isDomainError && (
          <div className="mb-6 rounded-lg bg-[#e8e6e0] p-4 text-left text-sm text-[#1a1917]">
            <p className="font-medium mb-1">Accepted email format:</p>
            <div className="space-y-1">
              {ALLOWED_EMAIL_DOMAINS.map((domain) => (
                <code key={domain} className="block text-[#d4613c]">
                  yourname{domain}
                </code>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-3">
          <Link
            href={ROUTES.login}
            className="inline-flex items-center justify-center rounded-lg bg-[#1a1917] px-6 py-3 text-sm font-medium text-[#f6f5f0] transition-colors hover:bg-[#2a2927]"
          >
            Try Again
          </Link>
          <Link
            href={ROUTES.home}
            className="inline-flex items-center justify-center rounded-lg border border-[#d1cfc8] bg-transparent px-6 py-3 text-sm font-medium text-[#1a1917] transition-colors hover:bg-[#e8e6e0]"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
