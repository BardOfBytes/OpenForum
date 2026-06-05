"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, PenSquare } from "lucide-react";
import { ArticleCard } from "@/components/ui/Card";
import { FeaturedArticle } from "@/components/home/FeaturedArticle";
import { CATEGORY_CATALOG } from "@/lib/categories";
import type { ArticleListItem } from "@/lib/api/articles";
import { ROUTES } from "@/lib/routes";

interface HomeFeedProps {
  articles: ArticleListItem[];
  errorMessage: string | null;
}

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function HomeFeed({ articles, errorMessage }: HomeFeedProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const featured = articles[0] ?? null;

  const filteredArticles = useMemo(() => {
    const pool = featured
      ? articles.filter((article) => article.slug !== featured.slug)
      : articles;

    if (!activeCategory) {
      return pool.slice(0, 6);
    }

    return pool
      .filter((article) => article.category.name === activeCategory)
      .slice(0, 6);
  }, [activeCategory, articles, featured]);

  return (
    <>
      <section className="border-y border-border bg-bg-elevated/70 py-4">
        <div className="container-editorial overflow-x-auto scrollbar-hide">
          <div className="flex w-max items-center gap-3">
            <CategoryFilterButton
              active={activeCategory === null}
              onClick={() => setActiveCategory(null)}
              label="All Topics"
            />
            {CATEGORY_CATALOG.map((category) => (
              <CategoryFilterButton
                key={category.slug}
                active={activeCategory === category.name}
                accent={category.color}
                onClick={() =>
                  setActiveCategory((current) =>
                    current === category.name ? null : category.name
                  )
                }
                label={category.name}
              />
            ))}
          </div>
        </div>
      </section>

      {!activeCategory && (
        <section className="container-editorial py-16 md:py-24" aria-label="Featured article">
          <div className="mb-10 flex items-center gap-4">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">
              Featured
            </span>
            <div className="h-px flex-1 bg-border" aria-hidden="true" />
          </div>

          {featured ? (
            <FeaturedArticle article={featured} />
          ) : (
            <EmptyHomeState
              message={errorMessage ?? "No featured story yet."}
              action="Start the first story"
            />
          )}
        </section>
      )}

      <section className="container-editorial pb-20 md:pb-28" aria-label="Latest articles">
        <div className="mb-8 flex items-end justify-between border-b border-border pb-4">
          <div>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.28em] text-text-tertiary">
              {activeCategory ? "Filtered desk" : "Fresh off the press"}
            </span>
            <h2 className="font-heading text-2xl font-semibold tracking-tight text-text md:text-3xl">
              {activeCategory ?? "Latest Pieces"}
            </h2>
          </div>
          {!activeCategory && (
            <Link
              href={ROUTES.articles}
              className="hidden items-center gap-1.5 text-sm font-semibold text-accent transition-colors hover:text-accent-hover sm:inline-flex"
            >
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>

        {filteredArticles.length > 0 ? (
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
            className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {filteredArticles.map((article) => (
              <motion.div
                key={article.slug}
                variants={{
                  hidden: { opacity: 0, y: 18 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.55, ease: EASE },
                  },
                }}
              >
                <ArticleCard {...article} />
              </motion.div>
            ))}
          </motion.div>
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
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent"
          >
            View all articles
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}

function CategoryFilterButton({
  active,
  accent = "var(--color-accent)",
  label,
  onClick,
}: {
  active: boolean;
  accent?: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all",
        active
          ? "border-transparent bg-text text-text-inverse shadow-sm"
          : "border-border bg-bg text-text-secondary hover:border-text-tertiary hover:text-text",
      ].join(" ")}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: active ? "currentColor" : accent }}
        aria-hidden="true"
      />
      {label}
    </button>
  );
}

function EmptyHomeState({
  message,
  action,
}: {
  message: string;
  action: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-bg-elevated px-8 py-14 text-center">
      <p className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-text-secondary">
        {message}
      </p>
      <Link
        href={ROUTES.write}
        className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-text-inverse transition-colors hover:bg-accent-hover"
      >
        <PenSquare className="h-4 w-4" />
        {action}
      </Link>
    </div>
  );
}
