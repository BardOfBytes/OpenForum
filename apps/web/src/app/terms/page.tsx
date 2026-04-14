import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Terms",
  description:
    "Terms for using OpenForum, including account responsibilities and content standards.",
};

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="py-12 md:py-16">
        <section className="container-editorial mb-12 md:mb-16">
          <span className="text-xs font-medium font-body uppercase tracking-widest text-text-tertiary block mb-2">
            OpenForum
          </span>
          <h1 className="font-heading text-4xl md:text-5xl font-semibold text-text tracking-tight max-w-3xl">
            Terms of Use
          </h1>
          <p className="font-body text-text-secondary mt-6 max-w-2xl leading-relaxed text-base md:text-lg">
            By using OpenForum, you agree to contribute responsibly, respect community standards,
            and comply with applicable campus and platform policies.
          </p>
        </section>

        <section className="container-narrow space-y-8">
          <article className="rounded-xl border border-border-light bg-bg-elevated p-6">
            <h2 className="font-heading text-2xl font-semibold text-text mb-3">Account responsibility</h2>
            <p className="font-body text-text-secondary leading-relaxed">
              Keep your login credentials secure. You are responsible for activity carried out under
              your account.
            </p>
          </article>

          <article className="rounded-xl border border-border-light bg-bg-elevated p-6">
            <h2 className="font-heading text-2xl font-semibold text-text mb-3">Content ownership</h2>
            <p className="font-body text-text-secondary leading-relaxed">
              You retain ownership of your writing, while granting OpenForum a license to display,
              distribute, and archive submitted content.
            </p>
          </article>

          <article className="rounded-xl border border-border-light bg-bg-elevated p-6">
            <h2 className="font-heading text-2xl font-semibold text-text mb-3">Enforcement</h2>
            <p className="font-body text-text-secondary leading-relaxed">
              We may remove content or suspend accounts that violate policies, legal requirements,
              or safety standards.
            </p>
          </article>
        </section>

        <section className="container-editorial mt-12 rounded-2xl border border-border-light bg-surface p-8 md:p-10">
          <h2 className="font-heading text-2xl md:text-3xl font-semibold text-text tracking-tight mb-3">
            Understand the full publishing framework
          </h2>
          <p className="font-body text-text-secondary leading-relaxed mb-6 max-w-2xl">
            Terms work together with our privacy policy and contributor guidelines.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={ROUTES.privacy}
              className="inline-flex items-center rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-text-inverse hover:bg-accent-hover transition-colors"
            >
              Read privacy policy
            </Link>
            <Link
              href={ROUTES.guidelines}
              className="inline-flex items-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text hover:bg-bg-elevated transition-colors"
            >
              Read guidelines
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
