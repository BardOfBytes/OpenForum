"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, Mail } from "lucide-react";
import { ALLOWED_EMAIL_DOMAINS } from "@/lib/auth/allowed-email";
import { ROUTES } from "@/lib/routes";

interface AuthErrorExperienceProps {
  title: string;
  description: string;
  isDomainError: boolean;
}

export function AuthErrorExperience({
  title,
  description,
  isDomainError,
}: AuthErrorExperienceProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-foreground">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md text-center"
      >
        <Link href={ROUTES.home} className="mb-12 inline-flex items-center justify-center">
          <span className="font-serif text-2xl font-bold tracking-tight text-foreground">
            Open<span className="font-light italic text-primary">Forum</span>
          </span>
        </Link>

        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>

        <h1 className="mb-4 font-serif text-3xl font-medium text-foreground">
          {title}
        </h1>
        <p className="mb-8 leading-relaxed text-muted-foreground">
          {description}
        </p>

        {isDomainError && (
          <div className="mb-8 rounded-xl border border-border bg-card p-5 text-left">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
              <div>
                <p className="mb-2 text-sm font-semibold text-foreground">
                  Accepted email domains
                </p>
                <ul className="space-y-1.5">
                  {ALLOWED_EMAIL_DOMAINS.map((domain) => (
                    <li
                      key={domain}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                      <span className="min-w-20 text-xs font-semibold uppercase tracking-wider text-foreground">
                        {domain.startsWith("@students") ? "Students" : "Faculty"}
                      </span>
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                        {domain}
                      </code>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                  If your CSVTU account should have access, contact the OpenForum team.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Link
            href={ROUTES.login}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try a different account
          </Link>
          <Link
            href={ROUTES.home}
            className="flex items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to OpenForum
          </Link>
        </div>
      </motion.div>
    </main>
  );
}
