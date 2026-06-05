/**
 * OpenForum Homepage — `app/page.tsx`
 *
 * Server Component that composes 5 editorial sections:
 * 1. Hero — full-viewport with animated text reveal
 * 2. Featured Article — asymmetric two-column layout
 * 3. Latest Articles — 3-column responsive card grid
 * 4. Categories Bar — horizontal scrollable pills
 * 5. Footer — minimal warm gray
 *
 * Article data is fetched server-side via `getLatestArticles()`.
 * The page itself is a Server Component for optimal SSR performance;
 * interactive sections are extracted into separate Client Components.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/home/HeroSection";
import { CategoriesBar } from "@/components/home/CategoriesBar";
import { HomeFeed } from "@/components/home/HomeFeed";
import { getArticles, type ArticleListItem } from "@/lib/api/articles";
import { ApiBuildTimeFetchSkippedError } from "@/lib/api/base-url";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: {
    absolute: "Home \\ OpenForum",
  },
};

export const dynamic = "force-dynamic";

/* ─────────────────────────────────────────────────────────────
   DATA TYPES
   ───────────────────────────────────────────────────────────── */

async function getHomepageArticles(): Promise<{
  articles: ArticleListItem[];
  errorMessage: string | null;
}> {
  try {
    const articles = await getArticles();
    return { articles: articles.slice(0, 6), errorMessage: null };
  } catch (error) {
    if (!(error instanceof ApiBuildTimeFetchSkippedError)) {
      console.error("[home] Failed to load homepage articles:", error);
    }
    return {
      articles: [],
      errorMessage: "Latest stories are temporarily unavailable.",
    };
  }
}

/* ─────────────────────────────────────────────────────────────
   PAGE COMPONENT
   ───────────────────────────────────────────────────────────── */

export default async function HomePage() {
  const { articles, errorMessage } = await getHomepageArticles();
  return (
    <>
      <Navbar />

      <main className="pt-16">
        {/* ═══ 1. HERO ═══════════════════════════════════════ */}
        <HeroSection />

        <HomeFeed articles={articles} errorMessage={errorMessage} />

        {/* ═══ 4. CATEGORIES BAR ═════════════════════════════ */}
        <CategoriesBar />

        {/* ═══ EDITORIAL DIVIDER ═════════════════════════════ */}
        <div className="container-editorial">
          <hr className="divider-editorial" />
        </div>

        {/* ═══ CTA SECTION ═══════════════════════════════════ */}
        <section className="py-20 md:py-28 text-center" aria-label="Call to action">
          <div className="container-editorial max-w-3xl rounded-2xl border border-accent/15 bg-accent/5 px-8 py-14 md:px-16">
            <h2 className="font-heading text-3xl md:text-4xl font-semibold text-text tracking-tight mb-4 text-balance">
              Your perspective matters.
            </h2>
            <p className="font-body text-text-secondary text-md leading-relaxed mb-8 max-w-lg mx-auto">
              OpenForum is built by students, for students. Whether it&apos;s an
              opinion piece, an investigation, or a personal essay — every voice
              adds to the conversation.
            </p>
            <Link
              href={ROUTES.login}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-accent text-text-inverse font-medium text-sm hover:bg-accent-hover transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              Start Writing Today
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
