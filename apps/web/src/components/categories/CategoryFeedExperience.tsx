"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, PenSquare } from "lucide-react";
import { ArticleCard } from "@/components/articles/ArticleCard";
import type { ArticleListItem } from "@/lib/api/articles";
import type { CategoryDefinition } from "@/lib/categories";
import { ROUTES } from "@/lib/routes";

interface CategoryFeedExperienceProps {
  category: CategoryDefinition;
  articles: ArticleListItem[];
  errorMessage: string | null;
}

export function CategoryFeedExperience({
  category,
  articles,
  errorMessage,
}: CategoryFeedExperienceProps) {
  return (
    <main className="flex-grow">
      <section className="container mx-auto mb-14 max-w-6xl border-b border-border px-4 pb-12 pt-12 md:px-8">
        <Link
          href={ROUTES.categories}
          className="group mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          All Categories
        </Link>

        <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-primary">
          Category
        </span>
        <h1 className="mb-3 font-serif text-4xl font-medium md:text-5xl">
          {category.name}
        </h1>
        <p className="text-muted-foreground">
          {errorMessage
            ? category.description
            : `${articles.length} ${articles.length === 1 ? "article" : "articles"} in this category`}
        </p>
      </section>

      <section className="container mx-auto mb-16 max-w-6xl px-4 md:px-8">
        {errorMessage ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-destructive/30 bg-card px-6 py-20 text-center"
          >
            <h3 className="mb-3 font-serif text-2xl font-medium">Unable to load articles</h3>
            <p className="mx-auto max-w-md text-muted-foreground">{errorMessage}</p>
          </motion.div>
        ) : articles.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article, index) => (
              <ArticleCard key={article.slug} article={article} index={index} />
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-border bg-card py-24 text-center"
          >
            <h3 className="mb-3 font-serif text-2xl font-medium">No articles yet</h3>
            <p className="mb-6 text-muted-foreground">
              Be the first to write in this category.
            </p>
            <Link
            href={ROUTES.write}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 hover:bg-primary/90"
            >
              <PenSquare className="h-4 w-4" />
              Write an article
            </Link>
          </motion.div>
        )}
      </section>

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
          </div>
        </div>
      </section>
    </main>
  );
}
