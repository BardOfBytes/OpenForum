"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, PenSquare } from "lucide-react";
import type { ArticleListItem } from "@/lib/api/articles";
import type { CategoryDefinition } from "@/lib/categories";
import { ROUTES } from "@/lib/routes";

interface CategorySnapshot {
  count: number;
  latest: ArticleListItem | null;
}

interface CategoriesExperienceProps {
  categories: CategoryDefinition[];
  snapshots: Array<[string, CategorySnapshot]>;
  errorMessage: string | null;
}

export function CategoriesExperience({
  categories,
  snapshots,
  errorMessage,
}: CategoriesExperienceProps) {
  const snapshotMap = new Map(snapshots);

  return (
    <main className="flex-grow">
      <section className="container mx-auto mb-14 max-w-6xl border-b border-border px-4 pb-12 pt-12 md:px-8">
        <span className="mb-3 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Browse by Topic
        </span>
        <h1 className="mb-3 font-serif text-4xl font-medium md:text-5xl">
          Categories
        </h1>
        <p className="max-w-xl text-muted-foreground">
          Every piece on OpenForum belongs to a category. Find the territory that interests you most.
        </p>
      </section>

      <section className="container mx-auto mb-16 max-w-6xl px-4 md:px-8">
        {errorMessage ? (
          <div className="rounded-xl border border-destructive/30 bg-card px-6 py-16 text-center">
            <p className="text-muted-foreground">{errorMessage}</p>
            <Link
              href={ROUTES.write}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <PenSquare className="h-4 w-4" />
              Write an article
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category, index) => {
              const snapshot = snapshotMap.get(category.slug) ?? { count: 0, latest: null };

              return (
                <motion.div
                  key={category.slug}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.05 }}
                >
                  <Link href={ROUTES.category.detail(category.slug)}>
                    <div
                      className="group flex h-full cursor-pointer flex-col justify-between rounded-xl border border-border p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                      style={{ background: `${category.color}14` }}
                    >
                      <div>
                        <div className="mb-3 flex items-center gap-2.5">
                          <span
                            className="h-3 w-3 flex-shrink-0 rounded-full"
                            style={{ background: category.color }}
                          />
                          <span
                            className="text-xs font-bold uppercase tracking-widest"
                            style={{ color: category.color }}
                          >
                            {category.name}
                          </span>
                        </div>

                        <h2 className="mb-2 font-serif text-xl font-medium text-foreground transition-colors group-hover:text-foreground/80">
                          {category.name}
                        </h2>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {category.description}
                        </p>
                      </div>

                      <div className="mt-6 border-t border-border/60 pt-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            <strong className="text-foreground">{snapshot.count}</strong>{" "}
                            {snapshot.count === 1 ? "article" : "articles"}
                          </span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-foreground" />
                        </div>
                        {snapshot.latest ? (
                          <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            Latest: {snapshot.latest.title}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
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
