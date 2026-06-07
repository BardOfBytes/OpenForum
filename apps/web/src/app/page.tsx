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
import { PenSquare } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/home/HeroSection";
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

      <main>
        {/* ═══ 1. HERO ═══════════════════════════════════════ */}
        <HeroSection />

        <HomeFeed articles={articles} errorMessage={errorMessage} />

        {/* ═══ CTA SECTION ═══════════════════════════════════ */}
        <section className="container mx-auto mb-16 max-w-6xl px-4 md:px-8" aria-label="Call to action">
          <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-primary/5 px-8 py-14 text-center md:px-16">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
            <div className="relative z-10">
              <span className="mb-3 block text-xs font-bold uppercase tracking-widest text-primary">
                For CSVTU Students &amp; Faculty
              </span>
              <h2 className="mb-4 font-serif text-3xl font-medium text-foreground md:text-4xl">
                Your ideas deserve a platform.
              </h2>
              <p className="mx-auto mb-8 max-w-xl text-muted-foreground">
                OpenForum is built for students and faculty of CSVTU. Sign in with your
                institutional account and start writing today — no editorial gatekeeping,
                just good thinking.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link
                  href={ROUTES.write}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <PenSquare className="h-4 w-4" />
                  Write for OpenForum
                </Link>
                <Link
                  href={ROUTES.about}
                  className="text-sm font-medium text-foreground transition-colors hover:text-primary"
                >
                  Learn more →
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
