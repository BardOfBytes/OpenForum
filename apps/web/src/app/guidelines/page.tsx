import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Guidelines",
  description:
    "Editorial and contribution guidelines for publishing responsible student journalism on OpenForum.",
};

export default function GuidelinesPage() {
  return (
    <>
      <Navbar />
      <main className="py-12 md:py-16">
        <section className="container-editorial mb-12 md:mb-16">
          <span className="text-xs font-medium font-body uppercase tracking-widest text-text-tertiary block mb-2">
            OpenForum
          </span>
          <h1 className="font-heading text-4xl md:text-5xl font-semibold text-text tracking-tight max-w-3xl">
            Contributor Guidelines
          </h1>
          <p className="font-body text-text-secondary mt-6 max-w-2xl leading-relaxed text-base md:text-lg">
            Publish clear, fair, and well-researched stories. These guidelines ensure every piece on
            OpenForum helps readers trust what they are reading.
          </p>
        </section>

        <section className="container-narrow space-y-8">
          <article className="rounded-xl border border-border-light bg-bg-elevated p-6">
            <h2 className="font-heading text-2xl font-semibold text-text mb-3">Accuracy first</h2>
            <p className="font-body text-text-secondary leading-relaxed">
              Verify claims before publishing. Distinguish facts from opinion and avoid misleading
              headlines.
            </p>
          </article>

          <article className="rounded-xl border border-border-light bg-bg-elevated p-6">
            <h2 className="font-heading text-2xl font-semibold text-text mb-3">Respect and fairness</h2>
            <p className="font-body text-text-secondary leading-relaxed">
              Critique ideas, not identities. Avoid personal attacks, discriminatory language, and
              harassment.
            </p>
          </article>

          <article className="rounded-xl border border-border-light bg-bg-elevated p-6">
            <h2 className="font-heading text-2xl font-semibold text-text mb-3">Transparency</h2>
            <p className="font-body text-text-secondary leading-relaxed">
              If you have a conflict of interest, disclose it. If you make an error, request a
              correction promptly.
            </p>
          </article>
        </section>

        <section className="container-editorial mt-12 rounded-2xl border border-border-light bg-surface p-8 md:p-10">
          <h2 className="font-heading text-2xl md:text-3xl font-semibold text-text tracking-tight mb-3">
            Ready to publish responsibly?
          </h2>
          <p className="font-body text-text-secondary leading-relaxed mb-6 max-w-2xl">
            Follow these principles and submit your next story with confidence.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={ROUTES.write}
              className="inline-flex items-center rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-text-inverse hover:bg-accent-hover transition-colors"
            >
              Start writing
            </Link>
            <Link
              href={ROUTES.articles}
              className="inline-flex items-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text hover:bg-bg-elevated transition-colors"
            >
              Read examples
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
