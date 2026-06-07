import { AuthErrorExperience } from "@/components/auth/AuthErrorExperience";
import { formatAllowedEmailDomains } from "@/lib/auth/allowed-email";

/** Map of error reason codes to user-facing messages. */
const ERROR_MESSAGES: Record<string, { title: string; description: string }> = {
  domain: {
    title: "Institutional email required",
    description:
      `OpenForum is exclusively available to CSVTu students and faculty. Only ${formatAllowedEmailDomains(
        "and"
      )} email addresses are allowed. Please sign in with your institutional account.`,
  },
  missing_code: {
    title: "Authentication failed",
    description:
      "No authorization code was received from the identity provider. Please try signing in again.",
  },
  exchange_failed: {
    title: "Authentication failed",
    description:
      "We couldn't complete the sign-in process. The authorization code may have expired. Please try again.",
  },
  user_fetch_failed: {
    title: "Authentication failed",
    description:
      "We signed you in but couldn't retrieve your account details. Please try again or contact support.",
  },
};

const DEFAULT_ERROR = {
  title: "Authentication failed",
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
    <AuthErrorExperience
      title={error.title}
      description={error.description}
      isDomainError={isDomainError}
    />
  );
}
