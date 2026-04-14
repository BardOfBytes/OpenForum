import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "Privacy practices for OpenForum, including account data, content metadata, and usage information.",
};

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="py-12 md:py-16">
        <section className="container-editorial mb-12 md:mb-16">
          <span className="text-xs font-medium font-body uppercase tracking-widest text-text-tertiary block mb-2">
            OpenForum
          </span>
          <h1 className="font-heading text-4xl md:text-5xl font-semibold text-text tracking-tight max-w-3xl">
            Privacy Policy
          </h1>
          <p className="font-body text-text-secondary mt-6 max-w-2xl leading-relaxed text-base md:text-lg">
            We collect the minimum data needed to authenticate contributors and operate a reliable
            student publishing platform.
          </p>
        </section>

        <section className="container-narrow space-y-8">
          <article className="rounded-xl border border-border-light bg-bg-elevated p-6">
            <h2 className="font-heading text-2xl font-semibold text-text mb-3">Data we collect</h2>
            <p className="font-body text-text-secondary leading-relaxed">
              Account identifiers, profile fields, published content, and technical logs required
              for security and debugging.
            </p>
          </article>

          <article className="rounded-xl border border-border-light bg-bg-elevated p-6">
            <h2 className="font-heading text-2xl font-semibold text-text mb-3">How it is used</h2>
            <p className="font-body text-text-secondary leading-relaxed">
              Data is used to authenticate users, render content, prevent abuse, and maintain
              platform integrity.
            </p>
          </article>

          <article className="rounded-xl border border-border-light bg-bg-elevated p-6">
            <h2 className="font-heading text-2xl font-semibold text-text mb-3">Your control</h2>
            <p className="font-body text-text-secondary leading-relaxed">
              You can request profile updates and content corrections through the OpenForum team.
              Sensitive data is never intentionally shared publicly.
            </p>
          </article>
        </section>

        <section className="container-editorial mt-12 rounded-2xl border border-border-light bg-surface p-8 md:p-10">
          <h2 className="font-heading text-2xl md:text-3xl font-semibold text-text tracking-tight mb-3">
            Questions about privacy?
          </h2>
          <p className="font-body text-text-secondary leading-relaxed mb-6 max-w-2xl">
            If you need clarification about data handling, review the terms and contribution
            standards first.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={ROUTES.terms}
              className="inline-flex items-center rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-text-inverse hover:bg-accent-hover transition-colors"
            >
              Read terms
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
