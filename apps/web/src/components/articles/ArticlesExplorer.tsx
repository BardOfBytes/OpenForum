"use client";

import Link from "next/link";
import { ArrowRight, Search, PenSquare } from "lucide-react";
import { useMemo, useState } from "react";
import { ArticleGrid } from "@/components/home/ArticleGrid";
import { CategoryPill } from "@/components/articles/CategoryPill";
import type { ArticleListItem } from "@/lib/api/articles";
import { CATEGORY_CATALOG } from "@/lib/categories";
import { ROUTES } from "@/lib/routes";

interface ArticlesExplorerProps {
  articles: ArticleListItem[];
}

const ALL_TOPICS = "all";

export function ArticlesExplorer({ articles }: ArticlesExplorerProps) {
  const [activeCategory, setActiveCategory] = useState(ALL_TOPICS);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredArticles = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return articles.filter((article) => {
      const matchesCategory =
        activeCategory === ALL_TOPICS || article.category.name === activeCategory;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        article.title.toLowerCase().includes(normalizedSearch) ||
        article.excerpt.toLowerCase().includes(normalizedSearch) ||
        article.author.name.toLowerCase().includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, articles, searchQuery]);

  return (
    <>
      <section className="border-b border-border pb-10 md:pb-12">
        <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <h1 className="font-serif text-4xl font-medium tracking-normal text-foreground md:text-5xl">
              Explore the Archives
            </h1>
          </div>

          <label className="relative block w-full md:max-w-md">
            <span className="sr-only">Search articles</span>
            <Search
              className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search articles..."
              className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
        </div>

        <div className="flex w-full items-center gap-3 overflow-x-auto pb-1 no-scrollbar">
          <CategoryPill
            active={activeCategory === ALL_TOPICS}
            onClick={() => setActiveCategory(ALL_TOPICS)}
          >
            All Topics
          </CategoryPill>
          {CATEGORY_CATALOG.map((category) => (
            <CategoryPill
              key={category.slug}
              active={activeCategory === category.name}
              onClick={() => setActiveCategory(category.name)}
            >
              {category.name}
            </CategoryPill>
          ))}
        </div>
      </section>

      <section className="py-12 md:py-14">
        {filteredArticles.length > 0 ? (
          <ArticleGrid articles={filteredArticles} />
        ) : (
          <div className="rounded-2xl border border-border bg-card px-6 py-20 text-center">
            <h2 className="font-serif text-2xl font-medium text-foreground">
              No articles found
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              Try a different search term or switch categories.
            </p>
          </div>
        )}
      </section>

      <section className="relative overflow-hidden rounded-2xl border border-primary/15 bg-primary/5 px-8 py-12 text-center md:px-16">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
        <span className="relative mb-3 block text-xs font-bold uppercase tracking-widest text-primary">
          For CSVTU Students & Faculty
        </span>
        <h2 className="relative font-serif text-3xl font-medium tracking-normal text-foreground md:text-4xl">
          Your ideas deserve a platform.
        </h2>
        <p className="relative mx-auto mt-4 max-w-xl text-muted-foreground">
          OpenForum is built for students and faculty of CSVTU. Sign in with your
          institutional account and start writing today — no editorial gatekeeping,
          just good thinking.
        </p>
        <div className="relative mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href={ROUTES.write}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <PenSquare className="h-4 w-4" />
            Write for OpenForum
          </Link>
          <Link
            href={ROUTES.about}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-primary"
          >
            Learn more
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
