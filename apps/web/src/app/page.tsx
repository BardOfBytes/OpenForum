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
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/home/HeroSection";
import { ArticleGrid } from "@/components/home/ArticleGrid";
import { CategoriesBar } from "@/components/home/CategoriesBar";
import { FeaturedArticle } from "@/components/home/FeaturedArticle";
import { getArticles, type ArticleListItem } from "@/lib/api/articles";
import { ROUTES } from "@/lib/routes";

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
    console.error("[home] Failed to load homepage articles:", error);
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
  const featured = articles[0];
  const latest = articles.slice(1);

  return (
    <>
      <Navbar />

      <main>
        {/* ═══ 1. HERO ═══════════════════════════════════════ */}
        <HeroSection />

        {/* ═══ 2. FEATURED ARTICLE ═══════════════════════════ */}
        <section className="py-16 md:py-24 border-t border-border-light" aria-label="Featured article">
          <div className="container-editorial">
            {/* Section label */}
            <div className="flex items-center gap-4 mb-10 md:mb-14">
              <span className="inline-flex items-center gap-2 text-xs font-medium font-body uppercase tracking-widest text-accent">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
                Featured
              </span>
              <div className="h-px flex-1 bg-border" aria-hidden="true" />
            </div>

            {featured ? (
              <FeaturedArticle article={featured} />
            ) : (
              <div className="rounded-xl border border-border-light bg-bg-elevated p-8 text-center">
                <p className="font-body text-text-secondary">
                  {errorMessage ?? "No featured story yet."}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ═══ 3. LATEST ARTICLES ═════════════════════════════ */}
        <section className="py-16 md:py-24 bg-surface/40" aria-label="Latest articles">
          <div className="container-editorial">
            {/* Section header */}
            <div className="flex items-end justify-between mb-10 md:mb-14">
              <div>
                <span className="text-xs font-medium font-body uppercase tracking-widest text-text-tertiary block mb-2">
                  Fresh off the press
                </span>
                <h2 className="font-heading text-2xl md:text-3xl font-semibold text-text tracking-tight">
                  Latest Stories
                </h2>
              </div>
              <Link
                href={ROUTES.articles}
                className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium font-body text-accent hover:text-accent-hover transition-colors duration-fast group"
              >
                View all
                <svg
                  className="w-4 h-4 transition-transform duration-fast group-hover:translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>

            {latest.length > 0 ? (
              <ArticleGrid articles={latest} />
            ) : (
              <div className="rounded-xl border border-border-light bg-bg-elevated p-8 text-center">
                <p className="font-body text-text-secondary">
                  {errorMessage ?? "No articles available right now."}
                </p>
              </div>
            )}

            {/* Mobile "View all" link */}
            <div className="mt-8 text-center sm:hidden">
              <Link
                href={ROUTES.articles}
                className="inline-flex items-center gap-1.5 text-sm font-medium font-body text-accent hover:text-accent-hover transition-colors"
              >
                View all articles →
              </Link>
            </div>
          </div>
        </section>

        {/* ═══ 4. CATEGORIES BAR ═════════════════════════════ */}
        <CategoriesBar />

        {/* ═══ EDITORIAL DIVIDER ═════════════════════════════ */}
        <div className="container-editorial">
          <hr className="divider-editorial" />
        </div>

        {/* ═══ CTA SECTION ═══════════════════════════════════ */}
        <section className="py-20 md:py-28 text-center" aria-label="Call to action">
          <div className="container-editorial max-w-2xl">
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
