"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, PenSquare } from "lucide-react";
import { ArticleCard } from "@/components/articles/ArticleCard";
import { AuthorBadge } from "@/components/articles/AuthorBadge";
import { CategoryPill } from "@/components/articles/CategoryPill";
import { CATEGORY_CATALOG } from "@/lib/categories";
import type { ArticleListItem } from "@/lib/api/articles";
import { ROUTES } from "@/lib/routes";

interface HomeFeedProps {
  articles: ArticleListItem[];
  errorMessage: string | null;
}

export function HomeFeed({ articles, errorMessage }: HomeFeedProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const featured = articles[0] ?? null;
  const nonFeatured = featured
    ? articles.filter((article) => article.slug !== featured.slug)
    : articles;
  const rightArticles = nonFeatured.slice(0, 2);
  const belowFeaturedArticle = nonFeatured[2] ?? null;

  const filteredArticles = useMemo(() => {
    if (!activeCategory) {
      return nonFeatured.slice(0, 6);
    }

    return nonFeatured
      .filter((article) => article.category.name === activeCategory)
      .slice(0, 6);
  }, [activeCategory, nonFeatured]);

  return (
    <>
      <section className="mb-16 border-y border-border bg-card/50 py-4">
        <div className="container mx-auto max-w-6xl overflow-x-auto px-4 no-scrollbar">
          <div className="flex w-max items-center gap-3">
            <CategoryPill
              active={activeCategory === null}
              onClick={() => setActiveCategory(null)}
            >
              All Topics
            </CategoryPill>
            {CATEGORY_CATALOG.map((category) => (
              <CategoryPill
                key={category.slug}
                active={activeCategory === category.name}
                onClick={() =>
                  setActiveCategory((current) =>
                    current === category.name ? null : category.name
                  )
                }
              >
                {category.name}
              </CategoryPill>
            ))}
          </div>
        </div>
      </section>

      {!activeCategory && (
        <section className="container mx-auto mb-24 max-w-6xl px-4 md:px-8" aria-label="Featured article">
          {featured ? (
            <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-3">
              <div className="flex flex-col gap-6 lg:col-span-2">
                <FeaturedStoryCard article={featured} />
                {belowFeaturedArticle ? (
                  <ArticleCard article={belowFeaturedArticle} index={2} />
                ) : null}
              </div>
              {rightArticles.length > 0 ? (
                <div className="flex flex-col gap-6">
                  {rightArticles.map((article, index) => (
                    <ArticleCard key={article.slug} article={article} index={index} />
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyHomeState
              message={errorMessage ?? "No featured story yet."}
              action="Start the first story"
            />
          )}
        </section>
      )}

      <section className="container mx-auto max-w-6xl px-4 pb-12 md:px-8 md:pb-16" aria-label="Latest articles">
        <div className="mb-8 flex items-end justify-between border-b border-border pb-4">
          <div>
            <h2 className="font-serif text-2xl font-medium text-foreground">
              {activeCategory ?? "Latest Pieces"}
            </h2>
          </div>
          {!activeCategory && (
            <Link
              href={ROUTES.articles}
              className="hidden items-center gap-1 text-sm font-medium text-primary hover:underline sm:inline-flex"
            >
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>

        {filteredArticles.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredArticles.map((article, index) => (
              <ArticleCard key={article.slug} article={article} index={index} />
            ))}
          </div>
        ) : (
          <EmptyHomeState
            message={
              activeCategory
                ? `No articles in ${activeCategory} yet.`
                : errorMessage ?? "No articles available right now."
            }
            action={activeCategory ? "Write one" : "Start writing"}
          />
        )}

        <div className="mt-8 text-center sm:hidden">
          <Link
            href={ROUTES.articles}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
          >
            View all articles
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}

function FeaturedStoryCard({ article }: { article: ArticleListItem }) {
  const readTime = `${article.readTimeMinutes || 1} min read`;

  return (
    <Link
      href={ROUTES.article.detail(article.slug)}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Read featured story: ${article.title}`}
    >
      <article className="relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300 hover:border-primary/50">
        {article.coverImageUrl ? (
          <div className="h-72 flex-shrink-0 overflow-hidden bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.coverImageUrl}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="eager"
            />
          </div>
        ) : (
          <div
            className="h-2 flex-shrink-0 bg-gradient-to-r from-primary/60 via-primary/30 to-transparent"
            style={{
              background: `linear-gradient(90deg, ${article.category.color} 0%, ${article.category.color}66 55%, transparent 100%)`,
            }}
          />
        )}

        <div className="flex flex-col bg-card p-8 md:p-10">
          <span className="mb-3 block text-xs font-bold uppercase tracking-widest text-primary">
            {article.category.name}
          </span>
          <h2 className="mb-3 font-serif text-2xl font-medium leading-tight text-foreground transition-colors group-hover:text-primary md:text-4xl">
            {article.title}
          </h2>
          <p className="mb-6 max-w-xl text-muted-foreground">
            {article.excerpt}
          </p>
          <AuthorBadge
            name={article.author.name}
            avatarFallback={initials(article.author.name) || "OF"}
            avatarUrl={article.author.avatarUrl}
            date={formattedDate(article.publishedAt)}
            readTime={readTime}
          />
        </div>
      </article>
    </Link>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formattedDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function EmptyHomeState({
  message,
  action,
}: {
  message: string;
  action: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-8 py-14 text-center">
      <p className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-muted-foreground">
        {message}
      </p>
      <Link
        href={ROUTES.write}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <PenSquare className="h-4 w-4" />
        {action}
      </Link>
    </div>
  );
}
