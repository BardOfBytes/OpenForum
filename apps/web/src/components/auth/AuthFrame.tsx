"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { CategoryPill } from "@/components/articles/CategoryPill";
import { CATEGORY_CATALOG } from "@/lib/categories";
import { ROUTES } from "@/lib/routes";

interface AuthFrameProps {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

export function AuthFrame({
  eyebrow,
  title,
  description,
  children,
  footer,
}: AuthFrameProps) {
  return (
    <main className="flex min-h-screen bg-background text-foreground">
      <aside className="relative hidden flex-1 overflow-hidden border-r border-border bg-card p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />

        <div className="relative z-10">
          <Link href={ROUTES.home} className="mb-24 inline-flex items-center">
            <span className="font-serif text-3xl font-bold tracking-tight text-foreground">
              Open<span className="font-light italic text-primary">Forum</span>
            </span>
          </Link>

          <h1 className="max-w-xl font-serif text-[4rem] leading-[1.1] text-foreground">
            A sanctuary for <br />
            <span className="font-light italic text-primary">deep thought.</span>
          </h1>
          <p className="mt-4 max-w-sm text-muted-foreground">
            {description}
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap gap-3 opacity-60">
          {CATEGORY_CATALOG.slice(0, 5).map((category) => (
            <CategoryPill key={category.slug}>
              {category.name}
            </CategoryPill>
          ))}
        </div>
      </aside>

      <section className="flex flex-1 flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center lg:text-left">
            <Link
              href={ROUTES.home}
              className="mb-8 inline-flex items-center lg:hidden"
            >
              <span className="font-serif text-2xl font-bold tracking-tight text-foreground">
                Open<span className="font-light italic text-primary">Forum</span>
              </span>
            </Link>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">
              {eyebrow}
            </p>
            <h2 className="mb-2 font-serif text-3xl font-medium">
              {title}
            </h2>
            <p className="text-sm text-muted-foreground">
              {description}
            </p>
          </div>

          {children}

          <div className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
            <div>
              <p className="mb-1 text-xs font-semibold text-foreground">
                Institutional access only
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Faculty and staff use{" "}
                <code className="rounded bg-muted px-1 font-mono">@csvtu.ac.in</code>; students
                use{" "}
                <code className="rounded bg-muted px-1 font-mono">@students.csvtu.ac.in</code>.
                These accounts can publish, comment, save, and react.
              </p>
            </div>
          </div>

          <div className="text-center text-xs text-muted-foreground">
            {footer}
          </div>
        </div>
      </section>
    </main>
  );
}
