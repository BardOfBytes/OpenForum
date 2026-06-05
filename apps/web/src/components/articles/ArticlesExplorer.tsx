"use client";

import Link from "next/link";
import { Search, PenSquare } from "lucide-react";
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
        <div className="mb-8">
          <span className="mb-2 block font-body text-xs font-medium uppercase tracking-widest text-text-tertiary">
            OpenForum Archive
          </span>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <h1 className="font-heading text-4xl font-semibold tracking-normal text-text md:text-5xl">
                Explore the Archives
              </h1>
              <p className="mt-4 max-w-xl font-body text-text-secondary">
                Search campus reporting, opinion, career notes, and student essays from across
                OpenForum.
              </p>
            </div>

            <div className="font-body text-sm text-text-tertiary">
              {filteredArticles.length} of {articles.length} article
              {articles.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <label className="relative block w-full md:max-w-sm">
            <span className="sr-only">Search articles</span>
            <Search
              className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-tertiary"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search articles..."
              className="w-full rounded-xl border border-border bg-bg-elevated py-3 pl-10 pr-4 text-sm text-text outline-none transition-colors placeholder:text-text-tertiary focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>

          <div className="flex w-full items-center gap-3 overflow-x-auto pb-1 md:w-auto md:pb-0 no-scrollbar">
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
        </div>
      </section>

      <section className="py-12 md:py-14">
        {filteredArticles.length > 0 ? (
          <ArticleGrid articles={filteredArticles} />
        ) : (
          <div className="rounded-xl border border-border-light bg-bg-elevated px-6 py-20 text-center">
            <h2 className="font-heading text-2xl font-semibold text-text">
              No articles found
            </h2>
            <p className="mx-auto mt-3 max-w-md font-body text-sm leading-relaxed text-text-secondary">
              Try a different search term or switch categories.
            </p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-accent/20 bg-accent-subtle px-8 py-12 text-center md:px-16">
        <span className="mb-3 block font-body text-xs font-bold uppercase tracking-widest text-accent">
          For CSVTU Students & Faculty
        </span>
        <h2 className="font-heading text-3xl font-semibold tracking-normal text-text md:text-4xl">
          Your ideas deserve a platform.
        </h2>
        <p className="mx-auto mt-4 max-w-xl font-body text-text-secondary">
          Sign in with your institutional account and publish thoughtful work for the campus.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href={ROUTES.write}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3 text-sm font-semibold text-text-inverse shadow-sm transition-colors hover:bg-accent-hover"
          >
            <PenSquare className="h-4 w-4" />
            Write for OpenForum
          </Link>
          <Link
            href={ROUTES.about}
            className="text-sm font-medium text-text transition-colors hover:text-accent"
          >
            Learn more
          </Link>
        </div>
      </section>
    </>
  );
}
