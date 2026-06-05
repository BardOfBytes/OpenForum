import Link from "next/link";
import { ShieldCheck } from "lucide-react";
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
    <main className="min-h-screen bg-bg text-text lg:grid lg:grid-cols-[1.08fr_0.92fr]">
      <aside className="relative hidden overflow-hidden border-r border-border bg-bg-elevated p-12 lg:flex lg:flex-col lg:justify-between">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 18% 18%, rgba(212,97,60,0.13), transparent 32%), radial-gradient(circle at 82% 72%, rgba(61,124,201,0.1), transparent 34%)",
          }}
          aria-hidden="true"
        />

        <div className="relative z-10">
          <Link href={ROUTES.home} className="mb-24 inline-flex items-center gap-2.5">
            <span className="h-8 w-2 rounded-full bg-accent" aria-hidden="true" />
            <span className="font-heading text-3xl font-bold tracking-tight">
              Open<span className="font-normal italic text-accent">Forum</span>
            </span>
          </Link>

          <p className="mb-4 text-xs font-bold uppercase tracking-[0.3em] text-accent">
            {eyebrow}
          </p>
          <h1 className="max-w-xl font-heading text-6xl font-semibold leading-[1.06] tracking-tight">
            A sanctuary for <span className="font-normal italic text-accent">deep thought.</span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-text-secondary">
            {description}
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap gap-3 opacity-75">
          {CATEGORY_CATALOG.slice(0, 5).map((category) => (
            <span
              key={category.slug}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-bg/70 px-3 py-1.5 text-xs font-semibold text-text-secondary"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: category.color }}
                aria-hidden="true"
              />
              {category.name}
            </span>
          ))}
        </div>
      </aside>

      <section className="flex min-h-screen items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center lg:text-left">
            <Link
              href={ROUTES.home}
              className="mb-8 inline-flex items-center gap-2 lg:hidden"
            >
              <span className="h-7 w-1.5 rounded-full bg-accent" aria-hidden="true" />
              <span className="font-heading text-2xl font-bold tracking-tight">
                Open<span className="font-normal italic text-accent">Forum</span>
              </span>
            </Link>
            <h2 className="mb-2 font-heading text-3xl font-semibold tracking-tight">
              {title}
            </h2>
            <p className="text-sm leading-relaxed text-text-secondary">
              {description}
            </p>
          </div>

          {children}

          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-border bg-bg-elevated p-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" />
            <div>
              <p className="mb-1 text-xs font-semibold text-text">
                Institutional access only
              </p>
              <p className="text-xs leading-relaxed text-text-secondary">
                Only <code className="rounded bg-surface px-1 font-mono">@csvtu.ac.in</code>{" "}
                and{" "}
                <code className="rounded bg-surface px-1 font-mono">
                  @students.csvtu.ac.in
                </code>{" "}
                accounts can publish or interact.
              </p>
            </div>
          </div>

          <div className="mt-6 text-center text-sm text-text-secondary">
            {footer}
          </div>
        </div>
      </section>
    </main>
  );
}
