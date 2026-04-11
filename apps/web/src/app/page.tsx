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

/* ─────────────────────────────────────────────────────────────
   DATA TYPES
   ───────────────────────────────────────────────────────────── */

interface Article {
  title: string;
  excerpt: string;
  slug: string;
  coverImageUrl: string | null;
  category: { name: string; color: string };
  author: { name: string; avatarUrl: string | null };
  readTimeMinutes: number;
  publishedAt: string;
}

/* ─────────────────────────────────────────────────────────────
   DATA FETCHING
   ───────────────────────────────────────────────────────────── */

/**
 * TODO: Connect to AXUM API — replace with `fetch(`${API_URL}/api/v1/articles`)`
 *
 * Returns typed mock data for development.
 * Each article uses realistic content that mirrors what
 * an actual CSVTU student publication would publish.
 */
async function getLatestArticles(): Promise<Article[]> {
  // Simulated async delay to mimic API fetch
  await new Promise((r) => setTimeout(r, 0));

  return [
    {
      title: "Inside CSVTU's New AI Research Lab: What It Means for Students",
      excerpt:
        "The university just unveiled a ₹2 crore AI research laboratory. We talked to the faculty leading the initiative and students already using it to build their final-year projects.",
      slug: "csvtu-ai-research-lab",
      coverImageUrl: null, // TODO: Replace with actual cover images
      category: { name: "Tech & AI", color: "#3d7cc9" },
      author: { name: "Arjun Patel", avatarUrl: null },
      readTimeMinutes: 8,
      publishedAt: "2026-04-09T10:00:00Z",
    },
    {
      title: "The Hostel Fee Hike: A Breakdown of Where Your Money Goes",
      excerpt:
        "Hostel fees rose 18% this semester. We obtained the budget documents and mapped every rupee to understand what changed — and what students can do about it.",
      slug: "hostel-fee-hike-breakdown",
      coverImageUrl: null,
      category: { name: "Investigations", color: "#c4392b" },
      author: { name: "Sneha Verma", avatarUrl: null },
      readTimeMinutes: 12,
      publishedAt: "2026-04-08T14:30:00Z",
    },
    {
      title: "From CSVTU to Google: Rahul's Placement Journey",
      excerpt:
        "CSE final-year Rahul Sharma shares his 6-month preparation strategy, the mistakes he made, and the one interview question that almost stumped him.",
      slug: "csvtu-to-google-placement",
      coverImageUrl: null,
      category: { name: "Career Paths", color: "#9b59a6" },
      author: { name: "Rahul Sharma", avatarUrl: null },
      readTimeMinutes: 6,
      publishedAt: "2026-04-07T09:00:00Z",
    },
    {
      title: "Why Student Elections Need Electoral Reform",
      excerpt:
        "Anonymous voting, manifesto vetting, and spending caps — an editorial on what CSVTU can learn from campus democracies at IITs and NITs.",
      slug: "student-elections-reform",
      coverImageUrl: null,
      category: { name: "Editorials", color: "#8b5e3c" },
      author: { name: "Priya Sahu", avatarUrl: null },
      readTimeMinutes: 5,
      publishedAt: "2026-04-06T16:00:00Z",
    },
    {
      title: "My Summer at Razorpay: An Intern's Diary",
      excerpt:
        "Ten weeks in Bangalore, building payment infrastructure used by millions. Here's what no one tells you about fintech internships — the good, the exhausting, and the dal makhani.",
      slug: "summer-internship-razorpay",
      coverImageUrl: null,
      category: { name: "Internship Diaries", color: "#3d8b5f" },
      author: { name: "Kavita Kushwaha", avatarUrl: null },
      readTimeMinutes: 7,
      publishedAt: "2026-04-05T11:00:00Z",
    },
    {
      title: "Reverie 2026: The Best Cultural Fest Moments",
      excerpt:
        "From the surprise headliner to the robotics battle that went viral — a photo essay capturing the energy of this year's Reverie festival.",
      slug: "reverie-2026-cultural-fest",
      coverImageUrl: null,
      category: { name: "Campus News", color: "#d4613c" },
      author: { name: "Ankit Mishra", avatarUrl: null },
      readTimeMinutes: 4,
      publishedAt: "2026-04-04T08:00:00Z",
    },
  ];
}

/* ─────────────────────────────────────────────────────────────
   PAGE COMPONENT
   ───────────────────────────────────────────────────────────── */

export default async function HomePage() {
  const articles = await getLatestArticles();
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

            <FeaturedArticle article={featured} />
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
                href="/feed"
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

            <ArticleGrid articles={latest} />

            {/* Mobile "View all" link */}
            <div className="mt-8 text-center sm:hidden">
              <Link
                href="/feed"
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
              href="/login"
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
