export const ALLOWED_EMAIL_DOMAINS: readonly string[] = [
  "@csvtu.ac.in",
  "@students.csvtu.ac.in",
];

type AllowedDomainConjunction = "and" | "or";

export function isAllowedInstitutionalEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return ALLOWED_EMAIL_DOMAINS.some((domain) => normalized.endsWith(domain));
}

export function formatAllowedEmailDomains(conjunction: AllowedDomainConjunction = "or"): string {
  if (ALLOWED_EMAIL_DOMAINS.length === 0) return "";
  if (ALLOWED_EMAIL_DOMAINS.length === 1) return ALLOWED_EMAIL_DOMAINS[0];

  const domains = [...ALLOWED_EMAIL_DOMAINS];
  const last = domains.pop();
  return `${domains.join(", ")} ${conjunction} ${last}`;
}
