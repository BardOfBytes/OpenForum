import Link from "next/link";

interface EditorialInfoPageProps {
  eyebrow: string;
  title: string;
  description: string;
  primaryAction?: { href: string; label: string };
  secondaryAction?: { href: string; label: string };
  sections: Array<{
    title: string;
    body: string;
    kicker?: string;
  }>;
  closing: {
    title: string;
    body: string;
    primaryAction?: { href: string; label: string };
    secondaryAction?: { href: string; label: string };
  };
}

export function EditorialInfoPage({
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryAction,
  sections,
  closing,
}: EditorialInfoPageProps) {
  return (
    <main className="pb-20 pt-16 md:pb-28">
      <section className="relative overflow-hidden border-b border-border">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(circle at 18% 12%, rgba(212,97,60,0.12), transparent 28%), radial-gradient(circle at 86% 28%, rgba(61,124,201,0.08), transparent 34%)",
          }}
          aria-hidden="true"
        />
        <div className="container-editorial py-16 md:py-24">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.3em] text-accent">
            {eyebrow}
          </p>
          <h1 className="max-w-4xl font-heading text-4xl font-semibold leading-tight tracking-tight text-text md:text-6xl">
            {title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-text-secondary">
            {description}
          </p>

          {(primaryAction || secondaryAction) && (
            <div className="mt-8 flex flex-wrap gap-3">
              {primaryAction ? (
                <InfoLink href={primaryAction.href} variant="primary">
                  {primaryAction.label}
                </InfoLink>
              ) : null}
              {secondaryAction ? (
                <InfoLink href={secondaryAction.href} variant="secondary">
                  {secondaryAction.label}
                </InfoLink>
              ) : null}
            </div>
          )}
        </div>
      </section>

      <section className="container-editorial grid gap-8 py-14 md:grid-cols-[0.72fr_1.28fr] md:py-20">
        <div>
          <p className="sticky top-24 text-xs font-bold uppercase tracking-[0.3em] text-text-tertiary">
            Working standard
          </p>
        </div>

        <div className="divide-y divide-border border-y border-border">
          {sections.map((section, index) => (
            <article key={section.title} className="grid gap-4 py-8 md:grid-cols-[120px_1fr]">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
                {section.kicker ?? `0${index + 1}`}
              </div>
              <div>
                <h2 className="font-heading text-2xl font-semibold tracking-tight text-text">
                  {section.title}
                </h2>
                <p className="mt-3 max-w-2xl text-base leading-relaxed text-text-secondary">
                  {section.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="container-editorial">
        <div className="rounded-2xl border border-accent/15 bg-accent/5 px-8 py-10 md:px-12">
          <h2 className="max-w-2xl font-heading text-3xl font-semibold tracking-tight text-text md:text-4xl">
            {closing.title}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-text-secondary">
            {closing.body}
          </p>
          {(closing.primaryAction || closing.secondaryAction) && (
            <div className="mt-7 flex flex-wrap gap-3">
              {closing.primaryAction ? (
                <InfoLink href={closing.primaryAction.href} variant="primary">
                  {closing.primaryAction.label}
                </InfoLink>
              ) : null}
              {closing.secondaryAction ? (
                <InfoLink href={closing.secondaryAction.href} variant="secondary">
                  {closing.secondaryAction.label}
                </InfoLink>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function InfoLink({
  href,
  variant,
  children,
}: {
  href: string;
  variant: "primary" | "secondary";
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold transition-colors",
        variant === "primary"
          ? "bg-accent text-text-inverse hover:bg-accent-hover"
          : "border border-border bg-bg text-text hover:bg-surface",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}
