import Link from "next/link";
import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn how OpenForum works, what we publish, and how students can contribute responsibly.",
};

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="py-12 md:py-16">
        <section className="container-editorial mb-14 md:mb-20">
          <span className="text-xs font-medium font-body uppercase tracking-widest text-text-tertiary block mb-2">
            OpenForum
          </span>
          <h1 className="font-heading text-4xl md:text-5xl font-semibold text-text tracking-tight max-w-3xl">
            A student newsroom built for honest campus conversations.
          </h1>
          <p className="font-body text-text-secondary mt-6 max-w-2xl leading-relaxed text-base md:text-lg">
            OpenForum is where students report, analyze, and publish stories that matter to their
            peers. We combine strong editorial standards with approachable storytelling so ideas can
            be discussed, challenged, and improved in public.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={ROUTES.write}
              className="inline-flex items-center rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-text-inverse hover:bg-accent-hover transition-colors"
            >
              Write for OpenForum
            </Link>
            <Link
              href={ROUTES.guidelines}
              className="inline-flex items-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text hover:bg-bg-elevated transition-colors"
            >
              Read contributor guidelines
            </Link>
          </div>
        </section>

        <section className="container-editorial grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-14 md:mb-20">
          <article className="rounded-xl border border-border-light bg-bg-elevated p-6">
            <h2 className="font-heading text-xl font-semibold text-text mb-3">Our mission</h2>
            <p className="font-body text-text-secondary leading-relaxed">
              Elevate student voices through meaningful journalism, informed opinions, and
              transparent reporting.
            </p>
          </article>

          <article className="rounded-xl border border-border-light bg-bg-elevated p-6">
            <h2 className="font-heading text-xl font-semibold text-text mb-3">How we work</h2>
            <p className="font-body text-text-secondary leading-relaxed">
              Contributors research carefully, cite responsibly, and write with clarity. Editors
              shape drafts for accuracy and readability before stories are distributed.
            </p>
          </article>

          <article className="rounded-xl border border-border-light bg-bg-elevated p-6">
            <h2 className="font-heading text-xl font-semibold text-text mb-3">Why it matters</h2>
            <p className="font-body text-text-secondary leading-relaxed">
              A stronger student community begins with better information. OpenForum helps students
              make decisions based on facts, context, and diverse perspectives.
            </p>
          </article>
        </section>

        <section className="container-editorial rounded-2xl border border-border-light bg-surface p-8 md:p-10">
          <div className="max-w-3xl">
            <h2 className="font-heading text-2xl md:text-3xl font-semibold text-text tracking-tight mb-4">
              Want to contribute?
            </h2>
            <p className="font-body text-text-secondary leading-relaxed mb-6">
              Pitch an idea, document an issue, or publish an informed take. If your writing is
              thoughtful and evidence-driven, OpenForum is your platform.
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
                Read latest stories
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
